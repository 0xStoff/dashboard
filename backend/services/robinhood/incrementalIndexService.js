import { QueryTypes } from "sequelize";
import sequelize from "../../sequelize.js";
import {
    fetchRobinhoodAccountSnapshot,
    fetchRobinhoodResourcePage,
} from "./blockscoutClient.js";

const RESOURCES = ["transactions", "internal-transactions", "token-transfers"];
const DEFAULT_BACKFILL_PAGES = Math.max(1, Number(process.env.ROBINHOOD_INDEX_BACKFILL_PAGES_PER_RUN || 20));
const DEFAULT_INTERVAL_MS = Math.max(30_000, Number(process.env.ROBINHOOD_INDEX_INTERVAL_MS || 120_000));
const configuredAddresses = new Set(String(process.env.ROBINHOOD_PERFORMANCE_WALLETS || "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => /^0x[a-f0-9]{40}$/.test(address)));
const runningScopes = new Map();
let scheduler = null;

const lower = (value) => String(value || "").toLowerCase();
const finiteBlock = (item) => {
    const value = Number(item?.block_number ?? item?.blockNumber ?? item?.block?.height ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};
const transactionHash = (item) => item?.hash || item?.transaction_hash || item?.transaction?.hash || null;
const eventTimestamp = (item) => {
    const value = item?.timestamp || item?.timeStamp || null;
    if (!value) return null;
    if (/^\d+$/.test(String(value))) return new Date(Number(value) * 1_000).toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const canonicalInteger = (value) => {
    if (value == null || value === "") return "";
    try {
        return BigInt(value).toString();
    } catch {
        return String(value).toLowerCase();
    }
};
export const robinhoodEventKey = (resource, item) => {
    const hash = transactionHash(item) || "nohash";
    if (resource === "transactions") return hash;
    if (resource === "internal-transactions") {
        const index = item?.index ?? item?.trace_index ?? item?.transaction_index;
        return index == null
            ? `${hash}:${lower(item?.from?.hash || item?.from)}:${lower(item?.to?.hash || item?.to)}:${item?.value || 0}`
            : `${hash}:${index}`;
    }
    const logIndex = canonicalInteger(item?.log_index ?? item?.logIndex);
    const token = lower(item?.token?.address_hash || item?.token?.address || item?.contractAddress);
    const tokenId = canonicalInteger(item?.token_id ?? item?.total?.token_id);
    return `${hash}:${logIndex}:${token}:${tokenId}`;
};

const ensureState = async (userId, address, resource) => {
    await sequelize.query(`
        INSERT INTO robinhood_index_states (user_id, wallet_address, resource)
        VALUES (:userId, :address, :resource)
        ON CONFLICT (user_id, wallet_address, resource) DO NOTHING
    `, { replacements: { userId, address, resource } });
};

const loadState = async (userId, address, resource) => {
    await ensureState(userId, address, resource);
    const [state] = await sequelize.query(`
        SELECT resource, scan_mode AS "scanMode", status, next_page_params AS "nextPageParams",
               backfill_complete AS "backfillComplete",
               last_indexed_block AS "lastIndexedBlock",
               last_indexed_at AS "lastIndexedAt", last_error AS "lastError"
        FROM robinhood_index_states
        WHERE user_id = :userId AND wallet_address = :address AND resource = :resource
    `, { replacements: { userId, address, resource }, type: QueryTypes.SELECT });
    return state;
};

const storeEvents = async ({ userId, address, resource, items }) => {
    if (!items.length) return { inserted: 0, maxBlock: 0 };
    const events = items.map((item) => ({
        event_key: robinhoodEventKey(resource, item),
        block_number: finiteBlock(item) || null,
        transaction_hash: transactionHash(item),
        event_timestamp: eventTimestamp(item),
        payload: item,
    }));
    const inserted = await sequelize.query(`
        INSERT INTO robinhood_index_events (
          user_id, wallet_address, resource, event_key, block_number,
          transaction_hash, event_timestamp, payload
        )
        SELECT :userId, :address, :resource, event_key, block_number,
               transaction_hash, event_timestamp, payload
        FROM jsonb_to_recordset(CAST(:events AS jsonb)) AS item(
          event_key TEXT, block_number BIGINT, transaction_hash TEXT,
          event_timestamp TIMESTAMPTZ, payload JSONB
        )
        ON CONFLICT (user_id, wallet_address, resource, event_key) DO NOTHING
        RETURNING event_key
    `, {
        replacements: { userId, address, resource, events: JSON.stringify(events) },
        type: QueryTypes.SELECT,
    });
    return {
        inserted: inserted.length,
        maxBlock: Math.max(0, ...events.map((item) => Number(item.block_number || 0))),
    };
};

const updateState = async ({ userId, address, resource, status, cursor, complete, scanMode = null, maxBlock = 0, error = null }) => {
    await sequelize.query(`
        UPDATE robinhood_index_states
        SET status = :status,
            scan_mode = :scanMode,
            next_page_params = CAST(:cursor AS jsonb),
            backfill_complete = :complete,
            last_indexed_block = GREATEST(last_indexed_block, :maxBlock),
            last_indexed_at = CASE WHEN :status = 'ready' THEN NOW() ELSE last_indexed_at END,
            last_error = :error,
            updated_at = NOW()
        WHERE user_id = :userId AND wallet_address = :address AND resource = :resource
    `, {
        replacements: {
            userId, address, resource, status,
            cursor: cursor ? JSON.stringify(cursor) : null,
            complete, scanMode, maxBlock, error,
        },
    });
};

const indexResource = async ({ userId, address, resource, maxBackfillPages }) => {
    const state = await loadState(userId, address, resource);
    const scanMode = state.backfillComplete ? "incremental" : (state.scanMode || "backfill");
    const backfilling = scanMode === "backfill";
    let cursor = state.backfillComplete ? null : state.nextPageParams;
    let inserted = 0;
    let maxBlock = Number(state.lastIndexedBlock || 0);
    await updateState({ userId, address, resource, status: "indexing", cursor, complete: false, scanMode, maxBlock });
    try {
        const limit = backfilling ? maxBackfillPages : 10;
        for (let page = 0; page < limit; page += 1) {
            const result = await fetchRobinhoodResourcePage(address, resource, { cursor });
            const stored = await storeEvents({ userId, address, resource, items: result.items });
            inserted += stored.inserted;
            maxBlock = Math.max(maxBlock, stored.maxBlock);

            if (backfilling) {
                cursor = result.nextPageParams;
                const complete = !cursor;
                await updateState({
                    userId, address, resource,
                    status: complete ? "ready" : "indexing",
                    cursor, complete, scanMode: complete ? null : "backfill", maxBlock,
                });
                if (complete) return { resource, inserted, complete: true };
                continue;
            }

            // Blockscout returns newest first. Once a whole page already exists
            // locally, every following page is older and the update is done.
            if (!result.nextPageParams || stored.inserted === 0) {
                await updateState({ userId, address, resource, status: "ready", cursor: null, complete: true, scanMode: null, maxBlock });
                return { resource, inserted, complete: true };
            }
            cursor = result.nextPageParams;
        }

        // More than ten entirely new pages is unusual, but can happen after a
        // busy LP session. Persist that continuation just like an initial
        // backfill instead of silently skipping the remaining operations.
        const hasContinuation = Boolean(cursor);
        await updateState({
            userId, address, resource,
            status: hasContinuation ? "indexing" : "ready",
            cursor: hasContinuation ? cursor : null,
            complete: !hasContinuation,
            scanMode: hasContinuation ? scanMode : null,
            maxBlock,
        });
        return { resource, inserted, complete: !hasContinuation };
    } catch (error) {
        await updateState({
            userId, address, resource, status: "failed", cursor,
            complete: Boolean(state.backfillComplete), scanMode, maxBlock, error: error.message,
        });
        throw error;
    }
};

const storeAccountSnapshot = async ({ userId, address, account, tokenBalances }) => {
    await sequelize.query(`
        INSERT INTO robinhood_index_accounts (user_id, wallet_address, account, token_balances)
        VALUES (:userId, :address, CAST(:account AS jsonb), CAST(:tokenBalances AS jsonb))
        ON CONFLICT (user_id, wallet_address) DO UPDATE SET
          account = EXCLUDED.account,
          token_balances = EXCLUDED.token_balances,
          indexed_at = NOW(),
          updated_at = NOW()
    `, {
        replacements: {
            userId, address,
            account: JSON.stringify(account || {}),
            tokenBalances: JSON.stringify(tokenBalances || []),
        },
    });
};

export const seedRobinhoodIndexFromLedgers = async ({ userId, addresses, ledgers }) => {
    if (!Array.isArray(ledgers) || ledgers.length !== addresses.length) return false;
    const initialized = await sequelize.query(`
        SELECT COUNT(*)::int AS count
        FROM robinhood_index_states
        WHERE user_id = :userId
          AND wallet_address IN (:addresses)
          AND backfill_complete = TRUE
    `, { replacements: { userId, addresses: addresses.map(lower) }, type: QueryTypes.SELECT });
    if (Number(initialized[0]?.count || 0) >= addresses.length * RESOURCES.length) return false;

    for (let index = 0; index < addresses.length; index += 1) {
        const address = lower(addresses[index]);
        const ledger = ledgers[index];
        await storeAccountSnapshot({ userId, address, account: ledger.account, tokenBalances: ledger.tokenBalances });
        for (const [resource, items] of [
            ["transactions", ledger.transactions || []],
            ["internal-transactions", ledger.internalTransactions || []],
            ["token-transfers", ledger.tokenTransfers || []],
        ]) {
            await ensureState(userId, address, resource);
            const stored = await storeEvents({ userId, address, resource, items });
            // The old cache fetched ERC-20 transfers and selected v4 NFTs via
            // separate APIs. Keep it visible, but perform one resumable scan of
            // the complete token-transfer stream so older/closed LP NFTs such
            // as a recently retired YARD strategy cannot remain absent.
            const needsCompleteTokenAudit = resource === "token-transfers";
            await updateState({
                userId, address, resource,
                status: needsCompleteTokenAudit ? "pending" : "ready",
                cursor: null,
                complete: !needsCompleteTokenAudit,
                scanMode: needsCompleteTokenAudit ? "backfill" : null,
                maxBlock: stored.maxBlock,
            });
        }
    }
    return true;
};

export const indexRobinhoodWallet = async ({ userId, address, maxBackfillPages = DEFAULT_BACKFILL_PAGES }) => {
    const normalized = lower(address);
    const scope = `${userId}:${normalized}`;
    if (runningScopes.has(scope)) return runningScopes.get(scope);
    const promise = (async () => {
        const snapshot = await fetchRobinhoodAccountSnapshot(normalized);
        await storeAccountSnapshot({ userId, address: normalized, ...snapshot });
        const resources = [];
        for (const resource of RESOURCES) {
            resources.push(await indexResource({ userId, address: normalized, resource, maxBackfillPages }));
        }
        return {
            address: normalized,
            inserted: resources.reduce((sum, item) => sum + item.inserted, 0),
            complete: resources.every((item) => item.complete),
            resources,
        };
    })().finally(() => runningScopes.delete(scope));
    runningScopes.set(scope, promise);
    return promise;
};

export const loadRobinhoodIndexedLedger = async ({ userId, address }) => {
    const normalized = lower(address);
    const [account] = await sequelize.query(`
        SELECT account, token_balances AS "tokenBalances"
        FROM robinhood_index_accounts
        WHERE user_id = :userId AND wallet_address = :address
    `, { replacements: { userId, address: normalized }, type: QueryTypes.SELECT });
    const rows = await sequelize.query(`
        SELECT resource, payload
        FROM robinhood_index_events
        WHERE user_id = :userId AND wallet_address = :address
        ORDER BY block_number ASC NULLS FIRST, event_timestamp ASC NULLS FIRST, id ASC
    `, { replacements: { userId, address: normalized }, type: QueryTypes.SELECT });
    const uniquePayloads = (resource) => [...new Map(
        rows.filter((row) => row.resource === resource)
            .map((row) => [robinhoodEventKey(resource, row.payload), row.payload])
    ).values()];
    return {
        account: account?.account || { coin_balance: "0", exchange_rate: 0 },
        transactions: uniquePayloads("transactions"),
        internalTransactions: uniquePayloads("internal-transactions"),
        tokenTransfers: uniquePayloads("token-transfers"),
        tokenBalances: account?.tokenBalances || [],
        internalTransactionsAvailable: true,
        source: "postgres-incremental-index-v1",
    };
};

export const getRobinhoodIndexStatus = async ({ userId, addresses }) => {
    const normalized = addresses.map(lower);
    if (!normalized.length) return { complete: false, indexing: false, resources: [] };
    const rows = await sequelize.query(`
        SELECT wallet_address AS address, resource, status,
               backfill_complete AS "backfillComplete",
               last_indexed_at AS "lastIndexedAt", last_error AS "lastError"
        FROM robinhood_index_states
        WHERE user_id = :userId AND wallet_address IN (:addresses)
        ORDER BY wallet_address, resource
    `, { replacements: { userId, addresses: normalized }, type: QueryTypes.SELECT });
    const [eventStatus] = await sequelize.query(`
        SELECT MAX(created_at) AS "lastEventAt", COUNT(*)::int AS "eventCount"
        FROM robinhood_index_events
        WHERE user_id = :userId AND wallet_address IN (:addresses)
    `, { replacements: { userId, addresses: normalized }, type: QueryTypes.SELECT });
    const expected = normalized.length * RESOURCES.length;
    return {
        complete: rows.length === expected && rows.every((row) => row.backfillComplete),
        indexing: rows.some((row) => row.status === "indexing") || normalized.some((address) => runningScopes.has(`${userId}:${address}`)),
        lastIndexedAt: rows.map((row) => row.lastIndexedAt).filter(Boolean).sort().at(-1) || null,
        lastEventAt: eventStatus?.lastEventAt || null,
        eventCount: Number(eventStatus?.eventCount || 0),
        lastError: rows.find((row) => row.lastError)?.lastError || null,
        resources: rows,
    };
};

const runScheduledIndex = async () => {
    if (!configuredAddresses.size) return;
    const wallets = await sequelize.query(`
        SELECT DISTINCT user_id AS "userId", LOWER(wallet) AS address
        FROM wallets
        WHERE LOWER(wallet) IN (:addresses)
    `, { replacements: { addresses: [...configuredAddresses] }, type: QueryTypes.SELECT });
    for (const wallet of wallets) {
        try {
            await indexRobinhoodWallet(wallet);
        } catch (error) {
            console.warn(`Robinhood incremental index failed for ${wallet.address.slice(0, 8)}…:`, error.message);
        }
    }
};

export const startRobinhoodIndexer = () => {
    if (!configuredAddresses.size || scheduler) return;
    const scheduleNext = () => {
        scheduler = setTimeout(async () => {
            await runScheduledIndex().catch((error) => console.warn("Robinhood index cycle failed:", error.message));
            scheduleNext();
        }, DEFAULT_INTERVAL_MS);
        scheduler.unref?.();
    };
    // Give the first authenticated dashboard request time to seed the durable
    // index from its last verified cache. This avoids an unnecessary historical
    // backfill immediately after deploying the migration.
    scheduler = setTimeout(async () => {
        await runScheduledIndex().catch((error) => console.warn("Robinhood initial index cycle failed:", error.message));
        scheduleNext();
    }, 15_000);
    scheduler.unref?.();
};
