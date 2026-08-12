const API_BASE = "https://robinhoodchain.blockscout.com/api/v2";
const LEGACY_API_BASE = "https://robinhoodchain.blockscout.com/api";
const ROBINHOOD_RPC_URL = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const MAX_PAGES = 500;
const LEGACY_PAGE_SIZE = 1_000;
// Blockscout allows a larger compatibility-API page, but 10,000-record
// responses can time out on public instances. Historical GMGN test wallets
// are intentionally bounded to a compact one-request archive instead.
const LEGACY_AUDIT_PAGE_SIZE = 1_000;
const UNISWAP_V4_POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
// The public Robinhood Blockscout instance rate-limits bursty parallel calls.
// Keep one small, process-wide request queue so a ledger scan can complete
// steadily instead of repeatedly failing and restarting from the first page.
// The public Robinhood Blockscout instance often rejects sustained ~1 req/s
// bursts. A modest default pace keeps normal cached reads responsive while
// making explicit historical backfills much more likely to finish.
const configuredInterval = Number(process.env.ROBINHOOD_BLOCKSCOUT_MIN_REQUEST_INTERVAL_MS || 1_500);
const MIN_REQUEST_INTERVAL_MS = Number.isFinite(configuredInterval)
    ? Math.max(1_000, configuredInterval)
    : 1_500;
let nextRequestAt = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForRequestSlot = async () => {
    const now = Date.now();
    const requestAt = Math.max(now, nextRequestAt);
    nextRequestAt = requestAt + MIN_REQUEST_INTERVAL_MS;
    if (requestAt > now) await wait(requestAt - now);
};

const fetchJson = async (url, attempt = 0, maxRetries = 8, timeoutMs = 30_000, maxBackoffMs = 30_000) => {
    await waitForRequestSlot();
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
    });

    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        const delayMs = Math.min(
            maxBackoffMs,
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? retryAfterSeconds * 1_000
                : 2_000 * 2 ** attempt
        );
        // Reserve the cooldown for calls which reached the queue before this
        // response, too. Otherwise one rejected call causes another burst.
        nextRequestAt = Math.max(nextRequestAt, Date.now() + delayMs);
        await wait(delayMs);
        return fetchJson(url, attempt + 1, maxRetries, timeoutMs, maxBackoffMs);
    }
    if (!response.ok) {
        throw new Error(`Blockscout request failed (${response.status})`);
    }
    return response.json();
};
const paginatedAddressResource = async (address, resource, { maxRetries = 2, query: initialQuery = {} } = {}) => {
    const items = [];
    let nextPageParams = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const query = new URLSearchParams({ ...initialQuery, ...(nextPageParams || {}) });
        const suffix = query.size ? `?${query.toString()}` : "";
        const payload = await fetchJson(`${API_BASE}/addresses/${address}/${resource}${suffix}`, 0, maxRetries);
        if (!Array.isArray(payload?.items)) {
            throw new Error(`Unexpected Blockscout ${resource} response`);
        }
        items.push(...payload.items);
        nextPageParams = payload.next_page_params;
        if (!nextPageParams) return items;
    }

    throw new Error(`Blockscout ${resource} pagination exceeded ${MAX_PAGES} pages`);
};

// Keep only accounting fields from the v2 transfer response. Token-instance
// payloads can contain large embedded artwork and are unnecessary for the
// lifecycle ledger/cache.
const compactV2TokenTransfer = (item) => ({
    transaction_hash: item?.transaction_hash || item?.transaction?.hash,
    log_index: item?.log_index,
    timestamp: item?.timestamp,
    from: item?.from ? { hash: item.from.hash } : null,
    to: item?.to ? { hash: item.to.hash } : null,
    token_type: item?.token_type || item?.token?.type,
    token: {
        address_hash: item?.token?.address_hash || item?.token?.address,
        symbol: item?.token?.symbol,
        name: item?.token?.name,
        decimals: item?.token?.decimals,
        exchange_rate: item?.token?.exchange_rate,
    },
    total: {
        value: item?.total?.value,
        decimals: item?.total?.decimals ?? item?.token?.decimals,
        token_id: item?.total?.token_id ?? item?.token_id,
    },
    token_id: item?.token_id ?? item?.total?.token_id,
});

export const fetchRobinhoodResourcePage = async (
    address,
    resource,
    { cursor = null, query: initialQuery = {}, maxRetries = 8 } = {}
) => {
    const query = new URLSearchParams({ ...initialQuery, ...(cursor || {}) });
    const suffix = query.size ? `?${query.toString()}` : "";
    const payload = await fetchJson(`${API_BASE}/addresses/${address}/${resource}${suffix}`, 0, maxRetries);
    if (!Array.isArray(payload?.items)) {
        throw new Error(`Unexpected Blockscout ${resource} response`);
    }
    return {
        items: resource === "token-transfers"
            ? payload.items.map(compactV2TokenTransfer)
            : payload.items,
        nextPageParams: payload.next_page_params || null,
    };
};

