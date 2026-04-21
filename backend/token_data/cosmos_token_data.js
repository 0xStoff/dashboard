import axios from "axios";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";
import fetchTokenPrice from "../utils/coingecko_api.js";
import { nonEvmChains } from "../utils/chainlist.js";
import { downloadLogo } from "../utils/download_logo.js";

const COSMOS_CHAIN_ID = "cosmos";

const symbolPrefixMap = {
    AKT: "akash",
    SAGA: "saga",
    ATOM: "cosmos",
    OSMO: "osmo",
    SEI: "sei",
    KUJI: "kujira",
    TIA: "celestia",
};

const manualDeriveMap = {
    DYM: () => "dym1qla0rgq3wv69z7uzv32z7l4p3advhw8wh8rzlp",
    INJ: () => "inj1tlr42l84gs4tmgq4kwytaz7n08hd08c7ncc6p5",
};

const getCosmosChains = () => nonEvmChains.filter((chain) => chain.id !== "sol");

const deriveAddressForChain = (baseAddress, symbol) => {
    if (manualDeriveMap[symbol]) {
        return manualDeriveMap[symbol](baseAddress);
    }

    const prefix = symbolPrefixMap[symbol];
    if (!prefix) {
        return null;
    }

    const { data } = fromBech32(baseAddress);
    return toBech32(prefix, data);
};

const fetchBalanceForChainWallet = async (chain, walletAddress) => {
    try {
        const response = await axios.get(`${chain.endpoint}/cosmos/bank/v1beta1/balances/${walletAddress}`);
        const balances = Array.isArray(response.data?.balances) ? response.data.balances : [];

        return balances
            .filter((balance) => !balance.denom.startsWith("ibc/") && !balance.denom.startsWith("factory/"))
            .reduce(
                (sum, balance) => sum + (Number.parseInt(balance.amount, 10) || 0) / Math.pow(10, chain.decimals),
                0
            );
    } catch (error) {
        console.error(`Failed to fetch ${chain.name} balances for ${walletAddress}:`, error.message);
        return 0;
    }
};

const fetchStakingForChainWallet = async (chain, walletAddress) => {
    try {
        const [delegationsResponse, unbondingsResponse] = await Promise.all([
            axios.get(`${chain.endpoint}/cosmos/staking/v1beta1/delegations/${walletAddress}`),
            axios.get(`${chain.endpoint}/cosmos/staking/v1beta1/delegators/${walletAddress}/unbonding_delegations`),
        ]);

        const activeDelegations = (delegationsResponse.data?.delegation_responses || []).reduce(
            (sum, delegation) => sum + (Number.parseInt(delegation?.balance?.amount, 10) || 0),
            0
        );

        const unbondingDelegations = (unbondingsResponse.data?.unbonding_responses || []).reduce(
            (sum, unbonding) =>
                sum +
                (unbonding.entries || []).reduce(
                    (entrySum, entry) => entrySum + (Number.parseInt(entry.balance, 10) || 0),
                    0
                ),
            0
        );

        return (activeDelegations + unbondingDelegations) / Math.pow(10, chain.decimals);
    } catch (error) {
        console.error(`Failed to fetch ${chain.name} staking for ${walletAddress}:`, error.message);
        return 0;
    }
};

const removeMissingCosmosRows = async (walletId, retainedTokenIds) => {
    const cosmosTokenIds = (
        await TokenModel.findAll({
            where: { chain_id: COSMOS_CHAIN_ID },
            attributes: ["id"],
        })
    ).map((token) => token.id);

    if (!cosmosTokenIds.length) {
        return;
    }

    const staleTokenIds = cosmosTokenIds.filter((tokenId) => !retainedTokenIds.includes(tokenId));
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

export const fetchCosmosTokens = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [["id", "ASC"]],
            where: { chain: "cosmos" },
        });

        if (!wallets.length) {
            return [];
        }

        const cosmosChains = getCosmosChains();

        const tokenDefinitions = await Promise.all(
            cosmosChains.map(async (chain) => {
                const price = await fetchTokenPrice(chain.id);
                const logoPath = chain.logo_url ? await downloadLogo(chain.logo_url, chain.symbol) : null;
                const [dbToken] = await TokenModel.upsert(
                    {
                        chain_id: COSMOS_CHAIN_ID,
                        name: chain.name,
                        symbol: chain.symbol,
                        decimals: chain.decimals,
                        logo_path: logoPath,
                        price: price.usd,
                        price_24h_change: price.usd_24h_change,
                    },
                    { conflictFields: ["chain_id", "symbol"], returning: true }
                );

                return {
                    ...chain,
                    dbToken,
                    price: Number(price.usd || 0),
                };
            })
        );

        const chainSummaries = tokenDefinitions.map((chain) => ({
            ...chain,
            amount: 0,
            usd_value: 0,
        }));

        for (const wallet of wallets) {
            const retainedTokenIds = [];

            for (const chain of tokenDefinitions) {
                const derivedAddress = deriveAddressForChain(wallet.wallet, chain.symbol);
                if (!derivedAddress) {
                    continue;
                }

                const [liquidAmount, stakingAmount] = await Promise.all([
                    fetchBalanceForChainWallet(chain, derivedAddress),
                    fetchStakingForChainWallet(chain, derivedAddress),
                ]);

                const amount = liquidAmount + stakingAmount;
                if (amount <= 0) {
                    continue;
                }

                retainedTokenIds.push(chain.dbToken.id);

                await WalletTokenModel.upsert(
                    {
                        wallet_id: wallet.id,
                        user_id: wallet.user_id,
                        token_id: chain.dbToken.id,
                        amount,
                        raw_amount: amount * Math.pow(10, chain.decimals),
                        usd_value: amount * chain.price,
                    },
                    {
                        conflictFields: ["wallet_id", "token_id"],
                        returning: true,
                    }
                );

                const summary = chainSummaries.find((item) => item.symbol === chain.symbol);
                if (summary) {
                    summary.amount += amount;
                    summary.usd_value += amount * chain.price;
                }
            }

            await removeMissingCosmosRows(wallet.id, retainedTokenIds);
        }

        return chainSummaries
            .filter((chain) => chain.amount > 0)
            .map(({ dbToken, ...chain }) => chain);
    } catch (error) {
        console.error("Failed to fetch Cosmos data:", error);
        return null;
    }
};
