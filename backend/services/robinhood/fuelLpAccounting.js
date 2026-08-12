const FUEL = "0x6d2758428530b055e06856deff8ffd5d6fd2d5cc";
const CASHCAT = "0x020bfc650a365f8bb26819deaabf3e21291018b4";
const POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7";

const POSITIONS = [
    { id: 460548, feeTier: "0.9%", mint: "0x8b5022ac4aa7b6876e7918f7102a91ebb316feb91fd026a702d9339b44e5873f" },
    { id: 462965, feeTier: "0.3%", mint: "0xfefeeed7f676f1c0a87a3c14ac7b2fa00a4888f7cda882268ea041b20870472a" },
    { id: 464326, feeTier: "0.3%", mint: "0xd8e38b3dcdc658d433461206e8e7229e24c67c824f73ae486f0e998a1012d4ae" },
    { id: 468030, feeTier: "0.25%", mint: "0xfc4c85689f9083d062a405f3fa6ecc87a20d85f6f6000e97cd290d8084de0be8" },
    { id: 470783, feeTier: "0.3%", mint: "0xfbcc92a754e827140a5b00c8858242d99d1b089bc68969662d2e57deb6ad3ecc" },
    { id: 470795, feeTier: "0.25%", mint: "0x5b81630b815883eeb636dbe2d0edb8df485f9188e6c9068ee7d360506091dea6" },
];

const lower = (value) => String(value?.hash || value || "").toLowerCase();
const number = (value) => Number(value || 0);
const tokenAddress = (transfer) => lower(transfer?.token?.address_hash || transfer?.address_hash);
const quantity = (transfer) => number(transfer?.total?.value) / (10 ** number(transfer?.total?.decimals ?? transfer?.token?.decimals));
const hashOf = (transfer) => lower(transfer?.transaction_hash || transfer?.transaction?.hash);

const positionForTransaction = (tx) => {
    const hash = lower(tx?.hash);
    const mint = POSITIONS.find((item) => item.mint === hash);
    if (mint) return mint;
    if (lower(tx?.to) !== POSITION_MANAGER) return null;
    const input = String(tx?.raw_input || tx?.input || tx?.decoded_input?.parameters?.map?.((item) => item.value).join("") || "").toLowerCase();
    return POSITIONS.find((item) => input.includes(BigInt(item.id).toString(16).padStart(64, "0"))) || null;
};

