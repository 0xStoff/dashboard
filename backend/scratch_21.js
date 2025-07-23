import { ethers } from "ethers";
import fetch from "node-fetch";
import fetchTokenPrice from "./utils/coingecko_api.js";

const walletAddress = "0x770353615119F0f701118d3A4eaf1FE57fA00F84";

const chains = {
    ethereum: new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/1a5b4096383b4e4e9dfdf2860119b483"),
    arbitrum: new ethers.JsonRpcProvider("https://arbitrum-mainnet.infura.io/v3/1a5b4096383b4e4e9dfdf2860119b483"),
};

const tokenLists = {
    ethereum: [
        "0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E".toLowerCase(), // ILV
    ],
    arbitrum: [
        "0x539bdE0d7Dbd336b79148AA742883198BBF60342".toLowerCase(), // MAGIC
    ]
};

const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
];

const coingeckoPlatformMap = {
    ethereum: "ethereum",
    arbitrum: "arbitrum-one",
};

const coingeckoIds = {
    ["0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E".toLowerCase()]: "illuvium",
    ["0x539bdE0d7Dbd336b79148AA742883198BBF60342".toLowerCase()]: "magic",
};

async function getTokenInfo(provider, tokenAddress, wallet) {
    console.log(`Fetching token info for ${tokenAddress} on wallet ${wallet}`);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [name, symbol, decimals, rawBalance] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.balanceOf(wallet),
    ]);
    console.log({ name, symbol, decimals, rawBalance: rawBalance.toString() });
    return {
        name,
        symbol,
        address: tokenAddress,
        decimals,
        balance: Number(rawBalance) / 10 ** decimals,
    };
}

async function getPricesFromCoingecko(addresses, chainId) {
    if (!addresses.length) return {};

    const platform = coingeckoPlatformMap[chainId];
    if (!platform) {
        console.warn(`No platform mapping for ${chainId}`);
        return {};
    }

    const contractAddrs = addresses.join(',');
    console.log(`Fetching prices for chain: ${platform}, tokens: ${contractAddrs}`);

    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${contractAddrs}&vs_currencies=usd`;

    try {
        const res = await fetch(url, {
            headers: {
                'x-cg-demo-api-key': 'CG-D1njX1mHKsrKykPuHMwCQX2L'
            }
        });
        const prices = await res.json();
        console.log('Prices fetched:', prices);
        console.log("Returned price keys:", Object.keys(prices));
        return prices;
    } catch (err) {
        console.error('Failed to fetch prices from Coingecko:', err);
        return {};
    }
}

async function scanChain(chainName, provider, tokens) {
    const tokenData = await Promise.all(
        tokens.map(addr => getTokenInfo(provider, addr, walletAddress).catch(() => null))
    );
    const filtered = tokenData.filter(Boolean);

    const prices = await getPricesFromCoingecko(
        filtered.map(t => t.address.toLowerCase()),
        chainName === 'ethereum' ? 'ethereum' : chainName
    );

    const result = await Promise.all(filtered.map(async token => {
        const addressLower = token.address.toLowerCase();
        console.log(`Looking up price for ${addressLower}`);
        const price = prices[addressLower]?.usd;
        if (typeof price === "number") {
            return { ...token, price, usdValue: token.balance * price };
        } else if (coingeckoIds[addressLower]) {
            console.log(`Calling fetchTokenPrice for ID: ${coingeckoIds[addressLower]}`);
            const fallbackPrice = await fetchTokenPrice(coingeckoIds[addressLower]);
            console.log(`fetchTokenPrice returned for ${coingeckoIds[addressLower]}: $${fallbackPrice}`);
            return { ...token, price: fallbackPrice, usdValue: token.balance * fallbackPrice };
        } else {
            console.warn(`No price found for ${token.symbol} (${token.address})`);
            return { ...token, price: 0, usdValue: 0 };
        }
    }));
    console.log(`Final token data on ${chainName}:`, result);
    return result;
}

async function scanAllChains() {
    const result = {};
    for (const [chain, provider] of Object.entries(chains)) {
        result[chain] = await scanChain(chain, provider, tokenLists[chain]);
    }
    console.log(JSON.stringify(result, null, 2));
}

scanAllChains();