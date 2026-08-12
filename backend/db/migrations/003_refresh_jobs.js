export const migrateRefreshJobs = async ({ sequelize, transaction }) => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS refresh_jobs (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      kind VARCHAR(48) NOT NULL,
      status VARCHAR(48) NOT NULL DEFAULT 'queued',
      wallet_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      progress JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `, { transaction });
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS refresh_jobs_user_created_idx
    ON refresh_jobs (user_id, created_at DESC)
  `, { transaction });
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS refresh_jobs_active_idx
    ON refresh_jobs (user_id, status)
    WHERE status IN ('queued', 'running')
  `, { transaction });
  return { refreshJobsAdded: true };
};