export const fetchRobinhoodAccountSnapshot = async (address) => {
    const account = await fetchJson(`${API_BASE}/addresses/${address}`);
    const balances = await fetchJson(`${API_BASE}/addresses/${address}/token-balances`);
    return {
        account,
        tokenBalances: Array.isArray(balances) ? balances : balances?.items || [],
    };
};

const legacyTokenTransfers = async (address, { pageSize = LEGACY_PAGE_SIZE } = {}) => {
    const transfers = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const query = new URLSearchParams({
            module: "account", action: "tokentx", address,
            page: String(page), offset: String(pageSize), sort: "asc",
        });
        const payload = await fetchJson(`${LEGACY_API_BASE}?${query.toString()}`);
        const items = Array.isArray(payload?.result) ? payload.result : [];
        transfers.push(...items.map((item) => ({
            transaction_hash: item.hash,
            log_index: item.logIndex,
            timestamp: item.timeStamp ? new Date(Number(item.timeStamp) * 1000).toISOString() : null,
            from: { hash: item.from },
            to: { hash: item.to },
            token_type: "ERC-20",
            token: { address_hash: item.contractAddress, symbol: item.tokenSymbol, name: item.tokenName, decimals: item.tokenDecimal },
            total: { value: item.value, decimals: item.tokenDecimal },
        })));
        if (items.length < pageSize) return transfers;
    }
    throw new Error(`Legacy Blockscout token-transfer pagination exceeded ${MAX_PAGES} pages`);
};

const legacyInternalTransactions = async (address, { pageSize = LEGACY_PAGE_SIZE } = {}) => {
    const transactions = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const query = new URLSearchParams({
            module: "account", action: "txlistinternal", address,
            page: String(page), offset: String(pageSize), sort: "asc",
        });
        const payload = await fetchJson(`${LEGACY_API_BASE}?${query.toString()}`, 0, 5);
        const items = Array.isArray(payload?.result) ? payload.result : [];
        transactions.push(...items.map(normalizeLegacyInternalTransaction));
        if (items.length < pageSize) return transactions;
    }
    throw new Error(`Legacy internal transaction pagination exceeded ${MAX_PAGES} pages`);
};

// The legacy compatibility endpoints are used only for the explicit historical
// audit, so retired GMGN wallets do not generate hundreds of V2 pagination
// calls or touch paid providers. Reaching the cap fails safely instead of
// silently producing an incomplete history.
const legacyAddressResource = async (
    address,
    action,
    { pageSize = LEGACY_AUDIT_PAGE_SIZE, maxRetries = 8, timeoutMs = 30_000, maxBackoffMs = 30_000 } = {}
) => {
    const query = new URLSearchParams({
        module: "account",
        action,
        address,
        page: "1",
        offset: String(pageSize),
        sort: "asc",
    });
    const payload = await fetchJson(`${LEGACY_API_BASE}?${query.toString()}`, 0, maxRetries, timeoutMs, maxBackoffMs);
    const items = Array.isArray(payload?.result) ? payload.result : [];
    if (items.length >= pageSize) {
        throw new Error(`Historical ${action} ledger reached the ${pageSize.toLocaleString()} item safety limit`);
    }
    return items;
};

const legacyTimestamp = (value) => value ? new Date(Number(value) * 1_000).toISOString() : null;
const legacyFeeWei = (item) => {
    try {
        return (BigInt(item?.gasUsed || 0) * BigInt(item?.gasPrice || 0)).toString();
    } catch {
        return "0";
    }
};

const normalizeLegacyTransaction = (item) => ({
    hash: item.hash,
    from: { hash: item.from },
    to: item.to ? { hash: item.to } : null,
    value: item.value || "0",
    fee: { value: legacyFeeWei(item) },
    status: String(item.isError || "0") === "0" ? "ok" : "error",
    result: String(item.isError || "0") === "0" ? "success" : "error",
    timestamp: legacyTimestamp(item.timeStamp),
});

const normalizeLegacyInternalTransaction = (item) => ({
    transaction_hash: item.hash || item.transactionHash,
    from: { hash: item.from },
    to: { hash: item.to },
    value: item.value || "0",
    success: String(item.isError || "0") === "0",
    timestamp: legacyTimestamp(item.timeStamp),
});

const normalizeLegacyTokenTransfer = (item) => ({
    transaction_hash: item.hash,
    log_index: item.logIndex,
    timestamp: legacyTimestamp(item.timeStamp),
    from: { hash: item.from },
    to: { hash: item.to },
    token_type: "ERC-20",
    token: {
        address_hash: item.contractAddress,
        symbol: item.tokenSymbol,
        name: item.tokenName,
        decimals: item.tokenDecimal,
    },
    total: { value: item.value, decimals: item.tokenDecimal },
});