export const buildFuelLpRows = ({ transactions = [], tokenTransfers = [], addresses = [], ethUsd = 0 }) => {
    const tracked = new Set(addresses.map(lower));
    const transfersByHash = new Map();
    const currentPrices = new Map();
    for (const transfer of tokenTransfers) {
        const contract = tokenAddress(transfer);
        if (![FUEL, CASHCAT].includes(contract)) continue;
        const hash = hashOf(transfer);
        if (!transfersByHash.has(hash)) transfersByHash.set(hash, []);
        transfersByHash.get(hash).push(transfer);
        const price = number(transfer?.token?.exchange_rate || transfer?.exchange_rate);
        if (price > 0) currentPrices.set(contract, price);
    }

    const states = new Map(POSITIONS.map((position) => [position.id, {
        ...position,
        deposits: { cashcat: 0, fuel: 0 },
        returns: { cashcat: 0, fuel: 0 },
        gasEth: 0,
        operationCount: 0,
        firstTimestamp: null,
        lastTimestamp: null,
        lastOperation: null,
    }]));

    for (const tx of transactions) {
        const position = positionForTransaction(tx);
        if (!position) continue;
        const state = states.get(position.id);
        const transfers = transfersByHash.get(lower(tx.hash)) || [];
        if (!transfers.some((item) => [FUEL, CASHCAT].includes(tokenAddress(item)))) continue;
        state.operationCount += 1;
        const timestamp = tx.timestamp || transfers[0]?.timestamp || null;
        if (timestamp && (!state.firstTimestamp || timestamp < state.firstTimestamp)) state.firstTimestamp = timestamp;
        const operation = { deposited: { cashcat: 0, fuel: 0 }, returned: { cashcat: 0, fuel: 0 } };
        if (tracked.has(lower(tx.from))) state.gasEth += number(tx?.fee?.value ?? tx?.fee) / 1e18;
        for (const transfer of transfers) {
            const contract = tokenAddress(transfer);
            const key = contract === FUEL ? "fuel" : contract === CASHCAT ? "cashcat" : null;
            if (!key) continue;
            const amount = quantity(transfer);
            const fromTracked = tracked.has(lower(transfer.from));
            const toTracked = tracked.has(lower(transfer.to));
            if (fromTracked && !toTracked) {
                state.deposits[key] += amount;
                operation.deposited[key] += amount;
            }
            if (toTracked && !fromTracked) {
                state.returns[key] += amount;
                operation.returned[key] += amount;
            }
        }
        if (timestamp && (!state.lastTimestamp || timestamp > state.lastTimestamp)) {
            state.lastTimestamp = timestamp;
            state.lastOperation = operation;
        }
    }

    const cashcatPrice = currentPrices.get(CASHCAT) || 0;
    const fuelPrice = currentPrices.get(FUEL) || 0;
    return [...states.values()].filter((state) => state.operationCount > 0).map((state) => {
        const depositedUsd = state.deposits.cashcat * cashcatPrice + state.deposits.fuel * fuelPrice;
        const returnedUsd = state.returns.cashcat * cashcatPrice + state.returns.fuel * fuelPrice;
        const gasUsd = state.gasEth * ethUsd;
        const pnlUsd = returnedUsd - depositedUsd - gasUsd;
        const priced = cashcatPrice > 0 && fuelPrice > 0 && ethUsd > 0;
        return {
            contract: `fuel-lp:${state.id}`,
            symbol: `LP #${state.id}`,
            name: `CASHCAT/FUEL · ${state.feeTier}`,
            classification: "developer-lp",
            tags: ["DEV", "LP", state.feeTier],
            excludeFromSummary: true,
            manuallyClosed: true,
            quantityBought: 1,
            quantitySold: 1,
            ethInvested: priced ? depositedUsd / ethUsd : 0,
            ethReceived: priced ? returnedUsd / ethUsd : 0,
            walletBalance: 0,
            attributableBalance: 0,
            currentUsdPrice: 0,
            realizedPnlEth: priced ? pnlUsd / ethUsd : 0,
            realizedPnlUsd: priced ? pnlUsd : 0,
            remainingCostBasis: 0,
            currentValueEth: 0,
            currentValueUsd: 0,
            unrealizedPnlEth: 0,
            unrealizedPnlUsd: 0,
            totalPnlEth: priced ? pnlUsd / ethUsd : null,
            totalPnlUsd: priced ? pnlUsd : null,
            returnPercentage: priced && depositedUsd > 0 ? pnlUsd / depositedUsd * 100 : null,
            pricingStatus: priced ? "Priced" : "Unpriced",
            lpAccounting: {
                positionId: state.id,
                pair: "CASHCAT/FUEL",
                feeTier: state.feeTier,
                status: "closed",
                operationCount: state.operationCount,
                firstTimestamp: state.firstTimestamp,
                lastTimestamp: state.lastTimestamp,
                lastOperation: state.lastOperation,
                deposited: state.deposits,
                returnedIncludingFees: state.returns,
                depositedValueUsdAtExitPrices: priced ? depositedUsd : null,
                returnedValueUsdAtExitPrices: priced ? returnedUsd : null,
                gasEth: state.gasEth,
                gasUsd: priced ? gasUsd : null,
                pnlIncludingFeesAndIlUsd: priced ? pnlUsd : null,
                feeAndIlSeparation: "combined",
                valuationBasis: "current-exit-prices",
                note: "P&L compares the deposited and returned token baskets at the same current prices. It includes fees and impermanent loss, but does not invent a separate fee/IL split without historical pool snapshots.",
            },
        };
    });
};

export const fuelLpConstants = { FUEL, CASHCAT, POSITION_MANAGER, POSITIONS };
