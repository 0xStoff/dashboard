const CANONICAL_TOKEN_LOGOS = new Map([
    ["ETH", "ETH.png"],
    ["WETH", "ETH.png"],
    ["HYPE", "hyper.png"],
    ["LINK", "chainlink.png"],
    ["PENDLE", "pendle2.png"],
    ["USDC", "USDC.png"],
]);

export const getCanonicalTokenLogo = (symbol) =>
    CANONICAL_TOKEN_LOGOS.get(String(symbol || "").toUpperCase()) || null;
