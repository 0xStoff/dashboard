import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";
import { fetchTokenPriceCoingecko } from "../api/fetchTokenPriceCoingecko.js";
import { staticDataConfig } from "../config/staticData.js";
import { downloadLogo } from "../utils/download_logo.js";

const SUI_CHAIN_ID = "sui";
const ENABLE_STATIC_CHAIN_SYNC = process.env.ENABLE_STATIC_CHAIN_SYNC === "true";

const SUI_TOKEN_CONFIGS = [
    {
        id: "sui",
        name: "Sui",
        symbol: "SUI",
        decimals: 9,
        logoUrl: "https://cryptologos.cc/logos/sui-sui-logo.png?v=035",
        priceKey: "sui",
        matchCoinType: (coinType) => coinType === "0x2::sui::SUI",
        getAmount: ({ stakingBalance, liquidBalance }) => stakingBalance + liquidBalance,
    },
    {
        id: "deep",
        name: "DEEP",
        symbol: "DEEP",
        decimals: 6,
        logoUrl: "https://s2.coinmarketcap.com/static/img/coins/200x200/33391.png",
        priceKey: "deep",
        matchCoinType: (coinType) => coinType.includes("::deep::DEEP") || coinType.includes("DEEP"),
        getAmount: ({ balancesByType }) => balancesByType.DEEP || 0,
    },
];

const createTokenRecord = ({ token, price, amount, walletId }) => ({
    chain_id: token.chainId || SUI_CHAIN_ID,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    logo_url: token.logoUrl,
    price: price?.usd || 0,
    price_24h_change: (price?.price_24h_change || 0) * 100,
    amount: amount || 0,
    walletId,
});

const removeMissingWalletRows = async (walletId, chainId, retainedTokenIds) => {
    const chainTokenIds = (
        await TokenModel.findAll({
            where: { chain_id: chainId },
            attributes: ["id"],
        })
    ).map((token) => token.id);

    if (!chainTokenIds.length) {
        return;
    }

    const staleTokenIds = chainTokenIds.filter((tokenId) => !retainedTokenIds.includes(tokenId));
    if (!staleTokenIds.length) {
        return;
    }

    await WalletTokenModel.destroy({
        where: {
            wallet_id: walletId,
            token_id: staleTokenIds,
        },
    });
};

const persistWalletTokens = async ({ chainId, walletId, tokens }) => {
    const retainedTokenIds = [];

    for (const token of tokens) {
        const logoPath = token.logo_url ? await downloadLogo(token.logo_url, token.symbol) : null;
        const [dbToken] = await TokenModel.upsert(
            {
                chain_id: chainId,
                name: token.name,
                symbol: token.symbol,
                decimals: token.decimals,
                logo_path: logoPath,
                price: token.price,
                price_24h_change: token.price_24h_change,
            },
            { conflictFields: ["chain_id", "symbol"], returning: true }
        );

        retainedTokenIds.push(dbToken.id);

        await WalletTokenModel.upsert({
            wallet_id: walletId,
            token_id: dbToken.id,
            amount: token.amount,
            raw_amount: token.amount * 10 ** token.decimals,
            usd_value: token.amount * token.price,
        });
    }

    await removeMissingWalletRows(walletId, chainId, retainedTokenIds);
};

export const writeAptosDataToDB = async () => {
    try {
        const aptosData = await fetchAptosData();
        if (!aptosData) {
            console.log("Skipping Aptos static sync because no private config is present");
            return;
        }

        await persistWalletTokens({
            chainId: "aptos",
            walletId: aptosData.walletId,
            tokens: aptosData.tokens,
        });

        console.log("Aptos token data successfully saved/updated");
    } catch (error) {
        console.error("Error saving Aptos token data:", error.message);
    }
};

export const writeStaticDataToDB = async () => {
    try {
        if (!ENABLE_STATIC_CHAIN_SYNC) {
            console.log("Skipping manual static token sync because ENABLE_STATIC_CHAIN_SYNC is not enabled");
            return;
        }

        const staticData = await fetchStaticData();
        if (!staticData.length) {
            console.log("Skipping static token sync because no private config is present");
            return;
        }

        for (const chainData of staticData) {
            await persistWalletTokens({
                chainId: chainData.chainId,
                walletId: chainData.walletId,
                tokens: chainData.tokens,
            });

            console.log(`Static token data successfully saved/updated for chain ${chainData.chainId}`);
        }
    } catch (error) {
        console.error("Error saving static token data:", error.message);
    }
};

