const API_BASE = "https://robinhoodchain.blockscout.com/api/v2";
const MAX_PAGES = 500;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, attempt = 0) => {
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
    });

    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await wait(350 * (attempt + 1));
        return fetchJson(url, attempt + 1);
    }
    if (!response.ok) {
        throw new Error(`Blockscout request failed (${response.status})`);
    }
    return response.json();
};
const paginatedAddressResource = async (address, resource) => {
    const items = [];
    let nextPageParams = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const query = new URLSearchParams(nextPageParams || {});
        const suffix = query.size ? `?${query.toString()}` : "";
        const payload = await fetchJson(`${API_BASE}/addresses/${address}/${resource}${suffix}`);
        if (!Array.isArray(payload?.items)) {
            throw new Error(`Unexpected Blockscout ${resource} response`);
        }
        items.push(...payload.items);
        nextPageParams = payload.next_page_params;
        if (!nextPageParams) return items;
    }

    throw new Error(`Blockscout ${resource} pagination exceeded ${MAX_PAGES} pages`);
};

export const fetchRobinhoodWalletLedger = async (address) => {
    const [account, transactions, internalTransactions, tokenTransfers, tokenBalances] = await Promise.all([
        fetchJson(`${API_BASE}/addresses/${address}`),
        paginatedAddressResource(address, "transactions"),
        paginatedAddressResource(address, "internal-transactions"),
        paginatedAddressResource(address, "token-transfers"),
        fetchJson(`${API_BASE}/addresses/${address}/token-balances`),
    ]);

    return {
        account,
        transactions,
        internalTransactions,
        tokenTransfers,
        tokenBalances: Array.isArray(tokenBalances) ? tokenBalances : tokenBalances?.items || [],
    };
};
