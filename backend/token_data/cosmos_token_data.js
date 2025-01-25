import WalletModel from "../models/WalletModel.js";
import fetchTokenPrice from "../utils/coingecko_api.js";
import {nonEvmChains} from "../utils/chainlist.js";
import axios from "axios";
import {fromBech32, toBech32} from "@cosmjs/encoding";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";
import {downloadLogo} from "../utils/download_logo.js";

// Helper function to calculate total value
const calculateTotalValue = (items, price) => items.reduce((sum, item) => sum + (item.amount * (price.usd || 0)), 0);

// Aggregate chain data to compute total value and amounts
const aggregateChainData = (chainName, result, price) => {
    const chainData = result.filter(r => r.chain === chainName).flatMap(r => r.data);
    return {
        totalValue: calculateTotalValue(chainData, price), amount: chainData.reduce((sum, item) => sum + item.amount, 0)
    };
};

// Fetch balances for a given chain
const fetchBalances = async (chain) => {
    return await Promise.all(chain.wallets.map(async wallet => {
        try {
            const {data: {balances}} = await axios.get(`${chain.endpoint}/cosmos/bank/v1beta1/balances/${wallet}`);
            return {
                chain: chain.name, type: 'Balance', data: balances.map(b => ({
                    denom: b.denom, amount: parseInt(b.amount, 10) / Math.pow(10, chain.decimals)
                })).filter(b => !b.denom.startsWith('ibc/') && !b.denom.startsWith('factory/'))
            };
        } catch (error) {
            return {chain: chain.name, type: 'Balance', data: [], error: error.message};
        }
    }));
};

// Fetch staking data for a given chain
const fetchStakings = async (chain) => {
    return await Promise.all(chain.wallets.map(async wallet => {
        try {
            const {data: {delegation_responses}} = await axios.get(`${chain.endpoint}/cosmos/staking/v1beta1/delegations/${wallet}`);
            return {
                chain: chain.name, type: 'Staking', data: delegation_responses.map(d => ({
                    validator: d.delegation.validator_address,
                    amount: parseInt(d.balance.amount, 10) / Math.pow(10, chain.decimals)
                }))
            };
        } catch (error) {
            return {chain: chain.name, type: 'Staking', data: [], error: error.message};
        }
    }));
};

// Derive corresponding addresses
const deriveCorrespondingAddresses = (cosmosAddresses) => {
    const symbolPrefixMap = {
        AKT: "akash", SAGA: "saga", ATOM: "cosmos", OSMO: "osmo", SEI: "sei", KUJI: "kujira", TIA: "celestia"
    };

    const manualDeriveMap = {
        DYM: () => 'dym1qla0rgq3wv69z7uzv32z7l4p3advhw8wh8rzlp',
        INJ: () => 'inj1tlr42l84gs4tmgq4kwytaz7n08hd08c7ncc6p5'
    };

    const derivedAddresses = cosmosAddresses.reduce((acc, baseAddress) => {
        const { data } = fromBech32(baseAddress);

        Object.entries(symbolPrefixMap).forEach(([symbol, prefix]) => {
            acc[symbol] = acc[symbol] || [];
            acc[symbol].push(toBech32(prefix, data));
        });

        return acc;
    }, {});

    Object.entries(manualDeriveMap).forEach(([symbol, deriveFn]) => {
        derivedAddresses[symbol] = [deriveFn()];
    });

    return derivedAddresses;
};

// Function to fetch and return the chains with derived addresses
const chains = (wallets) => {
    if (!wallets || wallets.length === 0) return [];

    const cosmosAddresses = wallets.map(({wallet}) => wallet);
    const derivedAddresses = deriveCorrespondingAddresses(cosmosAddresses);

    return nonEvmChains
        .filter(chain => chain.id !== 'sol')
        .map(chain => ({
            id: chain.id,
            name: chain.name,
            endpoint: chain.endpoint,
            decimals: chain.decimals,
            wallets: derivedAddresses[chain.symbol] || [],
            logo_url: chain.logo_url,
            symbol: chain.symbol
        }));
};

const fetchNode = async (wallets) => {
    const cosmosChains = chains(wallets);
    const promises = cosmosChains.flatMap(chain => [fetchBalances(chain), fetchStakings(chain)]);
    const results = await Promise.allSettled(promises);
    return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
};

// Main function to fetch Cosmos tokens
export const fetchCosmosTokens = async () => {
    try {
        const cosmosWallets = await WalletModel.findAll({
            order: [['id', 'ASC']], where: {chain: 'cosmos'}
        });

        const cosmosChains = chains(cosmosWallets);
        const cosmosBalances = await fetchNode(cosmosWallets);



        let total = 0;
        return await Promise.all(cosmosChains.map(async (chain, i) => {

            const {id, name, symbol, decimals, logo_url} = chain;
            const price = await fetchTokenPrice(id);

            const logoPath = logo_url ? await downloadLogo(logo_url, symbol) : null;

            const [dbToken] = await TokenModel.upsert({
                chain_id: 'cosmos', name, symbol, decimals, logo_path: logoPath, price: price.usd, price_24h_change: price.usd_24h_change
            }, {conflictFields: ['chain_id', 'symbol'], returning: true});

            const {totalValue, amount} = aggregateChainData(chain.name, cosmosBalances, price);


            await Promise.all(chain.wallets.map(async (wallet, index) => {
                    await WalletTokenModel.upsert({
                        wallet_id: 16,
                        token_id: dbToken.id,
                        amount,
                        usd_value: totalValue
                    }, {
                        conflictFields: ['wallet_id', 'token_id'],
                        returning: true
                    });
            }));


            total += totalValue;
            return {...chain, usd_value: totalValue, price: price.usd, amount};
        }));

    } catch (error) {
        console.error("Failed to fetch Cosmos data:", error);
        return null;
    }
};

