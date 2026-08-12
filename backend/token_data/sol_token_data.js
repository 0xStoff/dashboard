import {nonEvmChains} from "../utils/chainlist.js";
import {Connection, PublicKey} from "@solana/web3.js";
import {TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import fetchTokenPrice from "../utils/coingecko_api.js";
import {downloadLogo} from "../utils/download_logo.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";

const deleteMissingSolTokenRows = async ({ walletId, retainedTokenIds }) => {
    const rows = await WalletTokenModel.findAll({ where: { wallet_id: walletId } });
    const staleRows = rows.filter((row) => !retainedTokenIds.includes(row.token_id));

    if (!staleRows.length) {
        return;
    }

    await WalletTokenModel.destroy({
        where: {
            wallet_id: walletId,
            token_id: staleRows.map((row) => row.token_id),
        },
    });
};

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
        return null;
    }
}

async function fetchTokenByMint(mint) {
    try {
        const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`);
        if (!res.ok) return null;
        const tokens = await res.json();
        const token = Array.isArray(tokens) ? tokens.find(candidate => candidate.id === mint) : null;
        if (!token) return null;

        return {
            address: token.id,
            mint: token.id,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.icon,
            extensions: {
                coingeckoId: token.coingeckoId || undefined,
                tags: token.tags || [],
                jupUsdPrice: typeof token.usdPrice === 'number' ? token.usdPrice : undefined,
                jup24hPriceChange: token?.stats24h?.priceChange ?? undefined,
            },
        };
    } catch (error) {
        console.warn(`Jupiter token lookup failed for ${mint}: ${error.message}`);
        return null;
    }
}

export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const wallet = await WalletModel.findByPk(walletId);
    if (!wallet) {
        return;
    }

    const solMetaData = nonEvmChains.find(chain => chain.id === 'sol');

    const connection = new Connection(solMetaData.endpoint);
    const owner = new PublicKey(walletAddress);

    const [classicAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
    ]);
    const tokenAccounts = [...classicAccounts.value, ...token2022Accounts.value];

    const balance = await connection.getBalance(owner);
    const tokenList = await fetchSolTokenList() ?? [];
    const wrappedSol = tokenList.find(token => token.address === 'So11111111111111111111111111111111111111112');
    const fallbackSolPrice = wrappedSol?.extensions?.jupUsdPrice == null
        ? await fetchTokenPrice('solana')
        : null;
    const solUsd = wrappedSol?.extensions?.jupUsdPrice ?? fallbackSolPrice?.usd ?? 0;
    const solChange = wrappedSol?.extensions?.jup24hPriceChange ?? fallbackSolPrice?.usd_24h_change ?? 0;

    let tokenData = [{
        amount: balance / 10 ** 9,
        usd: solUsd,
        price_24h_change: solChange,
        logoURI: solMetaData.logo_url,
        ...nonEvmChains.find(chain => chain.id === 'sol')
    }];

    let incompleteMetadata = false;

    for (const accountInfo of tokenAccounts) {
        const parsedAccountInfo = accountInfo.account.data.parsed.info;
        const tokenAddress = parsedAccountInfo.mint;
        const amount = Number(parsedAccountInfo.tokenAmount.uiAmountString || 0);
        if (amount <= 0) continue;

        const tokenInfo = tokenList.find(token => token.address === tokenAddress) ?? await fetchTokenByMint(tokenAddress);

        if (tokenInfo) {
            let coingeckoId = tokenInfo.extensions?.coingeckoId;
            if (tokenInfo.symbol === "PENGU") coingeckoId = 'pudgy-penguins';

            const fallbackUsd = tokenInfo.extensions?.jupUsdPrice;
            let tokenPrice = null;
            if (fallbackUsd == null && coingeckoId) {
                tokenPrice = await fetchTokenPrice(coingeckoId);
            }

            const fallbackChange = tokenInfo.extensions?.jup24hPriceChange ?? 0;

            const finalUsd = fallbackUsd ?? tokenPrice?.usd ?? 0;
            const finalChange = tokenPrice?.usd_24h_change ?? fallbackChange;

            if (finalUsd !== null && finalUsd !== undefined) {
                tokenData.push({
                    ...tokenInfo,
                    amount,
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
        } else {
            // Do not remove a previously displayed holding just because the
            // external metadata service temporarily failed to identify it.
            incompleteMetadata = true;
        }

    }

    tokenData = tokenData.filter(token => token.amount > 0);

    const retainedTokenIds = [];

    for (const token of tokenData) {
        const { name, symbol, decimals, logoURI, amount, usd, price_24h_change, address, mint } = token;

        const existingToken = await TokenModel.findOne({ where: { chain_id: 'sol', symbol } });
        const downloadedLogoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;
        const logoPath = downloadedLogoPath || existingToken?.logo_path || null;

        const [dbToken] = await TokenModel.upsert({
            chain_id: 'sol',
            name,
            symbol,
            contract_address: address || mint || null,
            decimals,
            logo_path: logoPath,
            price: usd,
            price_24h_change
        }, { conflictFields: ['chain_id', 'symbol'], returning: true });
        retainedTokenIds.push(dbToken.id);

        const raw_amount = amount * 10 ** decimals;
        const usd_value = amount * usd;

        await WalletTokenModel.upsert({
            wallet_id: walletId, user_id: wallet.user_id, token_id: dbToken.id, amount, raw_amount, usd_value
        }, { conflictFields: ['wallet_id', 'token_id'] });
    }

    if (!incompleteMetadata) {
        await deleteMissingSolTokenRows({ walletId, retainedTokenIds });
    }

    console.log('Token data successfully saved/updated for a Solana wallet');
};

export const fetchAndSaveSolTokenDataForAllWallets = async (userId) => {
    const wallets = await WalletModel.findAll({
            order: [['id', 'ASC']], where: { chain: 'sol', ...(userId ? { user_id: userId } : {}) }
        });
    for (const wallet of wallets) {
        await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
    }
    return { walletsUpdated: wallets.length };
};
