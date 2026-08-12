export const FUEL_CONTRACT = "0x6d2758428530b055e06856deff8ffd5d6fd2d5cc";

const number = (value) => Number(value || 0);
const lower = (value) => String(value || "").toLowerCase();

export const getProtocolPositionAssets = (item) => {
    const detail = item?.detail || {};
    const supply = Array.isArray(detail.supply_token_list) ? detail.supply_token_list : [];
    if (supply.length) return supply;
    const assets = Array.isArray(detail.asset_token_list) ? detail.asset_token_list : [];
    if (assets.length) return assets;
    return detail.token ? [detail.token] : [];
};

const directPositionValue = (item) => {
    const netValue = number(item?.stats?.net_usd_value);
    return netValue > 0 ? netValue : number(item?.stats?.asset_usd_value);
};

// This is deliberately richer than a number. A single valuation object lets
// portfolio, chain, protocol, Robinhood, and FUEL views describe *why* a value
// exists instead of silently applying their own fallbacks.
export const getProtocolPositionValuation = (item) => {
    const assets = getProtocolPositionAssets(item);
    const fuel = assets.find((asset) => lower(asset?.id || asset?.address) === FUEL_CONTRACT);

    if (fuel && number(fuel.amount) > 0 && number(fuel.price) <= 0) {
        const pairedValueUsd = assets
            .filter((asset) => asset !== fuel)
            .reduce((sum, asset) => sum + number(asset.amount) * number(asset.price), 0);

        if (pairedValueUsd > 0) {
            const impliedPriceUsd = pairedValueUsd / number(fuel.amount);
            return {
                usdValue: pairedValueUsd * 2,
                pricing: {
                    method: "pool-implied",
                    confidence: "estimated",
                    source: "priced counter-leg in the same LP",
                    inferredAssetPrices: [
                        {
                            contract: FUEL_CONTRACT,
                            priceUsd: impliedPriceUsd,
                            amount: number(fuel.amount),
                        },
                    ],
                },
            };
        }
    }

    const usdValue = directPositionValue(item);
    return {
        usdValue,
        pricing: {
            method: usdValue > 0 ? "provider" : "unavailable",
            confidence: usdValue > 0 ? "direct" : "unavailable",
            source: usdValue > 0 ? "provider position valuation" : "no usable valuation",
            inferredAssetPrices: [],
        },
    };
};

// A provider can return a valid LP position while leaving a newly launched
// token's price at zero. Value the priced counter-leg and infer the unpriced
// FUEL leg from that same pool ratio, so all dashboard consumers agree.
export const getProtocolPositionUsdValue = (item) => getProtocolPositionValuation(item).usdValue;

export const getWalletTokenUsdValue = (token) =>
    number(token?.wallets_tokens?.amount) * number(token?.price);
