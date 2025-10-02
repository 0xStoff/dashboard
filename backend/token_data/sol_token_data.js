import {nonEvmChains} from "../utils/chainlist.js";
import {Connection, PublicKey} from "@solana/web3.js";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import fetchTokenPrice from "../utils/coingecko_api.js";
import {downloadLogo} from "../utils/download_logo.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";

// ---- Jupiter-only token list (maps to our existing structure) ----
async function fetchSolTokenList() {
    try {
        // Verified tokens are a good baseline
        const res = await fetch(
            'https://lite-api.jup.ag/tokens/v2/tag?query=verified',
            { method: 'GET' }
        );
        if (!res.ok) throw new Error('Jupiter responded with HTTP ' + res.status);
        const arr = await res.json();

        // Map Jupiter schema -> our internal tokenInfo schema
        return arr.map(t => ({
            address: t.id,
            mint: t.id,
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
            logoURI: t.icon,
            extensions: {
                coingeckoId: t.coingeckoId || undefined,
                tags: t.tags || [],
                jupUsdPrice: typeof t.usdPrice === 'number' ? t.usdPrice : undefined,
                jup24hPriceChange: t?.stats24h?.priceChange ?? undefined
            }
        }));
    } catch (e) {
        console.warn('Jupiter token list fetch failed:', e?.message || e);
        return [];
    }
}

export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const solMetaData = nonEvmChains.find(chain => chain.id === 'sol');

    const connection = new Connection(solMetaData.endpoint);
    const owner = new PublicKey(walletAddress);

    const pumpAccount = await connection.getParsedTokenAccountsByOwner(owner, {
        mint: new PublicKey("pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn"),
        programId: TOKEN_PROGRAM_ID
    });

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });

    if (pumpAccount.value.length > 0) {
        const pumpMint = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
        const alreadyIncluded = tokenAccounts.value.some(acc => acc.account.data.parsed.info.mint === pumpMint);
        if (!alreadyIncluded) {
            for (const pumpAcc of pumpAccount.value) {
                tokenAccounts.value.push({
                    pubkey: pumpAcc.pubkey,
                    account: {
                        data: {
                            parsed: pumpAcc.account.data.parsed
                        }
                    }
                });
            }
        }
    }

    const balance = await connection.getBalance(owner);
    const solPrice = await fetchTokenPrice('solana') || { usd: 0 };

    let tokenData = [{
        amount: balance / 10 ** 9,
        usd: solPrice.usd,
        price_24h_change: solPrice.usd_24h_change,
        logoURI: "SOL.png",
        ...nonEvmChains.find(chain => chain.id === 'sol')
    }];

    const tokenList = await fetchSolTokenList();

    for (const accountInfo of tokenAccounts.value) {
        const parsedAccountInfo = accountInfo.account.data.parsed.info;
        const tokenAddress = parsedAccountInfo.mint;

        const tokenInfo = tokenList.find(token => token.address === tokenAddress);

        if (tokenInfo) {
            let coingeckoId = tokenInfo.extensions?.coingeckoId;
            if (tokenInfo.symbol === "PENGU") coingeckoId = 'pudgy-penguins';

            let tokenPrice = null;
            if (coingeckoId) {
                tokenPrice = await fetchTokenPrice(coingeckoId);
            }

            const fallbackUsd = tokenInfo.extensions?.jupUsdPrice ?? 0;
            const fallbackChange = tokenInfo.extensions?.jup24hPriceChange ?? 0;

            const finalUsd = tokenPrice?.usd ?? fallbackUsd;
            const finalChange = tokenPrice?.usd_24h_change ?? fallbackChange;

            if (finalUsd !== null && finalUsd !== undefined) {
                tokenData.push({
                    ...tokenInfo,
                    amount: parsedAccountInfo.tokenAmount.uiAmount,
                    usd: finalUsd,
                    price_24h_change: finalChange
                });
            }
        } else if (tokenAddress === "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn") {
            const tokenPrice = await fetchTokenPrice("pump-fun");
            tokenData.push({
                symbol: "PUMP",
                name: "Pump",
                logoURI: 'https://s2.coinmarketcap.com/static/img/coins/64x64/36507.png',
                decimals: 9,
                address: tokenAddress,
                amount: parsedAccountInfo.tokenAmount.uiAmount,
                usd: tokenPrice?.usd || 0,
                price_24h_change: tokenPrice?.usd_24h_change || 0
            });
        }

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        await delay(500);
    }

    tokenData = tokenData.filter(token => token.amount > 0);

    for (const token of tokenData) {
        const { name, symbol, decimals, logoURI, amount, usd, price_24h_change } = token;

        const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;

        const [dbToken] = await TokenModel.upsert({
            chain_id: 'sol', name, symbol, decimals, logo_path: logoPath, price: usd, price_24h_change
        }, { conflictFields: ['chain_id', 'symbol'], returning: true });

        const raw_amount = amount * 10 ** decimals;
        const usd_value = amount * usd;

        await WalletTokenModel.upsert({
            wallet_id: walletId, token_id: dbToken.id, amount, raw_amount, usd_value
        });
    }

    console.log(`Token data successfully saved/updated for Solana wallet ID ${walletId}`);
};

export const fetchAndSaveSolTokenDataForAllWallets = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [['id', 'ASC']], where: { chain: 'sol' }
        });
        for (const wallet of wallets) {
            await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
        }
    } catch (error) {
        console.error('Error fetching Solana token data for all wallets:', error.message);
    }
};