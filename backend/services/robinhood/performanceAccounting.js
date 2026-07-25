const WEI_PER_ETH = 10n ** 18n;
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const UNIVERSAL_SPOKE_POOL = "0xd29c85f15df544ba632c9e25829fd29d767d7978";
// Blockscout's paginated transfer history can retain an apparent balance after
// a position has been fully disposed. These user-confirmed exits remain part
// of realized accounting, but must not be presented as open holdings.
const CONFIRMED_CLOSED_POSITIONS = new Set([
    "0x8c515613d4910a989d1465f931bb5004b42cccf7", // $1
    "0x470b0859ebf4f9c8927873144f06c3cf8a92c7a0", // UN3D
    "0xf9f9ddd944b96210bd80e5f64df7d6b20e806e80", // SCALE
    "0xd015f032841ccae428fc3c4be770abe107207777",  // un1
    "0x9a268e5c5b5c13d5e8036df7ad35d7d64cfc18b0", // 0
    "0xee9b9942d33c024da9b410c438f7e97a234f64b8", // JERK
]);

const lower = (value) => String(value || "").toLowerCase();
const addressOf = (value) => lower(value?.hash || value);
const bigint = (value) => {
    try { return BigInt(value || 0); } catch { return 0n; }
};
const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const weiToEth = (value) => Number(value) / 1e18;
const units = (raw, decimals) => Number(raw) / 10 ** Number(decimals || 0);
const sumWei = (values) => values.reduce((sum, value) => sum + bigint(value), 0n);
const txTimestamp = (tx, related = []) => tx?.timestamp || related.find((item) => item?.timestamp)?.timestamp || null;
const isSuccess = (tx) => !tx || tx.status === "ok" || tx.result === "success";
const isNft = (transfer) => transfer?.token_type === "ERC-721" || transfer?.token_type === "ERC-1155";
const isExternalDestination = (tx) => {
    if (tx?.to?.is_contract === false) return true;
    const destination = lower(`${tx?.to?.name || ""} ${tx?.to?.implementations?.[0]?.name || ""} ${tx?.method || ""}`);
    return /bridge|spokepool/.test(destination);
};

const transferQuantity = (transfer) => {
    if (isNft(transfer)) return number(transfer.total?.value || 1);
    return units(transfer.total?.value, transfer.total?.decimals ?? transfer.token?.decimals);
};

const tokenKey = (transfer) => lower(transfer?.token?.address_hash);

const groupByHash = (items, field = "transaction_hash") => {
    const grouped = new Map();
    for (const item of items || []) {
        const hash = lower(item?.[field] || item?.hash);
        if (!hash) continue;
        if (!grouped.has(hash)) grouped.set(hash, []);
        grouped.get(hash).push(item);
    }
    return grouped;
};

const aggregateTransfers = (transfers) => {
    const byContract = new Map();
    for (const transfer of transfers) {
        const contract = tokenKey(transfer);
        if (!contract) continue;
        const current = byContract.get(contract) || {
            contract,
            symbol: transfer.token?.symbol || "?",
            name: transfer.token?.name || transfer.token?.symbol || "Unknown token",
            tokenType: transfer.token_type || transfer.token?.type || "ERC-20",
            quantity: 0,
            tokenIds: [],
            currentUsdPrice: number(transfer.token?.exchange_rate) || null,
        };
        current.quantity += transferQuantity(transfer);
        if (transfer.token?.exchange_rate) current.currentUsdPrice = number(transfer.token.exchange_rate);
        const tokenId = transfer.total?.token_id ?? transfer.token_id;
        if (tokenId != null) current.tokenIds.push(String(tokenId));
        byContract.set(contract, current);
    }
    return [...byContract.values()];
};

const makeExplorerUrl = (hash) => `https://robinhoodchain.blockscout.com/tx/${hash}`;

