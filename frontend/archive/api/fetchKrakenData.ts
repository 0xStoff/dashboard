export const fetchKrakenData = ()=> ({
    total_usd_value: 1200.75, // Total USD value of assets in Kraken
    tokens: [
        {
            id: "btc",
            name: "Bitcoin",
            symbol: "BTC",
            usd_value: 1000, // Value in USD
            quantity: 0.025,
            logo_url: "https://example.com/btc-logo.png", // Optional
        },
        {
            id: "eth",
            name: "Ethereum",
            symbol: "ETH",
            usd_value: 200.75, // Value in USD
            quantity: 0.15,
            logo_url: "https://example.com/eth-logo.png", // Optional
        },
    ],
    chainMetadata: [
        {
            id: "kraken",
            name: "Kraken",
            chain: "kraken",
            usd_value: 1200.75,
            logo_url: "https://example.com/kraken-logo.png", // Optional
        },
    ],
});