export const writeSuiDataToDB = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [["id", "ASC"]],
            where: { chain: SUI_CHAIN_ID },
        });

        if (!wallets.length) {
            console.log("Skipping Sui sync because no tracked Sui wallets were found");
            return;
        }

        const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
        const prices = await Promise.all(
            SUI_TOKEN_CONFIGS.map((token) => fetchTokenPriceCoingecko(token.priceKey))
        );

        for (const wallet of wallets) {
            const [coins, stakes] = await Promise.all([
                client.getAllCoins({ owner: wallet.wallet }),
                client.getStakes({ owner: wallet.wallet }),
            ]);

            const balancesByType = (coins.data || []).reduce((accumulator, coin) => {
                const matchingConfig = SUI_TOKEN_CONFIGS.find((token) => token.matchCoinType(coin.coinType));
                if (!matchingConfig) {
                    return accumulator;
                }

                accumulator[matchingConfig.symbol] =
                    (accumulator[matchingConfig.symbol] || 0) + Number(coin.balance || 0) / 10 ** matchingConfig.decimals;

                return accumulator;
            }, {});

            const stakingBalance = (stakes || []).reduce(
                (sum, stake) =>
                    sum +
                    (stake.stakes || []).reduce(
                        (stakeSum, entry) => stakeSum + Number(entry.principal || 0) / 10 ** SUI_TOKEN_CONFIGS[0].decimals,
                        0
                    ),
                0
            );

            const liquidBalance = balancesByType.SUI || 0;
            const tokens = SUI_TOKEN_CONFIGS.map((token, index) =>
                createTokenRecord({
                    token,
                    price: prices[index],
                    amount: token.getAmount({ balancesByType, stakingBalance, liquidBalance }),
                    walletId: wallet.id,
                })
            ).filter((token) => token.amount > 0);

            await persistWalletTokens({
                chainId: SUI_CHAIN_ID,
                walletId: wallet.id,
                tokens,
            });
        }

        console.log("Sui token data successfully saved/updated");
    } catch (error) {
        console.error("Error saving Sui token data:", error.message);
    }
};

export const fetchAptosData = async () => {
    const aptosConfigData = staticDataConfig.aptos;
    if (!aptosConfigData?.walletAddress || !aptosConfigData?.stakingPoolAddress || !aptosConfigData?.walletId) {
        return null;
    }

    const config = new AptosConfig({ network: Network.MAINNET });
    const aptosClient = new Aptos(config);

    const [stakingActivities, aptosBalance, aptosPrice] = await Promise.all([
        aptosClient.staking.getDelegatedStakingActivities({
            poolAddress: aptosConfigData.stakingPoolAddress,
            delegatorAddress: aptosConfigData.walletAddress,
        }),
        aptosClient.getAccountAPTAmount({ accountAddress: aptosConfigData.walletAddress }),
        fetchTokenPriceCoingecko(aptosConfigData.priceKey),
    ]);

    let unlockedTotal = 0;
    let withdrawnTotal = 0;

    stakingActivities.forEach((activity) => {
        const type = activity.event_type;

        if (type === "0x1::delegation_pool::UnlockStakeEvent" || type === "0x1::delegation_pool::UnlockStake") {
            unlockedTotal += activity.amount;
        } else if (
            type === "0x1::delegation_pool::WithdrawStakeEvent" ||
            type === "0x1::delegation_pool::WithdrawStake"
        ) {
            withdrawnTotal += activity.amount;
        }
    });

    const undelegated = (unlockedTotal - withdrawnTotal) / 1e8;
    const liquid = aptosBalance / 1e8;
    const amount = undelegated + liquid;

    return {
        walletId: aptosConfigData.walletId,
        tokens: [
            {
                name: "Aptos",
                symbol: aptosConfigData.symbol,
                decimals: aptosConfigData.decimals,
                logo_url: aptosConfigData.logoUrl,
                price: aptosPrice?.usd || 0,
                price_24h_change: (aptosPrice?.price_24h_change || 0) * 100,
                amount,
            },
        ],
    };
};

export const fetchStaticData = async () => {
    return Promise.all(
        staticDataConfig.staticChains.map(async (chain) => {
            const price = await fetchTokenPriceCoingecko(chain.priceKey);

            return {
                chainId: chain.chainId || chain.id,
                walletId: chain.walletId || chain.id,
                tokens: [
                    {
                        name: chain.name,
                        symbol: chain.symbol,
                        decimals: chain.decimals,
                        logo_url: chain.logoUrl,
                        price: price?.usd || 0,
                        price_24h_change: (price?.price_24h_change || 0) * 100,
                        amount: chain.amount,
                    },
                ],
            };
        })
    );
};