const allocateFifo = (purchases, sales) => {
    const pool = [];
    const events = [
        ...sales.map((sale) => ({ type: "sale", timestamp: sale.timestamp, item: sale })),
        ...purchases.map((purchase) => ({ type: "purchase", timestamp: purchase.timestamp, item: purchase })),
    ].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)) || (a.type === "sale" ? -1 : 1));

    for (const event of events) {
        if (event.type === "sale") {
            const lot = { sale: event.item, remaining: event.item.ethReceived };
            pool.push(lot);
            continue;
        }

        let needed = event.item.ethSpent;
        let recycled = 0;
        for (const lot of pool) {
            if (needed <= 0 || lot.remaining <= 0) continue;
            const used = Math.min(needed, lot.remaining);
            lot.remaining -= used;
            lot.sale.amountReinvested += used;
            needed -= used;
            recycled += used;
        }
        event.item.recycledSaleProceeds = recycled;
        event.item.externalBaseFunding = Math.max(0, event.item.ethSpent - recycled);
    }

    for (const sale of sales) {
        sale.amountUnspent = Math.max(0, sale.ethReceived - sale.amountReinvested);
        sale.reinvestmentStatus = sale.amountUnspent < 1e-12
            ? "Fully reinvested"
            : sale.amountReinvested > 0 ? "Partially reinvested" : "Unspent";
    }
};

const buildTokenPnl = ({ purchases, sales, otherOutflows, externalOutflows, ledgerBalances, prices, ethUsd }) => {
    const positions = new Map();
    const ensure = (token) => {
        if (!positions.has(token.contract)) {
            positions.set(token.contract, {
                contract: token.contract,
                symbol: token.symbol,
                name: token.name,
                quantityBought: 0,
                ethInvested: 0,
                quantitySold: 0,
                ethReceived: 0,
                otherOutflowQuantity: 0,
                costBasisSold: 0,
                otherOutflowCost: 0,
                externalOutflowQuantity: 0,
                externalOutflowCost: 0,
                inventoryQuantity: 0,
                inventoryCost: 0,
            });
        }
        return positions.get(token.contract);
    };

    const events = [
        ...purchases.filter((item) => item.tokenType === "ERC-20").map((item) => ({ type: "purchase", timestamp: item.timestamp, item })),
        ...sales.map((item) => ({ type: "sale", timestamp: item.timestamp, item })),
        ...otherOutflows.map((item) => ({ type: "outflow", timestamp: item.timestamp, item })),
        ...externalOutflows.map((item) => ({ type: "externalOutflow", timestamp: item.timestamp, item })),
    ].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

    for (const event of events) {
        const position = ensure(event.item);
        if (event.type === "purchase") {
            position.quantityBought += event.item.quantityReceived;
            position.ethInvested += event.item.ethSpent;
            position.inventoryQuantity += event.item.quantityReceived;
            position.inventoryCost += event.item.ethSpent;
            continue;
        }

        const quantity = event.type === "sale" ? event.item.quantitySold : event.item.quantity;
        const averageInventoryCost = position.inventoryQuantity > 0
            ? position.inventoryCost / position.inventoryQuantity
            : 0;
        const allocatedQuantity = Math.min(quantity, Math.max(0, position.inventoryQuantity));
        const allocatedCost = allocatedQuantity * averageInventoryCost;
        position.inventoryQuantity = Math.max(0, position.inventoryQuantity - allocatedQuantity);
        position.inventoryCost = Math.max(0, position.inventoryCost - allocatedCost);

        if (event.type === "sale") {
            position.quantitySold += quantity;
            position.ethReceived += event.item.ethReceived;
            position.costBasisSold += allocatedCost;
        } else if (event.type === "outflow") {
            position.otherOutflowQuantity += quantity;
            position.otherOutflowCost += allocatedCost;
        } else {
            position.externalOutflowQuantity += quantity;
            position.externalOutflowCost += allocatedCost;
        }
    }

    return [...positions.values()].map((position) => {
        const averageCost = position.quantityBought > 0 ? position.ethInvested / position.quantityBought : 0;
        const walletBalance = Math.max(0, ledgerBalances.get(position.contract) || 0);
        const purchasedRemaining = Math.max(0, position.quantityBought - position.quantitySold);
        const attributableBalance = Math.min(walletBalance, purchasedRemaining);
        const remainingCostBasis = position.inventoryCost;
        const currentUsdPrice = prices.get(position.contract) || null;
        const priced = currentUsdPrice != null && currentUsdPrice > 0 && ethUsd > 0;
        const currentValueUsd = priced ? attributableBalance * currentUsdPrice : null;
        const currentValueEth = priced ? currentValueUsd / ethUsd : null;
        // Purchased tokens transferred out without ETH proceeds are realized
        // at zero value, while still surfaced separately for transparency.
        const realizedPnlEth = position.ethReceived - position.costBasisSold - position.otherOutflowCost;
        const unrealizedPnlEth = priced ? currentValueEth - remainingCostBasis : null;
        const totalPnlEth = priced ? realizedPnlEth + unrealizedPnlEth : null;
        const returnPercentage = priced && position.ethInvested > 0 ? totalPnlEth / position.ethInvested * 100 : null;

        return {
            ...position,
            manuallyClosed: CONFIRMED_CLOSED_POSITIONS.has(position.contract),
            averageCostEth: averageCost,
            walletBalance,
            attributableBalance,
            currentUsdPrice,
            realizedPnlEth,
            realizedPnlUsd: realizedPnlEth * ethUsd,
            remainingCostBasis,
            currentValueEth,
            currentValueUsd,
            unrealizedPnlEth,
            unrealizedPnlUsd: unrealizedPnlEth == null ? null : unrealizedPnlEth * ethUsd,
            totalPnlEth,
            totalPnlUsd: totalPnlEth == null ? null : totalPnlEth * ethUsd,
            returnPercentage,
            pricingStatus: priced ? "Priced" : "Unpriced",
        };
    }).sort((a, b) => (b.currentValueUsd || -1) - (a.currentValueUsd || -1));
};

