import { QueryTypes } from "sequelize";
import sequelize from "../sequelize.js";

const activeJobs = new Map();
const activeStatuses = new Set(["queued", "running"]);

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeJob = (row) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  kind: row.kind,
  status: row.status,
  walletIds: parseJson(row.wallet_ids, []),
  progress: parseJson(row.progress, {}),
  result: parseJson(row.result, null),
  error: row.error || null,
  createdAt: row.created_at,
  startedAt: row.started_at || null,
  completedAt: row.completed_at || null,
});

const createJob = async ({ userId, kind, walletIds }) => {
  const [row] = await sequelize.query(
    `
      INSERT INTO refresh_jobs (user_id, kind, wallet_ids, progress)
      VALUES (:userId, :kind, CAST(:walletIds AS jsonb), CAST(:progress AS jsonb))
      RETURNING *
    `,
    {
      replacements: {
        userId,
        kind,
        walletIds: JSON.stringify(walletIds || []),
        progress: JSON.stringify({ phase: "Queued", current: 0, total: 0 }),
      },
      type: QueryTypes.SELECT,
    }
  );
  return normalizeJob(row);
};

const saveJob = async (job, patch = {}) => {
  const next = {
    ...job,
    ...patch,
    progress: patch.progress ? { ...job.progress, ...patch.progress } : job.progress,
  };
  const terminal = !activeStatuses.has(next.status);
  const [row] = await sequelize.query(
    `
      UPDATE refresh_jobs
      SET status = :status,
          progress = CAST(:progress AS jsonb),
          result = CAST(:result AS jsonb),
          error = :error,
          started_at = CASE WHEN :started THEN COALESCE(started_at, NOW()) ELSE started_at END,
          completed_at = CASE WHEN :completed THEN NOW() ELSE completed_at END
      WHERE id = :id AND user_id = :userId
      RETURNING *
    `,
    {
      replacements: {
        id: next.id,
        userId: next.userId,
        status: next.status,
        progress: JSON.stringify(next.progress || {}),
        result: next.result == null ? null : JSON.stringify(next.result),
        error: next.error || null,
        started: next.status === "running",
        completed: terminal,
      },
      type: QueryTypes.SELECT,
    }
  );
  return normalizeJob(row);
};

export const getRefreshJob = async ({ id, userId }) => {
  const [row] = await sequelize.query(
    "SELECT * FROM refresh_jobs WHERE id = :id AND user_id = :userId",
    { replacements: { id, userId }, type: QueryTypes.SELECT }
  );
  return row ? normalizeJob(row) : null;
};

export const enqueueRefreshJob = async ({ userId, kind, walletIds = [], run }) => {
  const key = `${userId}:${kind}:${[...walletIds].sort((a, b) => a - b).join(",")}`;
  const existing = activeJobs.get(key);
  if (existing) return { job: existing.job, reused: true };

  let job = await createJob({ userId, kind, walletIds });
  const holder = { job };
  activeJobs.set(key, holder);

  void (async () => {
    try {
      job = await saveJob(job, { status: "running", progress: { phase: "Starting" } });
      holder.job = job;
      const report = async (progress) => {
        job = await saveJob(job, { status: "running", progress });
        holder.job = job;
      };
      const result = await run({ report });
      const failed = Array.isArray(result?.results) && result.results.some((item) => item.status === "failed");
      job = await saveJob(job, {
        status: failed ? "completed_with_warnings" : "completed",
        progress: { phase: failed ? "Completed with warnings" : "Completed" },
        result: result || null,
      });
      holder.job = job;
    } catch (error) {
      job = await saveJob(job, {
        status: "failed",
        progress: { phase: "Failed" },
        error: error?.message || "Refresh failed",
      });
      holder.job = job;
      console.error("Refresh job failed:", error);
    } finally {
      activeJobs.delete(key);
    }
  })();

  return { job, reused: false };
};

// A refresh cannot safely resume after a backend restart because provider work
// may have completed without a persisted cursor. Mark it clearly instead of
// leaving the UI in a false "loading" state.
export const markInterruptedRefreshJobs = async () => {
  await sequelize.query(`
    UPDATE refresh_jobs
    SET status = 'interrupted',
        error = COALESCE(error, 'Backend restarted before this refresh completed'),
        completed_at = NOW()
    WHERE status IN ('queued', 'running')
  `);
};