const rpcBalanceFallback = async (address, transactions) => {
    const candidates = transactions.filter((transaction) => {
        const to = String(transaction?.to?.hash || transaction?.to || "").toLowerCase();
        const block = Number(transaction?.block_number ?? transaction?.blockNumber);
        return to === UNISWAP_V4_POSITION_MANAGER && Number.isInteger(block) && block > 0;
    });
    if (!candidates.length) return [];

    const requests = candidates.flatMap((transaction, index) => {
        const block = Number(transaction.block_number ?? transaction.blockNumber);
        return [
            { jsonrpc: "2.0", id: index * 2, method: "eth_getBalance", params: [address, `0x${(block - 1).toString(16)}`] },
            { jsonrpc: "2.0", id: index * 2 + 1, method: "eth_getBalance", params: [address, `0x${block.toString(16)}`] },
        ];
    });
    const response = await fetch(ROBINHOOD_RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requests),
        signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Robinhood RPC balance fallback failed (${response.status})`);
    const payload = await response.json();
    const byId = new Map((Array.isArray(payload) ? payload : []).map((item) => [Number(item.id), item.result]));
    const recovered = [];
    for (const [index, transaction] of candidates.entries()) {
        const beforeHex = byId.get(index * 2);
        const afterHex = byId.get(index * 2 + 1);
        if (!beforeHex || !afterHex) continue;
        const sent = BigInt(transaction?.value || 0);
        const fee = BigInt((transaction?.fee?.value ?? transaction?.fee) || 0);
        const nativeReturn = BigInt(afterHex) - BigInt(beforeHex) + sent + fee;
        if (nativeReturn <= 0n) continue;
        recovered.push({
            transaction_hash: transaction.hash,
            from: { hash: UNISWAP_V4_POSITION_MANAGER },
            to: { hash: address },
            value: nativeReturn.toString(),
            success: true,
            timestamp: transaction.timestamp || null,
            source: "rpc-wallet-balance-delta",
        });
    }
    return recovered;
};

export const fetchRobinhoodAccount = async (address) =>
    fetchJson(`${API_BASE}/addresses/${address}`);

export const fetchRobinhoodWalletLedger = async (address, { accountOverride = null } = {}) => {
    let internalTransactionsAvailable = true;
    const [account, transactions, internalResult, erc20Transfers, v4PositionTransfers, tokenBalances] = await Promise.all([
        accountOverride ? Promise.resolve(accountOverride) : fetchJson(`${API_BASE}/addresses/${address}`),
        paginatedAddressResource(address, "transactions", { maxRetries: 8 }),
        paginatedAddressResource(address, "internal-transactions", { maxRetries: 8 }).catch(async (error) => {
            console.warn("Robinhood v2 internal transactions unavailable; trying legacy fallback:", error.message);
            try {
                return await legacyInternalTransactions(address);
            } catch (fallbackError) {
                console.warn("Robinhood internal transaction fallback unavailable:", fallbackError.message);
                return null;
            }
        }),
        legacyTokenTransfers(address),
        paginatedAddressResource(address, "token-transfers", {
            maxRetries: 8,
            query: { type: "ERC-721", token: UNISWAP_V4_POSITION_MANAGER },
        }).then((items) => items.map(compactV2TokenTransfer)),
        accountOverride ? Promise.resolve([]) : fetchJson(`${API_BASE}/addresses/${address}/token-balances`),
    ]);

    let internalTransactions = internalResult;
    if (internalTransactions == null) {
        try {
            internalTransactions = await rpcBalanceFallback(address, transactions);
            console.warn(`Recovered ${internalTransactions.length} LP native returns from Robinhood RPC balance deltas.`);
        } catch (rpcError) {
            internalTransactionsAvailable = false;
            internalTransactions = [];
            console.warn("Robinhood RPC balance fallback unavailable:", rpcError.message);
        }
    }

    return {
        account,
        transactions,
        internalTransactions,
        tokenTransfers: [...erc20Transfers, ...v4PositionTransfers],
        tokenBalances: Array.isArray(tokenBalances) ? tokenBalances : tokenBalances?.items || [],
        internalTransactionsAvailable,
    };
};

export const fetchRobinhoodHistoricalWalletLedger = async (address) => {
    // The legacy compatibility API is frequently rate-limited even when v2 is
    // healthy. This one-time archive uses the canonical paginated v2 streams
    // and keeps them sequential so retries cannot create a request burst.
    const historicalRequest = { maxRetries: 8 };
    const transactions = await paginatedAddressResource(address, "transactions", historicalRequest);
    const tokenTransfers = await paginatedAddressResource(address, "token-transfers", historicalRequest);
    const internalTransactions = await paginatedAddressResource(address, "internal-transactions", historicalRequest);

    return {
        account: { coin_balance: "0", exchange_rate: 0 },
        transactions,
        internalTransactions,
        tokenTransfers,
        tokenBalances: [],
        internalTransactionsAvailable: true,
        source: "blockscout-v2-paginated-static-v1",
    };
};

export const fetchRobinhoodTokenBalance = async (address, tokenAddress) => {
    const balances = await fetchJson(`${API_BASE}/addresses/${address}/token-balances`);
    const items = Array.isArray(balances) ? balances : balances?.items || [];
    const normalizedToken = String(tokenAddress || "").toLowerCase();
    return items.find((item) => String(item?.token?.address || item?.token?.address_hash || "").toLowerCase() === normalizedToken) || null;
};
