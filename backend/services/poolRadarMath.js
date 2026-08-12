export const WINDOW_SECONDS = {
    "5m": 5 * 60,
    "1h": 60 * 60,
    "6h": 6 * 60 * 60,
    "24h": 24 * 60 * 60,
    "7d": 7 * 24 * 60 * 60,
};

export const feePipsToRate = (feePips = 0) => Number(feePips) / 1_000_000;

export const annualizeFeeApy = ({ feesUsd, tvlUsd, windowSeconds }) => {
    if (!(feesUsd >= 0) || !(tvlUsd > 0) || !(windowSeconds > 0)) return null;
    return (feesUsd / tvlUsd) * (365 * 24 * 60 * 60 / windowSeconds) * 100;
};

const HOOK_FLAGS = [
    ["afterRemoveLiquidityReturnsDelta", 1n << 0n], ["afterAddLiquidityReturnsDelta", 1n << 1n],
    ["afterSwapReturnsDelta", 1n << 2n], ["beforeSwapReturnsDelta", 1n << 3n],
    ["afterDonate", 1n << 4n], ["beforeDonate", 1n << 5n], ["afterSwap", 1n << 6n],
    ["beforeSwap", 1n << 7n], ["afterRemoveLiquidity", 1n << 8n],
    ["beforeRemoveLiquidity", 1n << 9n], ["afterAddLiquidity", 1n << 10n],
    ["beforeAddLiquidity", 1n << 11n], ["afterInitialize", 1n << 12n],
    ["beforeInitialize", 1n << 13n],
];

export const decodeHookPermissions = (hook) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(hook || "")) return {};
    const bits = BigInt(hook) & 0x3fffn;
    return Object.fromEntries(HOOK_FLAGS.map(([name, flag]) => [name, Boolean(bits & flag)]));
};

export const deriveRiskFlags = ({ tvlUsd, windows = {}, hook, dynamicFee = false }) => {
    const risks = [];
    const hasHook = hook && hook !== "0x0000000000000000000000000000000000000000";
    if (dynamicFee) risks.push({ level: "high", code: "dynamic-fee", label: "Dynamic fee" });
    if (hasHook) risks.push({ level: "medium", code: "hook", label: "Hook-controlled" });
    if (tvlUsd != null && tvlUsd < 10_000) risks.push({ level: "medium", code: "low-tvl", label: "Low TVL" });
    if ((windows["1h"]?.swaps || 0) === 0) risks.push({ level: "low", code: "inactive", label: "No 1h flow" });
    const oneHourApy = windows["1h"]?.apy;
    const dailyApy = windows["24h"]?.apy;
    if (oneHourApy != null && dailyApy != null && oneHourApy > dailyApy * 3 && oneHourApy > 25) {
        risks.push({ level: "medium", code: "fee-spike", label: "Short fee spike" });
    }
    return risks;
};
