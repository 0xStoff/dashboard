import { nonEvmChains } from "../utils/chainlist.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fetchTokenPrice from "../utils/coingecko_api.js";
import { downloadLogo } from "../utils/download_logo.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";

// Small helper so we can politely rate-limit external APIs
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch a JSON token list without relying on SDK internals
// 1) Raydium maintained JSON (official + unofficial)
// 2) Fallback to Jupiter v2 verified list
async function fetchSolTokenList() {
    try {
        const res = await fetch(
            "https://api.raydium.io/v2/sdk/token/solana.mainnet.json",
            { method: "GET" }
        );
        if (res.ok) {
            const data = await res.json();
            const arr = [...(data.official || []), ...(data.unOfficial || [])];
            const byMint = new Map(
                arr.map((t) => [
                    t.mint,
                    {
                        address: t.mint,
                        symbol: t.symbol,
                        name: t.name,
                        decimals: t.decimals,
                        logoURI: t.logoURI,
                        extensions: t.extensions || {},
                    },
                ])
            );
            return byMint;
        }
    } catch (e) {
        console.warn("Raydium token JSON fetch failed:", e?.message || e);
    }

    // Fallback: Jupiter Token API V2 (verified set)
    try {
        const res = await fetch(
            "https://lite-api.jup.ag/tokens/v2/tag?query=verified",
            { method: "GET" }
        );
        if (res.ok) {
            const arr = await res.json();
            const byMint = new Map(
                arr.map((t) => [
                    t.address ?? t.mint,
                    {
                        address: t.address ?? t.mint,
                        symbol: t.symbol,
                        name: t.name,
                        decimals: t.decimals,
                        logoURI: t.logoURI || t.logoURI_png || t.logoURI_svg,
                        extensions: t.extensions || {},
                    },
                ])
            );
            return byMint;
        }
    } catch (e) {
        console.warn("Jupiter V2 token list fetch failed:", e?.message || e);
    }

    // Last resort: empty map so the job still completes
    return new Map();
}

export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const solMetaData = nonEvmChains.find((chain) => chain.id === "sol");

    const connection = new Connection(solMetaData.endpoint);
    const owner = new PublicKey(walletAddress);

    // Ensure Pump is included if present
    const pumpMintStr = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
    const pumpMint = new PublicKey(pumpMintStr);

    const pumpAccount = await connection.getParsedTokenAccountsByOwner(owner, {
        mint: pumpMint,
        programId: TOKEN_PROGRAM_ID,
    });

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
        programId: TOKEN_PROGRAM_ID,
    });

    if (pumpAccount.value.length > 0) {
        const alreadyIncluded = tokenAccounts.value.some(
            (acc) => acc.account.data.parsed.info.mint === pumpMintStr
        );
        if (!alreadyIncluded) {
            for (const pAcc of pumpAccount.value) {
                tokenAccounts.value.push({
                    pubkey: pAcc.pubkey,
                    account: { data: { parsed: pAcc.account.data.parsed } },
                });
            }
        }
    }

    // Native SOL balance & price
    const balanceLamports = await connection.getBalance(owner);
    const solPrice = (await fetchTokenPrice("solana")) || { usd: 0 };

    let tokenData = [
        {
            amount: balanceLamports / 10 ** 9,
            usd: solPrice.usd,
            price_24h_change: solPrice.usd_24h_change,
            logoURI: "SOL.png",
            ...nonEvmChains.find((chain) => chain.id === "sol"),
        },
    ];

    // Use JSON token list(s) instead of SDK
    const tokenListByMint = await fetchSolTokenList();
    console.log(tokenListByMint)

    for (const accountInfo of tokenAccounts.value) {
        const parsedAccountInfo = accountInfo.account.data.parsed.info;
        const tokenAddress = parsedAccountInfo.mint; // mint address

        const tokenInfo = tokenListByMint.get(tokenAddress);

        if (tokenInfo) {
            // Prefer Coingecko id from extensions if provided
            let coingeckoId = tokenInfo.extensions?.coingeckoId;
            // Special-case mapping
            if (tokenInfo.symbol === "PENGU") coingeckoId = "pudgy-penguins";

            const tokenPrice = await fetchTokenPrice(coingeckoId || "");

            if (tokenPrice) {
                tokenData.push({
                    ...tokenInfo,
                    amount: parsedAccountInfo.tokenAmount.uiAmount,
                    usd: tokenPrice.usd,
                    price_24h_change: tokenPrice.usd_24h_change,
                });
            }
        } else if (tokenAddress === pumpMintStr) {
            const tokenPrice = await fetchTokenPrice("pump-fun");
            tokenData.push({
                symbol: "PUMP",
                name: "Pump",
                logoURI:
                    "https://s2.coinmarketcap.com/static/img/coins/64x64/36507.png",
                decimals: 9,
                address: tokenAddress,
                amount: parsedAccountInfo.tokenAmount.uiAmount,
                usd: tokenPrice?.usd || 0,
                price_24h_change: tokenPrice?.usd_24h_change || 0,
            });
        }

        await delay(500);
    }

    tokenData = tokenData.filter((token) => token.amount > 0);

    for (const token of tokenData) {
        const { name, symbol, decimals, logoURI, amount, usd, price_24h_change } =
            token;

        const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;

        const [dbToken] = await TokenModel.upsert(
            {
                chain_id: "sol",
                name,
                symbol,
                decimals,
                logo_path: logoPath,
                price: usd,
                price_24h_change,
            },
            { conflictFields: ["chain_id", "symbol"], returning: true }
        );

        const raw_amount = amount * 10 ** decimals;
        const usd_value = amount * usd;

        await WalletTokenModel.upsert({
            wallet_id: walletId,
            token_id: dbToken.id,
            amount,
            raw_amount,
            usd_value,
        });
    }

    console.log(
        `Token data successfully saved/updated for Solana wallet ID ${walletId}`
    );
};

export const fetchAndSaveSolTokenDataForAllWallets = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [["id", "ASC"]],
            where: { chain: "sol" },
        });
        for (const wallet of wallets) {
            await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
        }
    } catch (error) {
        console.error("Error fetching Solana token data for all wallets:", error.message);
    }
};