export const calculateRobinhoodPerformance = ({ address, account, transactions, internalTransactions, tokenTransfers, tokenBalances }) => {
    const wallet = lower(address);
    const ethUsd = number(account?.exchange_rate);
    const txByHash = new Map((transactions || []).map((tx) => [lower(tx.hash), tx]));
    const internalsByHash = groupByHash(internalTransactions);
    const transfersByHash = groupByHash(tokenTransfers);
    const allHashes = new Set([...txByHash.keys(), ...internalsByHash.keys(), ...transfersByHash.keys()]);
    const ledgerBalances = new Map();
    const prices = new Map();

    for (const transfer of tokenTransfers || []) {
        const key = tokenKey(transfer);
        if (!key) continue;
        const quantity = transferQuantity(transfer);
        const direction = addressOf(transfer.to) === wallet ? 1 : addressOf(transfer.from) === wallet ? -1 : 0;
        ledgerBalances.set(key, (ledgerBalances.get(key) || 0) + direction * quantity);
        const price = number(transfer.token?.exchange_rate);
        if (price > 0) prices.set(key, price);
    }
    for (const balance of tokenBalances || []) {
        const key = lower(balance.token?.address_hash || balance.address_hash);
        const price = number(balance.token?.exchange_rate || balance.exchange_rate);
        if (key && price > 0) prices.set(key, price);
    }

    let directFundingWei = 0n;
    let bridgeFundingWei = 0n;
    let nativeOutflowWei = 0n;
    let gasWei = 0n;
    let otherRefundWei = 0n;
    let nftAndAppSpendingWei = 0n;
    let externalNativeOutflowWei = 0n;
    let externalTokenOutflowEth = 0;
    const purchases = [];
    const sales = [];
    const saleTxHashes = new Set();
    const otherOutflows = [];
    const externalOutflows = [];

    for (const hash of allHashes) {
        const tx = txByHash.get(hash);
        const internals = internalsByHash.get(hash) || [];
        const transfers = transfersByHash.get(hash) || [];
        if (!isSuccess(tx)) continue;
        const fromWallet = addressOf(tx?.from) === wallet;
        const toWallet = addressOf(tx?.to) === wallet;
        const txValueWei = bigint(tx?.value);
        if (fromWallet) {
            nativeOutflowWei += txValueWei;
            gasWei += bigint(tx?.fee?.value ?? tx?.fee);
        }
        if (toWallet && !fromWallet && txValueWei > 0n) directFundingWei += txValueWei;

        const incomingInternal = internals.filter((item) => item.success !== false && addressOf(item.to) === wallet && addressOf(item.from) !== wallet);
        const bridgeInternals = incomingInternal.filter((item) => {
            const from = addressOf(item.from);
            const name = lower(item.from?.name || item.from?.implementations?.[0]?.name);
            return from === UNIVERSAL_SPOKE_POOL || name.includes("spokepool");
        });
        bridgeFundingWei += sumWei(bridgeInternals.map((item) => item.value));

        const incoming = transfers.filter((item) => addressOf(item.to) === wallet && addressOf(item.from) !== wallet);
        const outgoing = transfers.filter((item) => addressOf(item.from) === wallet && addressOf(item.to) !== wallet);
        const outgoingErc20 = outgoing.filter((item) => !isNft(item) && tokenKey(item) !== WETH);
        const saleReceiptWei = sumWei(incomingInternal.filter((item) => !bridgeInternals.includes(item)).map((item) => item.value));

        if (outgoingErc20.length && saleReceiptWei > 0n) {
            const sold = aggregateTransfers(outgoingErc20);
            const totalUnits = sold.reduce((sum, token) => sum + token.quantity, 0) || 1;
            for (const token of sold) {
                const share = token.quantity / totalUnits;
                sales.push({
                    hash,
                    transactionUrl: makeExplorerUrl(hash),
                    timestamp: txTimestamp(tx, internals),
                    contract: token.contract,
                    symbol: token.symbol,
                    name: token.name,
                    quantitySold: token.quantity,
                    ethReceived: weiToEth(saleReceiptWei) * share,
                    usdReceived: weiToEth(saleReceiptWei) * share * ethUsd,
                    gasEth: weiToEth(bigint(tx?.fee?.value ?? tx?.fee)),
                    amountReinvested: 0,
                    amountUnspent: 0,
                    reinvestmentStatus: "Unspent",
                });
            }
            saleTxHashes.add(hash);
        }

        const wethOutWei = outgoing
            .filter((item) => tokenKey(item) === WETH)
            .reduce((sum, item) => sum + bigint(item.total?.value), 0n);
        const spendWei = txValueWei > wethOutWei ? txValueWei : wethOutWei;
        const nonWethIncoming = incoming.filter((item) => tokenKey(item) !== WETH);
        const targets = aggregateTransfers(nonWethIncoming);
        // A launch with no asset returned to MM was launched for another wallet.
        // Count that value as leaving the portfolio, alongside ordinary direct
        // transfers and bridge-outs. Do not treat incomplete swap indexing as a
        // withdrawal merely because WETH moved to a pool.
        const externalLaunch = lower(tx?.method) === "launchtoken" && txValueWei > 0n && targets.length === 0;
        const externalWithdrawal = fromWallet
            && saleReceiptWei === 0n
            && targets.length === 0
            && (externalLaunch || isExternalDestination(tx));
        if (externalWithdrawal) {
            externalNativeOutflowWei += txValueWei;
            const withdrawnTokens = aggregateTransfers(outgoing.filter((item) => !isNft(item)));
            externalOutflows.push(...withdrawnTokens.map((outflow) => ({
                ...outflow,
                timestamp: txTimestamp(tx, transfers),
                hash,
            })));
            externalTokenOutflowEth += withdrawnTokens.reduce((sum, token) => {
                const usdValue = token.currentUsdPrice ? token.quantity * token.currentUsdPrice : 0;
                return sum + (ethUsd > 0 ? usdValue / ethUsd : 0);
            }, 0);
        }
        if (fromWallet && spendWei > 0n && targets.length) {
            const targetTotal = targets.reduce((sum, token) => sum + token.quantity, 0) || 1;
            for (const token of targets) {
                const share = token.quantity / targetTotal;
                const ethSpent = weiToEth(spendWei) * share;
                const category = token.tokenType === "ERC-20" ? "Token purchase" : "NFT purchase";
                purchases.push({
                    hash,
                    transactionUrl: makeExplorerUrl(hash),
                    timestamp: txTimestamp(tx, transfers),
                    category,
                    contract: token.contract,
                    symbol: token.symbol,
                    name: token.name,
                    tokenType: token.tokenType,
                    tokenIds: token.tokenIds,
                    quantityReceived: token.quantity,
                    ethSpent,
                    usdValue: ethSpent * ethUsd,
                    gasEth: weiToEth(bigint(tx?.fee?.value ?? tx?.fee)),
                    effectiveUsdCost: token.quantity > 0 ? ethSpent * ethUsd / token.quantity : null,
                    recycledSaleProceeds: 0,
                    externalBaseFunding: ethSpent,
                });
                if (category !== "Token purchase") nftAndAppSpendingWei += BigInt(Math.round(Number(spendWei) * share));
            }
        } else if (fromWallet && txValueWei > 0n && !targets.length && !externalWithdrawal) {
            nftAndAppSpendingWei += txValueWei;
        }

        if (incomingInternal.length && !saleTxHashes.has(hash)) {
            const nonBridge = incomingInternal.filter((item) => !bridgeInternals.includes(item));
            otherRefundWei += sumWei(nonBridge.map((item) => item.value));
        }

        if (outgoingErc20.length && saleReceiptWei === 0n && !externalWithdrawal) {
            otherOutflows.push(...aggregateTransfers(outgoingErc20).map((outflow) => ({
                ...outflow,
                timestamp: txTimestamp(tx, transfers),
                hash,
            })));
        }
    }

    purchases.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    sales.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    allocateFifo(purchases, sales);

    const pnl = buildTokenPnl({ purchases, sales, otherOutflows, externalOutflows, ledgerBalances, prices, ethUsd });
    const grossTokenPurchases = purchases.filter((item) => item.category === "Token purchase").reduce((sum, item) => sum + item.ethSpent, 0);
    const saleProceeds = sales.reduce((sum, item) => sum + item.ethReceived, 0);
    const currentEthBalance = weiToEth(bigint(account?.coin_balance));
    const directFunding = weiToEth(directFundingWei);
    const bridgeFunding = weiToEth(bridgeFundingWei);
    const otherRefunds = weiToEth(otherRefundWei);
    const nativeOutflow = weiToEth(nativeOutflowWei);
    const gasPaid = weiToEth(gasWei);
    const externalWithdrawals = weiToEth(externalNativeOutflowWei) + externalTokenOutflowEth;
    const grossExternalFunding = directFunding + bridgeFunding;
    const externalFunding = grossExternalFunding - externalWithdrawals;
    const expectedBalance = directFunding + bridgeFunding + saleProceeds + otherRefunds - nativeOutflow - gasPaid;
    const reconciliationDifference = currentEthBalance - expectedBalance;
    const priced = pnl.filter((item) => item.pricingStatus === "Priced");
    const realizedPnlEth = pnl.reduce((sum, item) => sum + item.realizedPnlEth, 0);
    const unrealizedPnlEth = priced.reduce((sum, item) => sum + (item.unrealizedPnlEth || 0), 0);
    const summary = {
        realizedPnlEth,
        realizedPnlUsd: pnl.reduce((sum, item) => sum + item.realizedPnlUsd, 0),
        currentValueEth: priced.reduce((sum, item) => sum + (item.currentValueEth || 0), 0),
        currentValueUsd: priced.reduce((sum, item) => sum + (item.currentValueUsd || 0), 0),
        unrealizedPnlEth,
        unrealizedPnlUsd: priced.reduce((sum, item) => sum + (item.unrealizedPnlUsd || 0), 0),
        totalPnlEth: realizedPnlEth + unrealizedPnlEth,
        totalPnlUsd: (realizedPnlEth + unrealizedPnlEth) * ethUsd,
        purchasedContracts: pnl.length,
        pricedContracts: priced.length,
        partial: priced.length !== pnl.length,
    };

    return {
        wallet: address,
        valuation: { ethUsd, timestamp: new Date().toISOString(), historicalPricesAvailable: false },
        funding: {
            externalFunding,
            grossExternalFunding,
            externalWithdrawals,
            directFunding,
            bridgeFunding,
            grossTokenPurchases,
            nftAndAppSpending: Math.max(0, nativeOutflow - grossTokenPurchases),
            gasPaid,
            currentEthBalance,
            tokenSaleProceeds: saleProceeds,
            saleProceedsReinvested: sales.reduce((sum, item) => sum + item.amountReinvested, 0),
            saleProceedsUnspent: sales.reduce((sum, item) => sum + item.amountUnspent, 0),
            otherRefunds,
        },
        reconciliation: {
            expectedBalance,
            currentBalance: currentEthBalance,
            difference: reconciliationDifference,
            status: Math.abs(reconciliationDifference) < 0.000001 ? "OK" : "Check",
            nativeOutflow,
        },
        summary,
        purchases: purchases.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))),
        sales: sales.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))),
        tokenPnl: pnl,
        otherTokenOutflows: otherOutflows,
        externalTokenOutflows: externalOutflows,
        sourceCounts: {
            transactions: transactions.length,
            internalTransactions: internalTransactions.length,
            tokenTransfers: tokenTransfers.length,
            tokenBalances: tokenBalances.length,
        },
    };
};

export const robinhoodAccountingConstants = { WETH, UNIVERSAL_SPOKE_POOL, WEI_PER_ETH };
