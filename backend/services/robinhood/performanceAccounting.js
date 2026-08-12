const WEI_PER_ETH = 10n ** 18n;
import { buildFuelLpRows } from "./fuelLpAccounting.js";

const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const FUEL = "0x6d2758428530b055e06856deff8ffd5d6fd2d5cc";
const CASHCAT = "0x020bfc650a365f8bb26819deaabf3e21291018b4";
const UNIVERSAL_SPOKE_POOL = "0xd29c85f15df544ba632c9e25829fd29d767d7978";
const UNISWAP_V4_POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
const UNISWAP_V3_POSITION_MANAGER = "0x73991a25c818bf1f1128deaab1492d45638de0d3";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
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
const transferQuantity = (transfer) => {
    if (isNft(transfer)) return number(transfer.total?.value || 1);
    return units(transfer.total?.value, transfer.total?.decimals ?? transfer.token?.decimals);
};

const tokenKey = (transfer) => lower(transfer?.token?.address_hash);
const isCreatorProjectToken = (transferOrContract) =>
    lower(typeof transferOrContract === "string" ? transferOrContract : tokenKey(transferOrContract)) === FUEL;

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
            currentUsdPrice: number(transfer.token?.exchange_rate) || (contract === USDG ? 1 : null),
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

const buildTokenPnl = ({ purchases, sales, otherOutflows, externalOutflows, lpDeposits, lpReturns, ledgerBalances, prices, ethUsd }) => {
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
                lpDeployedQuantity: 0,
                lpDeployedCost: 0,
                lpReturnedQuantity: 0,
                lpExcludedWalletQuantity: 0,
                inventoryQuantity: 0,
                inventoryCost: 0,
                timeline: [],
            });
        }
        return positions.get(token.contract);
    };

    const events = [
        ...purchases.filter((item) => item.tokenType === "ERC-20").map((item) => ({ type: "purchase", timestamp: item.timestamp, item })),
        ...sales.map((item) => ({ type: "sale", timestamp: item.timestamp, item })),
        ...otherOutflows.map((item) => ({ type: "outflow", timestamp: item.timestamp, item })),
        ...externalOutflows.map((item) => ({ type: "externalOutflow", timestamp: item.timestamp, item })),
        ...lpReturns.map((item) => ({ type: "lpReturn", timestamp: item.timestamp, item })),
        ...lpDeposits.map((item) => ({ type: "lpDeposit", timestamp: item.timestamp, item })),
    ].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

    for (const event of events) {
        const position = ensure(event.item);
        if (event.type === "purchase") {
            position.quantityBought += event.item.quantityReceived;
            position.ethInvested += event.item.ethSpent;
            position.inventoryQuantity += event.item.quantityReceived;
            position.inventoryCost += event.item.ethSpent;
            position.timeline.push({
                kind: "Bought",
                timestamp: event.item.timestamp || null,
                hash: event.item.hash,
                transactionUrl: event.item.transactionUrl,
                quantity: event.item.quantityReceived,
                ethAmount: event.item.ethSpent,
            });
            continue;
        }

        const quantity = event.type === "sale" ? event.item.quantitySold : event.item.quantity;

        if (event.type === "lpReturn") {
            // Assets removed from an LP are returned capital, not a free token
            // acquisition. Keep them outside the token-trading inventory until
            // a separately evidenced trade establishes a new cost basis.
            position.lpReturnedQuantity += quantity;
            position.lpExcludedWalletQuantity += quantity;
            position.timeline.push({
                kind: "Returned from Uniswap v4 LP",
                timestamp: event.item.timestamp || null,
                hash: event.item.hash,
                transactionUrl: event.item.transactionUrl,
                quantity,
            });
            continue;
        }

        // LP-returned assets remain outside token P&L. If they are redeployed,
        // transferred, or swapped later, consume that excluded capital first
        // instead of manufacturing a zero-cost token gain.
        const excludedQuantity = Math.min(quantity, Math.max(0, position.lpExcludedWalletQuantity));
        position.lpExcludedWalletQuantity = Math.max(0, position.lpExcludedWalletQuantity - excludedQuantity);
        const tradingQuantity = Math.max(0, quantity - excludedQuantity);
        const averageInventoryCost = position.inventoryQuantity > 0
            ? position.inventoryCost / position.inventoryQuantity
            : 0;
        const allocatedQuantity = Math.min(tradingQuantity, Math.max(0, position.inventoryQuantity));
        const allocatedCost = allocatedQuantity * averageInventoryCost;
        position.inventoryQuantity = Math.max(0, position.inventoryQuantity - allocatedQuantity);
        position.inventoryCost = Math.max(0, position.inventoryCost - allocatedCost);

        if (event.type === "lpDeposit") {
            // This is a conversion from a wallet token balance into an open LP
            // position, not a sale, loss, or external withdrawal. Live LP
            // valuation is sourced separately from the protocol provider.
            position.lpDeployedQuantity += quantity;
            position.lpDeployedCost += allocatedCost;
            position.timeline.push({
                kind: "Deployed to Uniswap v4 LP",
                timestamp: event.item.timestamp || null,
                hash: event.item.hash,
                transactionUrl: event.item.transactionUrl,
                quantity,
            });
            continue;
        }

        if (event.type === "sale") {
            const tradingShare = quantity > 0 ? tradingQuantity / quantity : 0;
            position.quantitySold += tradingQuantity;
            position.ethReceived += event.item.ethReceived * tradingShare;
            position.costBasisSold += allocatedCost;
            position.timeline.push({
                kind: "Sold",
                timestamp: event.item.timestamp || null,
                hash: event.item.hash,
                transactionUrl: event.item.transactionUrl,
                quantity: tradingQuantity,
                ethAmount: event.item.ethReceived * tradingShare,
            });
        } else if (event.type === "outflow") {
            position.otherOutflowQuantity += tradingQuantity;
            position.otherOutflowCost += allocatedCost;
            position.timeline.push({
                kind: "Transferred out",
                timestamp: event.item.timestamp || null,
                hash: event.item.hash,
                transactionUrl: event.item.transactionUrl,
                quantity: tradingQuantity,
            });
        } else {
            position.externalOutflowQuantity += tradingQuantity;
            position.externalOutflowCost += allocatedCost;
            position.timeline.push({
                kind: "Sent externally",
                timestamp: event.item.timestamp || null,
                hash: event.item.hash,
                transactionUrl: event.item.transactionUrl,
                quantity: tradingQuantity,
            });
        }
    }

    return [...positions.values()].map((position) => {
        const averageCost = position.quantityBought > 0 ? position.ethInvested / position.quantityBought : 0;
        const walletBalance = Math.max(0, ledgerBalances.get(position.contract) || 0);
        const tradingWalletBalance = Math.max(0, walletBalance - position.lpExcludedWalletQuantity);
        const attributableBalance = Math.min(tradingWalletBalance, Math.max(0, position.inventoryQuantity));
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

        const manuallyClosed = CONFIRMED_CLOSED_POSITIONS.has(position.contract);
        const timeline = [...position.timeline].sort((left, right) =>
            String(left.timestamp || "").localeCompare(String(right.timestamp || ""))
        );
        const isClosed = manuallyClosed || attributableBalance <= Math.max(1e-8, position.quantityBought * 1e-9);
        return {
            ...position,
            timeline,
            openedAt: timeline[0]?.timestamp || null,
            closedAt: isClosed ? timeline[timeline.length - 1]?.timestamp || null : null,
            manuallyClosed,
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

export const calculateRobinhoodPerformance = ({
    address,
    addresses = [address],
    account,
    transactions,
    internalTransactions,
    tokenTransfers,
    tokenBalances,
    internalTransactionsAvailable = true,
}) => {
    const wallet = lower(address);
    const trackedWallets = new Set(addresses.map(lower));
    const isTrackedWallet = (value) => trackedWallets.has(addressOf(value));
    const ethUsd = number(account?.exchange_rate);
    const txByHash = new Map((transactions || []).map((tx) => [lower(tx.hash), tx]));
    const internalsByHash = groupByHash(internalTransactions);
    const transfersByHash = groupByHash(tokenTransfers);
    const allHashes = new Set([...txByHash.keys(), ...internalsByHash.keys(), ...transfersByHash.keys()]);
    const ledgerBalances = new Map();
    const prices = new Map();

    for (const transfer of tokenTransfers || []) {
        const key = tokenKey(transfer);
        if (!key || isCreatorProjectToken(key)) continue;
        const quantity = transferQuantity(transfer);
        const transferToTrackedWallet = isTrackedWallet(transfer.to);
        const transferFromTrackedWallet = isTrackedWallet(transfer.from);
        const direction = transferToTrackedWallet && !transferFromTrackedWallet ? 1 : transferFromTrackedWallet && !transferToTrackedWallet ? -1 : 0;
        ledgerBalances.set(key, (ledgerBalances.get(key) || 0) + direction * quantity);
        const price = number(transfer.token?.exchange_rate) || (key === USDG ? 1 : 0);
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
    let creatorProjectSpendWei = 0n;
    let creatorProjectGasWei = 0n;
    let creatorProjectReturnedWei = 0n;
    const creatorProjectEvents = [];
    const purchases = [];
    const sales = [];
    const saleTxHashes = new Set();
    const otherOutflows = [];
    const externalOutflows = [];
    const lpDeposits = [];
    const lpReturns = [];
    const unmatchedLpMovements = [];
    // Tokens bought with funded or recycled capital carry their actual cost
    // into the LP ledger. This is intentionally generic: USDG -> CASHCAT -> LP
    // must move basis between strategies without manufacturing token profit.
    const tokenAcquisitionLots = new Map();
    const addTokenLot = (contract, quantity, usdCost) => {
        if (quantity <= 0 || !contract) return;
        if (!tokenAcquisitionLots.has(contract)) tokenAcquisitionLots.set(contract, []);
        tokenAcquisitionLots.get(contract).push({ quantity, usdCost });
    };
    const consumeTokenBasis = (contract, quantity, fallbackUnitUsd = 0) => {
        let remaining = Math.max(0, quantity);
        let usdCost = 0;
        for (const lot of tokenAcquisitionLots.get(contract) || []) {
            if (remaining <= 0) break;
            const used = Math.min(remaining, Math.max(0, lot.quantity));
            const unitCost = lot.quantity > 0 ? lot.usdCost / lot.quantity : 1;
            lot.quantity -= used;
            lot.usdCost -= used * unitCost;
            remaining -= used;
            usdCost += used * unitCost;
        }
        return usdCost + remaining * fallbackUnitUsd;
    };
    // Position lifecycle accounting is intentionally transaction based. A v4
    // position NFT is the durable identity; token transfers to PositionManager
    // are capital deployment, while transfers back to the wallet are returns.
    const v4Positions = new Map();
    const activeV4PositionsByWallet = new Map();
    const v4PositionFor = (id, walletAddress) => {
        const key = String(id);
        if (!v4Positions.has(key)) {
            v4Positions.set(key, {
                positionId: key,
                wallet: walletAddress,
                openedAt: null,
                depositsUsd: 0,
                returnedUsd: 0,
                gasUsd: 0,
                closedAt: null,
                status: "open",
                matchConfidence: "exact-nft",
                valuationStatus: "valued",
                events: [],
            });
        }
        return v4Positions.get(key);
    };

    const orderedHashes = [...allHashes].sort((left, right) =>
        String(txByHash.get(left)?.timestamp || "").localeCompare(String(txByHash.get(right)?.timestamp || ""))
    );
    for (const hash of orderedHashes) {
        const tx = txByHash.get(hash);
        const internals = internalsByHash.get(hash) || [];
        const transfers = transfersByHash.get(hash) || [];
        if (!isSuccess(tx)) continue;
        const fromWallet = isTrackedWallet(tx?.from);
        const toWallet = isTrackedWallet(tx?.to);
        const txValueWei = bigint(tx?.value);
        const fuelRelated = transfers.some((item) => isCreatorProjectToken(item) && (isTrackedWallet(item.from) || isTrackedWallet(item.to)));
        // Direct approvals/interactions with FUEL may have no transfer event.
        // They are still developer activity and their gas belongs to the
        // closed experiment rather than ordinary trading P&L.
        const creatorProjectRelated = fuelRelated || (fromWallet && addressOf(tx?.to) === FUEL);
        // A send between MM and Rabby is an internal relocation: it changes
        // neither portfolio funding nor the expected combined ETH balance.
        // Its gas still belongs to the portfolio.
        if (fromWallet && !toWallet) {
            nativeOutflowWei += txValueWei;
        }
        if (fromWallet) {
            gasWei += bigint(tx?.fee?.value ?? tx?.fee);
        }
        if (toWallet && !fromWallet && txValueWei > 0n) directFundingWei += txValueWei;

        const incomingInternal = internals.filter((item) => item.success !== false && isTrackedWallet(item.to) && !isTrackedWallet(item.from));
        if (creatorProjectRelated) {
            const feeWei = fromWallet ? bigint(tx?.fee?.value ?? tx?.fee) : 0n;
            const outboundWei = fromWallet && !toWallet ? txValueWei : 0n;
            const inboundWei = (toWallet && !fromWallet ? txValueWei : 0n) + sumWei(incomingInternal.map((item) => item.value));
            const direction = fromWallet && toWallet
                ? "internal"
                : outboundWei > 0n ? "external-outflow"
                    : inboundWei > 0n ? "external-inflow"
                        : "contract-interaction";
            creatorProjectEvents.push({
                hash,
                transactionUrl: makeExplorerUrl(hash),
                timestamp: txTimestamp(tx, transfers),
                direction,
                outboundNativeEth: weiToEth(outboundWei),
                matchingGasEth: weiToEth(feeWei),
                inboundNativeEth: weiToEth(inboundWei),
                fuelTransferCount: transfers.filter(isCreatorProjectToken).length,
            });
            if (fromWallet) creatorProjectGasWei += feeWei;
            if (fromWallet && !toWallet) {
                creatorProjectSpendWei += txValueWei;
            }
            if (toWallet && !fromWallet) creatorProjectReturnedWei += txValueWei;
            creatorProjectReturnedWei += sumWei(incomingInternal.map((item) => item.value));
        }
        const bridgeInternals = incomingInternal.filter((item) => {
            const from = addressOf(item.from);
            const name = lower(item.from?.name || item.from?.implementations?.[0]?.name);
            return from === UNIVERSAL_SPOKE_POOL || name.includes("spokepool");
        });
        bridgeFundingWei += sumWei(bridgeInternals.map((item) => item.value));

        const incoming = transfers.filter((item) =>
            isTrackedWallet(item.to) && !isTrackedWallet(item.from) && !isCreatorProjectToken(item)
        );
        const outgoing = transfers.filter((item) =>
            isTrackedWallet(item.from) && !isTrackedWallet(item.to) && !isCreatorProjectToken(item)
        );
        const v4NftTransfers = transfers.filter((item) =>
            isNft(item) && tokenKey(item) === UNISWAP_V4_POSITION_MANAGER
        );
        const mintedTransfer = v4NftTransfers.find((item) => isTrackedWallet(item.to) && !isTrackedWallet(item.from));
        const exitedTransfer = v4NftTransfers.find((item) => isTrackedWallet(item.from) && !isTrackedWallet(item.to));
        const nftPositionId = (transfer) => transfer == null
            ? null
            : String(transfer.total?.token_id ?? transfer.token_id ?? "") || null;
        for (const transfer of v4NftTransfers) {
            const owner = addressOf(transfer.to);
            const previousOwner = addressOf(transfer.from);
            const id = String(transfer.total?.token_id ?? transfer.token_id ?? "");
            if (!id) continue;
            if (isTrackedWallet(transfer.to)) {
                const position = v4PositionFor(id, owner);
                position.openedAt ||= txTimestamp(tx, transfers);
                if (!activeV4PositionsByWallet.has(owner)) activeV4PositionsByWallet.set(owner, new Set());
                activeV4PositionsByWallet.get(owner).add(id);
            }
            if (isTrackedWallet(transfer.from) && !isTrackedWallet(transfer.to)) {
                activeV4PositionsByWallet.get(previousOwner)?.delete(id);
                const position = v4PositionFor(id, previousOwner);
                position.closedAt = txTimestamp(tx, transfers);
                position.status = "closed";
            }
        }
        // The official PositionManager is the accounting boundary. Explorer
        // method labels are not always present, particularly for hooked pools,
        // so the target contract is stronger evidence than `method` text.
        const isUniswapV4LiquidityOperation = fromWallet
            && addressOf(tx?.to) === UNISWAP_V4_POSITION_MANAGER;
        const isUniswapV3LiquidityOperation = fromWallet
            && addressOf(tx?.to) === UNISWAP_V3_POSITION_MANAGER;
        const isUniswapLiquidityOperation = isUniswapV4LiquidityOperation || isUniswapV3LiquidityOperation;
        const lpOutgoingTransfers = isUniswapLiquidityOperation
            ? outgoing.filter((item) => !isNft(item))
            : [];
        const lpIncomingTransfers = isUniswapLiquidityOperation
            ? incoming.filter((item) => !isNft(item))
            : [];
        const lpOutgoingErc20 = isUniswapLiquidityOperation
            ? lpOutgoingTransfers.filter((item) => tokenKey(item) !== WETH)
            : [];
        const lpIncomingErc20 = isUniswapLiquidityOperation
            ? lpIncomingTransfers.filter((item) => tokenKey(item) !== WETH)
            : [];
        // Keep LP deposits out of ordinary token-sale accounting. The matching
        // Uniswap position NFT is the proof that the capital remains deployed.
        if (lpOutgoingErc20.length) {
            lpDeposits.push(...aggregateTransfers(lpOutgoingErc20).map((deposit) => ({
                ...deposit,
                timestamp: txTimestamp(tx, transfers),
                hash,
                transactionUrl: makeExplorerUrl(hash),
            })));
        }
        if (lpIncomingErc20.length) {
            lpReturns.push(...aggregateTransfers(lpIncomingErc20).map((returned) => ({
                ...returned,
                timestamp: txTimestamp(tx, transfers),
                hash,
                transactionUrl: makeExplorerUrl(hash),
            })));
        }
        if (isUniswapV4LiquidityOperation) {
            const walletAddress = addressOf(tx.from);
            const mintedId = nftPositionId(mintedTransfer);
            const exitedId = nftPositionId(exitedTransfer);
            const activeIds = [...(activeV4PositionsByWallet.get(walletAddress) || [])];
            const rawInput = String(tx?.raw_input || tx?.input || "").toLowerCase();
            const referencedIds = activeIds.filter((id) => {
                try {
                    return rawInput.includes(BigInt(id).toString(16).padStart(64, "0"));
                } catch {
                    return false;
                }
            });
            // A post-mint modify has no NFT transfer. It can still be assigned
            // safely when this wallet owns exactly one active v4 position.
            const positionId = mintedId
                || exitedId
                || (referencedIds.length === 1 ? referencedIds[0] : null)
                || (activeIds.length === 1 ? activeIds[0] : null);
            // Never attribute a wallet's complete v4 history to whichever
            // position happens to be live today. Wallet-level fallback made
            // active LPs with frequent range changes look like large losses.
            const txEthUsd = number(tx?.exchange_rate) || ethUsd;
            const depositedTokens = aggregateTransfers(lpOutgoingTransfers);
            const returnedTokens = aggregateTransfers(lpIncomingTransfers);
            const returnedQuantityByContract = new Map(returnedTokens.map((item) => [item.contract, item.quantity]));
            const tokenDepositUsd = depositedTokens.reduce((sum, item) => {
                const unitUsd = item.contract === USDG ? 1 : number(item.currentUsdPrice);
                const repositionedQuantity = Math.min(item.quantity, returnedQuantityByContract.get(item.contract) || 0);
                const netNewQuantity = Math.max(0, item.quantity - repositionedQuantity);
                return sum
                    + repositionedQuantity * unitUsd
                    + consumeTokenBasis(item.contract, netNewQuantity, unitUsd);
            }, 0);
            const returnedTokenUsd = returnedTokens.reduce((sum, item) =>
                sum + item.quantity * number(item.currentUsdPrice), 0
            );
            for (const item of returnedTokens) {
                const depositedQuantity = depositedTokens.find((deposit) => deposit.contract === item.contract)?.quantity || 0;
                const netReturnedQuantity = Math.max(0, item.quantity - depositedQuantity);
                const unitUsd = item.contract === USDG ? 1 : number(item.currentUsdPrice);
                if (netReturnedQuantity > 0) addTokenLot(item.contract, netReturnedQuantity, netReturnedQuantity * unitUsd);
            }
            const nativeDepositEth = weiToEth(txValueWei);
            const nativeDepositUsd = nativeDepositEth * txEthUsd;
            const nativeReturnedWei = sumWei(incomingInternal
                .filter((item) => !bridgeInternals.includes(item))
                .map((item) => item.value));
            const nativeReturnedEth = weiToEth(nativeReturnedWei);
            const nativeReturnedUsd = nativeReturnedEth * txEthUsd;
            const returnedUsd = returnedTokenUsd + nativeReturnedUsd;
            const gasEth = weiToEth(bigint(tx?.fee?.value ?? tx?.fee));
            const gasUsd = gasEth * txEthUsd;
            const movement = {
                positionId,
                wallet: walletAddress,
                hash,
                transactionUrl: makeExplorerUrl(hash),
                timestamp: txTimestamp(tx, transfers),
                type: (nativeDepositUsd + tokenDepositUsd) > 0 && returnedUsd > 0
                    ? "reposition"
                    : (nativeDepositUsd + tokenDepositUsd) > 0 ? (mintedId ? "mint" : "increase")
                        : returnedUsd > 0 ? (exitedId ? "close" : "decrease-or-collect")
                            : "modify",
                depositedTokens,
                returnedTokens,
                nativeDepositEth,
                nativeDepositUsd,
                tokenDepositUsd,
                nativeReturnedEth,
                nativeReturnedUsd,
                returnedUsd,
                gasEth,
                gasUsd,
                accountingStatus: positionId ? "matched" : "unmatched",
                valuationStatus: txEthUsd > 0 && [...depositedTokens, ...returnedTokens]
                    .every((token) => number(token.currentUsdPrice) > 0)
                    ? "valued"
                    : "partial",
            };
            const recordMovement = (targetId, nextMovement, confidence = null) => {
                if (!targetId) {
                    unmatchedLpMovements.push(nextMovement);
                    return;
                }
                const position = v4PositionFor(targetId, walletAddress);
                if (confidence) position.matchConfidence = confidence;
                if (nextMovement.valuationStatus === "partial") position.valuationStatus = "partial";
                position.depositsUsd += nextMovement.nativeDepositUsd + nextMovement.tokenDepositUsd;
                position.returnedUsd += nextMovement.returnedUsd;
                position.gasUsd += nextMovement.gasUsd;
                position.events.push(nextMovement);
            };
            if (mintedId && exitedId && mintedId !== exitedId) {
                // A range/hook switch closes one NFT and mints another in one
                // PositionManager transaction. Returned capital belongs to the
                // old lifecycle and redeployed capital to the new lifecycle.
                recordMovement(exitedId, {
                    ...movement,
                    positionId: exitedId,
                    type: "close",
                    depositedTokens: [],
                    nativeDepositEth: 0,
                    nativeDepositUsd: 0,
                    tokenDepositUsd: 0,
                    gasEth: 0,
                    gasUsd: 0,
                }, "exact-nft");
                recordMovement(mintedId, {
                    ...movement,
                    positionId: mintedId,
                    type: "mint",
                    returnedTokens: [],
                    nativeReturnedEth: 0,
                    nativeReturnedUsd: 0,
                    returnedUsd: 0,
                }, "exact-nft");
            } else {
                recordMovement(positionId, movement, !mintedId && !exitedId
                    ? (referencedIds.length === 1 ? "calldata-position-id" : "single-active-position")
                    : "exact-nft");
            }
        }
        const outgoingErc20 = outgoing
            .filter((item) => !isNft(item) && tokenKey(item) !== WETH && !lpOutgoingErc20.includes(item));
        // Swaps on Robinhood commonly settle to WETH without an internal native
        // transfer. Treat that WETH as sale proceeds; otherwise USDG -> WETH is
        // mislabelled as a token loss immediately before WETH -> CASHCAT.
        const nativeSaleReceiptWei = sumWei(incomingInternal.filter((item) => !bridgeInternals.includes(item)).map((item) => item.value));
        const wethSaleReceiptWei = incoming
            .filter((item) => tokenKey(item) === WETH)
            .reduce((sum, item) => sum + bigint(item.total?.value), 0n);
        const saleReceiptWei = nativeSaleReceiptWei + wethSaleReceiptWei;

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
        // Some router paths exchange ERC-20 directly for another ERC-20 with
        // neither native ETH nor WETH visible as an intermediate asset. Carry
        // the outgoing market value into the received token's basis instead of
        // recording a zero-value outflow and a zero-cost acquisition.
        const directTokenConversion = fromWallet
            && outgoingErc20.length > 0
            && saleReceiptWei === 0n
            && targets.length > 0
            && !isUniswapLiquidityOperation;
        let directConversionEth = 0;
        if (directTokenConversion) {
            const sold = aggregateTransfers(outgoingErc20);
            const totalUsd = sold.reduce((sum, token) => {
                const unitUsd = token.contract === USDG ? 1 : number(token.currentUsdPrice);
                return sum + token.quantity * unitUsd;
            }, 0);
            directConversionEth = ethUsd > 0 ? totalUsd / ethUsd : 0;
            if (directConversionEth > 0) {
                for (const token of sold) {
                    const unitUsd = token.contract === USDG ? 1 : number(token.currentUsdPrice);
                    const usdReceived = token.quantity * unitUsd;
                    sales.push({
                        hash,
                        transactionUrl: makeExplorerUrl(hash),
                        timestamp: txTimestamp(tx, transfers),
                        contract: token.contract,
                        symbol: token.symbol,
                        name: token.name,
                        quantitySold: token.quantity,
                        ethReceived: usdReceived / ethUsd,
                        usdReceived,
                        gasEth: weiToEth(bigint(tx?.fee?.value ?? tx?.fee)),
                        amountReinvested: 0,
                        amountUnspent: 0,
                        reinvestmentStatus: "Converted",
                    });
                }
                saleTxHashes.add(hash);
            }
        }
        // A launch with no asset returned to MM was launched for another wallet.
        // Count that value as leaving the portfolio, alongside ordinary direct
        // transfers and bridge-outs. Do not treat incomplete swap indexing as a
        // withdrawal merely because WETH moved to a pool.
        const hasExternalAssetOutflow = txValueWei > 0n || outgoingErc20.length > 0;
        const externalWithdrawal = fromWallet
            && saleReceiptWei === 0n
            && targets.length === 0
            && !toWallet
            // FUEL launch/LP/claim/test capital is a developer expense. It is
            // not capital returned from the Robinhood portfolio. CASHCAT that
            // accompanies those LP transactions remains part of CASHCAT's own
            // cost basis and performance instead of becoming a withdrawal.
            && !creatorProjectRelated
            && !isUniswapLiquidityOperation
            // Covers direct sends, contract deployment/funding, and contract
            // interactions that did not return a tracked asset. These are
            // outflows, not artificial sales or wallet-to-wallet transfers.
            && hasExternalAssetOutflow;
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
        if (fromWallet && (spendWei > 0n || directConversionEth > 0) && targets.length && !isUniswapLiquidityOperation) {
            const targetTotal = targets.reduce((sum, token) => sum + token.quantity, 0) || 1;
            for (const token of targets) {
                const share = token.quantity / targetTotal;
                const ethSpent = (spendWei > 0n ? weiToEth(spendWei) : directConversionEth) * share;
                const category = token.tokenType === "ERC-20" ? "Token purchase" : "NFT purchase";
                const purchase = {
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
                };
                purchases.push(purchase);
                if (category === "Token purchase") addTokenLot(token.contract, token.quantity, purchase.usdValue);
                if (category !== "Token purchase") nftAndAppSpendingWei += BigInt(Math.round(Number(spendWei) * share));
            }
        } else if (fromWallet && txValueWei > 0n && !targets.length && !externalWithdrawal && !isUniswapLiquidityOperation) {
            nftAndAppSpendingWei += txValueWei;
        }

        if (incomingInternal.length && !saleTxHashes.has(hash) && !isUniswapLiquidityOperation) {
            const nonBridge = incomingInternal.filter((item) => !bridgeInternals.includes(item));
            otherRefundWei += sumWei(nonBridge.map((item) => item.value));
        }

        if (outgoingErc20.length && saleReceiptWei === 0n && !directTokenConversion && !externalWithdrawal && !creatorProjectRelated) {
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

    const pnl = buildTokenPnl({ purchases, sales, otherOutflows, externalOutflows, lpDeposits, lpReturns, ledgerBalances, prices, ethUsd });
    const creatorGrossSpendEth = weiToEth(creatorProjectSpendWei + creatorProjectGasWei);
    const creatorReturnedEth = weiToEth(creatorProjectReturnedWei);
    const creatorNetCostEth = creatorGrossSpendEth - creatorReturnedEth;
    if (creatorProjectEvents.length || creatorGrossSpendEth || creatorReturnedEth) {
        pnl.push({
            contract: FUEL,
            symbol: "FUEL",
            name: "FUEL developer project",
            classification: "developer-expense",
            tags: ["DEV"],
            manuallyClosed: true,
            quantityBought: 1,
            quantitySold: 1,
            ethInvested: creatorGrossSpendEth,
            ethReceived: creatorReturnedEth,
            otherOutflowQuantity: 0,
            otherOutflowCost: 0,
            externalOutflowQuantity: 0,
            externalOutflowCost: 0,
            inventoryQuantity: 0,
            inventoryCost: 0,
            costBasisSold: creatorGrossSpendEth,
            averageCostEth: creatorGrossSpendEth,
            walletBalance: 0,
            attributableBalance: 0,
            currentUsdPrice: null,
            realizedPnlEth: -creatorNetCostEth,
            realizedPnlUsd: -creatorNetCostEth * ethUsd,
            remainingCostBasis: 0,
            currentValueEth: 0,
            currentValueUsd: 0,
            unrealizedPnlEth: 0,
            unrealizedPnlUsd: 0,
            totalPnlEth: -creatorNetCostEth,
            totalPnlUsd: -creatorNetCostEth * ethUsd,
            returnPercentage: creatorGrossSpendEth > 0 ? (-creatorNetCostEth / creatorGrossSpendEth) * 100 : null,
            pricingStatus: "Priced",
            developerCost: {
                grossSpendEth: creatorGrossSpendEth,
                returnedEth: creatorReturnedEth,
                netCostEth: creatorNetCostEth,
                matchedTransactionCount: creatorProjectEvents.length,
                trackedWalletCount: trackedWallets.size,
                historicalWalletCount: Math.max(0, trackedWallets.size - 2),
                cashcatContract: CASHCAT,
                cashcatTreatment: "standard-position",
            },
        });
    }
    // These are transparent sub-ledger rows for the creator project. They are
    // excluded from the portfolio summary because their flows are already
    // represented by the aggregate FUEL developer-project row.
    pnl.push(...buildFuelLpRows({
        transactions,
        tokenTransfers,
        addresses,
        ethUsd,
    }));
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
    const summaryPnl = pnl.filter((item) => !item.excludeFromSummary);
    const priced = summaryPnl.filter((item) => item.pricingStatus === "Priced");
    const realizedPnlEth = summaryPnl.reduce((sum, item) => sum + item.realizedPnlEth, 0);
    const unrealizedPnlEth = priced.reduce((sum, item) => sum + (item.unrealizedPnlEth || 0), 0);
    const summary = {
        realizedPnlEth,
        realizedPnlUsd: summaryPnl.reduce((sum, item) => sum + item.realizedPnlUsd, 0),
        currentValueEth: priced.reduce((sum, item) => sum + (item.currentValueEth || 0), 0),
        currentValueUsd: priced.reduce((sum, item) => sum + (item.currentValueUsd || 0), 0),
        unrealizedPnlEth,
        unrealizedPnlUsd: priced.reduce((sum, item) => sum + (item.unrealizedPnlUsd || 0), 0),
        totalPnlEth: realizedPnlEth + unrealizedPnlEth,
        totalPnlUsd: (realizedPnlEth + unrealizedPnlEth) * ethUsd,
        purchasedContracts: summaryPnl.length,
        pricedContracts: priced.length,
        partial: priced.length !== summaryPnl.length || !internalTransactionsAvailable,
    };

    if (!internalTransactionsAvailable) {
        for (const position of v4Positions.values()) {
            position.valuationStatus = "partial";
            position.incompleteReason = "Native LP returns are unavailable from Blockscout for at least one tracked wallet.";
        }
    }

    return {
        wallet: address,
        wallets: addresses,
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
        dataQuality: { internalTransactionsAvailable },
        lpLifecycle: {
            positions: [...v4Positions.values()].map((position) => ({
                ...position,
                depositsUsd: Number(position.depositsUsd.toFixed(2)),
                returnedUsd: Number(position.returnedUsd.toFixed(2)),
                gasUsd: Number(position.gasUsd.toFixed(2)),
            })),
            unmatchedMovements: unmatchedLpMovements,
            movementCount: [...v4Positions.values()].reduce((sum, position) => sum + position.events.length, 0)
                + unmatchedLpMovements.length,
        },
        creatorProject: {
            schemaVersion: 2,
            project: {
                chain: "hood",
                tokenContract: FUEL,
            },
            // These fields intentionally describe only transactions that carry a
            // FUEL transfer. They are evidence for the creator audit, not a
            // comprehensive developer-cost or project P&L statement.
            fuelLinkedNativeFlow: {
                outboundNativeEth: weiToEth(creatorProjectSpendWei),
                matchingGasEth: weiToEth(creatorProjectGasWei),
                inboundNativeEth: weiToEth(creatorProjectReturnedWei),
                netNativeEth: weiToEth(creatorProjectSpendWei + creatorProjectGasWei - creatorProjectReturnedWei),
                outboundNativeUsdAtCurrentEth: weiToEth(creatorProjectSpendWei) * ethUsd,
                matchingGasUsdAtCurrentEth: weiToEth(creatorProjectGasWei) * ethUsd,
                inboundNativeUsdAtCurrentEth: weiToEth(creatorProjectReturnedWei) * ethUsd,
                netNativeUsdAtCurrentEth: weiToEth(creatorProjectSpendWei + creatorProjectGasWei - creatorProjectReturnedWei) * ethUsd,
                ethUsd,
                matchedTransactionCount: creatorProjectEvents.length,
            },
            events: creatorProjectEvents
                .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
                .slice(0, 40),
            audit: {
                status: creatorProjectEvents.length ? "partial" : "not-calculated",
                calculatedAt: new Date().toISOString(),
                internalTransactionsAvailable,
                historicalUsdAvailable: false,
                limitations: [
                    "Only transactions containing a FUEL transfer are classified.",
                    "Contract deployments, approvals, claims, and unrelated gas are not included.",
                    "WETH-funded activity is not yet classified as creator spend.",
                    "USD uses the current ETH quote, not each transaction's historical price.",
                ],
            },
            // Legacy names remain for cache/UI compatibility. New consumers must
            // use fuelLinkedNativeFlow and its stated coverage instead.
            devGrossSpendEth: weiToEth(creatorProjectSpendWei + creatorProjectGasWei),
            devReturnedEth: weiToEth(creatorProjectReturnedWei),
            devNetSpendEth: weiToEth(creatorProjectSpendWei + creatorProjectGasWei - creatorProjectReturnedWei),
            devGrossSpendUsd: weiToEth(creatorProjectSpendWei + creatorProjectGasWei) * ethUsd,
            devReturnedUsd: weiToEth(creatorProjectReturnedWei) * ethUsd,
            devNetSpendUsd: weiToEth(creatorProjectSpendWei + creatorProjectGasWei - creatorProjectReturnedWei) * ethUsd,
        },
    };
};

export const robinhoodAccountingConstants = { WETH, FUEL, CASHCAT, UNIVERSAL_SPOKE_POOL, WEI_PER_ETH };
