const CANONICAL_TOKEN_LOGOS = new Map([
    ["ETH", "ETH.png"],
    ["HYPE", "hyper.png"],
]);

export const getCanonicalTokenLogo = (symbol) =>
    CANONICAL_TOKEN_LOGOS.get(String(symbol || "").toUpperCase()) || null;
