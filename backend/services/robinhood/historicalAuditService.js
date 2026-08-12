import { QueryTypes } from "sequelize";
import sequelize from "../../sequelize.js";
import { fetchRobinhoodHistoricalWalletLedger } from "./blockscoutClient.js";

// These are intentionally static historical addresses supplied by the owner.
// Do not insert them into `wallets`: they have no live inventory, dashboard
// chip, routine refresh policy, or paid-provider lifecycle.
export const HISTORICAL_GMGN_AUDIT_ADDRESSES = Object.freeze(String(process.env.ROBINHOOD_HISTORICAL_AUDIT_WALLETS || "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => /^0x[a-f0-9]{40}$/.test(address)));

export const HISTORICAL_AUDIT_SOURCE = "gmgn-static-history-v1";
const runningByUser = new Map();
const lower = (value) => String(value || "").toLowerCase();

const getRows = async (userId) => sequelize.query(
    `
      SELECT address, status, source, fetched_at, raw_ledger, last_error
      FROM robinhood_historical_audit_ledgers
      WHERE user_id = :userId
        AND address IN (:addresses)
      ORDER BY address ASC
    `,
    {
        replacements: { userId, addresses: HISTORICAL_GMGN_AUDIT_ADDRESSES },
        type: QueryTypes.SELECT,
    }
);

const parseLedger = (rawLedger) => {
    if (!rawLedger) return null;
    if (typeof rawLedger === "string") {
        try { return JSON.parse(rawLedger); } catch { return null; }
    }
    return rawLedger;
};

const hasCompleteLedgerCoverage = (row) => {
    const ledger = parseLedger(row?.raw_ledger);
    return row?.status === "complete" && Boolean(ledger?.internalTransactionsAvailable);
};

// `fetching` is owned by the in-process backfill map. If that process was
// restarted or interrupted, leaving the row as fetching would make the UI
// spin forever and prevent an explicit retry.
const recoverInterruptedFetches = async (userId) => {
    if (runningByUser.has(String(userId))) return;
    await sequelize.query(
        `
          UPDATE robinhood_historical_audit_ledgers
          SET status = 'failed',
              last_error = COALESCE(last_error, 'Historical audit was interrupted; retry when the public explorer is available.'),
              updated_at = NOW()
          WHERE user_id = :userId
            AND status = 'fetching'
            AND raw_ledger IS NULL
        `,
        { replacements: { userId } }
    );
};

// This result is deliberately safe for UI use: it contains no historical
// wallet addresses and never exposes raw ledger content through the status API.
export const summarizeHistoricalAuditRows = (rows = [], { running = false } = {}) => {
    const completed = rows.filter(hasCompleteLedgerCoverage).length;
    const incompleteCompleted = rows.filter((row) => row.status === "complete" && !hasCompleteLedgerCoverage(row)).length;
    const failed = rows.filter((row) => row.status === "failed").length + incompleteCompleted;
    const fetching = rows.filter((row) => row.status === "fetching").length;
    const pending = Math.max(0, HISTORICAL_GMGN_AUDIT_ADDRESSES.length - completed - failed - fetching);
    const fetchedAt = rows
        .filter((row) => hasCompleteLedgerCoverage(row) && row.fetched_at)
        .map((row) => new Date(row.fetched_at).getTime())
        .filter(Number.isFinite)
        .sort((left, right) => right - left)[0];
    // Pending rows are merely staged for a manual retry; they are not proof
    // that a worker is alive. Otherwise an interrupted audit would look like
    // an endless running spinner forever.
    const isRunning = running || rows.some((row) => row.status === "fetching");
    const status = isRunning
        ? "running"
        : completed === HISTORICAL_GMGN_AUDIT_ADDRESSES.length
            ? "complete"
            : completed > 0
                ? "partial"
                : failed > 0
                    ? "failed"
                    : "not-started";

    return {
        source: HISTORICAL_AUDIT_SOURCE,
        status,
        walletCount: HISTORICAL_GMGN_AUDIT_ADDRESSES.length,
        completedWalletCount: completed,
        failedWalletCount: failed,
        fetchingWalletCount: fetching,
        pendingWalletCount: pending,
        isRunning,
        fetchedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
        // A partial set would misclassify transfers to a not-yet-audited
        // historical wallet. Keep the live accounting untouched until the
        // complete static bundle is present and explicitly marked complete.
        includedInAccounting: completed === HISTORICAL_GMGN_AUDIT_ADDRESSES.length,
        inventoryIncluded: false,
        automaticRefresh: false,
        addressDisclosure: "hidden",
    };
};

export const getHistoricalAuditStatus = async (userId) => {
    await recoverInterruptedFetches(userId);
    const rows = await getRows(userId);
    return summarizeHistoricalAuditRows(rows, { running: runningByUser.has(String(userId)) });
};

export const loadCompletedHistoricalAuditLedgers = async (userId) => {
    const rows = await getRows(userId);
    return rows
        .filter(hasCompleteLedgerCoverage)
        .map((row) => parseLedger(row.raw_ledger))
        .filter(Boolean);
};

const stagePendingAddresses = async (userId) => {
    const rows = await getRows(userId);
    const existingByAddress = new Map(rows.map((row) => [lower(row.address), row]));
    const targets = HISTORICAL_GMGN_AUDIT_ADDRESSES.filter((address) => existingByAddress.get(address)?.status !== "complete");

    if (!targets.length) return targets;

    await sequelize.transaction(async (transaction) => {
        for (const address of targets) {
            const existing = existingByAddress.get(address);
            if (!existing) {
                await sequelize.query(
                    `
                      INSERT INTO robinhood_historical_audit_ledgers
                        (user_id, address, source, status, created_at, updated_at)
                      VALUES (:userId, :address, :source, 'pending', NOW(), NOW())
                    `,
                    { replacements: { userId, address, source: HISTORICAL_AUDIT_SOURCE }, transaction }
                );
            } else {
                // Failed/fetching rows have no completed immutable payload, so
                // retrying them is safe. Completed entries are deliberately not
                // selected as targets above.
                await sequelize.query(
                    `
                      UPDATE robinhood_historical_audit_ledgers
                      SET status = 'pending', last_error = NULL, updated_at = NOW()
                      WHERE user_id = :userId
                        AND address = :address
                        AND raw_ledger IS NULL
                    `,
                    { replacements: { userId, address }, transaction }
                );
            }
        }
    });

    return targets;
};

const persistLedger = async ({ userId, address, ledger }) => {
    await sequelize.query(
        `
          UPDATE robinhood_historical_audit_ledgers
          SET raw_ledger = CAST(:rawLedger AS jsonb),
              status = 'complete',
              source = :source,
              fetched_at = NOW(),
              last_error = NULL,
              updated_at = NOW()
          WHERE user_id = :userId
            AND address = :address
            AND raw_ledger IS NULL
        `,
        {
            replacements: {
                userId,
                address,
                source: HISTORICAL_AUDIT_SOURCE,
                rawLedger: JSON.stringify(ledger),
            },
        }
    );
};

const persistFailure = async ({ userId, address, error }) => {
    const message = String(error?.message || "Historical ledger fetch failed").slice(0, 500);
    await sequelize.query(
        `
          UPDATE robinhood_historical_audit_ledgers
          SET status = 'failed', last_error = :message, updated_at = NOW()
          WHERE user_id = :userId
            AND address = :address
            AND raw_ledger IS NULL
        `,
        { replacements: { userId, address, message } }
    );
};

const runBackfill = async ({ userId, addresses }) => {
    // Sequential execution is intentional: this is a large public explorer
    // read and should never create a burst or run during ordinary viewing.
    for (const address of addresses) {
        await sequelize.query(
            `
              UPDATE robinhood_historical_audit_ledgers
              SET status = 'fetching', updated_at = NOW()
              WHERE user_id = :userId
                AND address = :address
                AND raw_ledger IS NULL
            `,
            { replacements: { userId, address } }
        );
        try {
            const ledger = await fetchRobinhoodHistoricalWalletLedger(address);
            if (!ledger?.internalTransactionsAvailable) {
                throw new Error("Historical ledger is missing internal-transfer coverage");
            }
            await persistLedger({ userId, address, ledger });
        } catch (error) {
            // Do not log wallet addresses or raw API bodies. A retry remains
            // available only through the explicit authenticated endpoint.
            console.warn("Historical GMGN audit ledger fetch failed:", error.message);
            await persistFailure({ userId, address, error });
        }
    }
};

export const startHistoricalAudit = async (userId) => {
    const key = String(userId);
    if (runningByUser.has(key)) {
        return { accepted: false, reason: "already-running", audit: await getHistoricalAuditStatus(userId) };
    }

    const addresses = await stagePendingAddresses(userId);
    if (!addresses.length) {
        return { accepted: false, reason: "already-complete", audit: await getHistoricalAuditStatus(userId) };
    }

    const promise = runBackfill({ userId, addresses })
        .catch((error) => console.warn("Historical GMGN audit backfill failed:", error.message))
        .finally(() => runningByUser.delete(key));
    runningByUser.set(key, promise);

    return { accepted: true, audit: await getHistoricalAuditStatus(userId) };
};
