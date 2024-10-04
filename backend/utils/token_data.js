import {downloadLogo} from "./download_logo.js";
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {Connection, PublicKey} from "@solana/web3.js";
import {Raydium} from "@raydium-io/raydium-sdk-v2";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";
import fetchDebankData from "./debank_api.js";
import fetchTokenPrice from "./coingecko_api.js";
import {nonEvmChains} from "./chainlist.js";
import axios from "axios";
import {fromBech32, toBech32} from "@cosmjs/encoding";

const fetchAndSaveEvmTokenData = async (walletId, walletAddress) => {

    try {
        const tokens = await fetchDebankData('/user/all_token_list', {id: walletAddress, is_all: false})

        for (const token of tokens) {
            const {id, chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change} = token;
            const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;

            const [dbToken, created] = await TokenModel.upsert({
                chain_id: chain, name, symbol, decimals, logo_path: logoPath, price, price_24h_change
            }, {
                conflictFields: ['chain_id', 'symbol'], returning: true
            });

            const usd_value = amount * price;

            await WalletTokenModel.upsert({
                wallet_id: walletId, token_id: dbToken.id, amount, raw_amount, usd_value
            });
        }

        console.log(`Token data successfully saved/updated for wallet ID ${walletId}`);
    } catch (error) {
        console.error(`Error fetching or saving token data for wallet ID ${walletId}:`, error.message);
    }
};

export const fetchAndSaveEvmTokenDataForAllWallets = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [['id', 'ASC']], where: {chain: 'evm'}
        });

        for (const wallet of wallets) {
            await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet);
        }

        console.log('Token data for all wallets successfully updated');
    } catch (error) {
        console.error('Error fetching token data for all wallets:', error.message);
    }
};

// Fetch and save Solana token data
export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const solMetaData = nonEvmChains.find(chain => chain.id === 'sol')

    const connection = new Connection(solMetaData.endpoint);
    const owner = new PublicKey(walletAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {programId: TOKEN_PROGRAM_ID});
    const balance = await connection.getBalance(owner);

    const solPrice = await fetchTokenPrice('solana') || {usd: 0};

    let tokenData = [{
        amount: balance / 10 ** 9, usd: solPrice.usd, ...nonEvmChains.find(chain => chain.id === 'sol')
    }];

    const raydium = await Raydium.load({
        connection, owner, disableLoadToken: false
    });

    for (const accountInfo of tokenAccounts.value) {
        const parsedAccountInfo = accountInfo.account.data.parsed.info;
        const tokenAddress = parsedAccountInfo.mint;

        const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);

        if (tokenInfo) {
            const tokenPrice = await fetchTokenPrice(tokenInfo.extensions.coingeckoId || '');
            if (tokenPrice) {
                tokenData.push({
                    ...tokenInfo, amount: parsedAccountInfo.tokenAmount.uiAmount, usd: tokenPrice.usd
                });
            }
        }
    }

    tokenData = tokenData.filter(token => token.amount > 0);

    for (const token of tokenData) {
        const {name, symbol, decimals, logoURI, amount, usd} = token;

        const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;

        const [dbToken] = await TokenModel.upsert({
            chain_id: 'sol', name, symbol, decimals, logo_path: logoPath, price: usd,
        }, {conflictFields: ['chain_id', 'symbol'], returning: true});


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
            order: [['id', 'ASC']], where: {chain: 'sol'}
        });
        for (const wallet of wallets) {
            await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
        }

        console.log('Token data for all Solana wallets successfully updated');
    } catch (error) {
        console.error('Error fetching Solana token data for all wallets:', error.message);
    }
};

// Helper to calculate total value of items
const calculateTotalValue = (items, priceField) => items.reduce((sum, item) => {
    const price = priceField.split('.').reduce((o, i) => o?.[i], item);
    return sum + (item.amount * (price || 0));
}, 0);

// Aggregate chain data to compute total value and amounts
const aggregateChainData = (chainName, result) => {
    const filteredData = result.filter(r => r.chain === chainName);
    const allData = filteredData.flatMap(r => r.data);
    return {
        totalValue: calculateTotalValue(allData, 'price.usd'),
        amount: allData.reduce((sum, item) => (sum + item.amount), 0), // price: allData[0]?.price?.usd
    };
};

// Fetch balances for a given chain
const fetchBalances = async (chain) => {
    const balanceResults = [];
    for (const wallet of chain.wallets) {
        const balanceUrl = `${chain.endpoint}/cosmos/bank/v1beta1/balances/${wallet}`;
        try {
            const response = await axios.get(balanceUrl);
            const balances = response.data.balances.map(token => ({
                denom: token.denom, amount: parseInt(token.amount, 10) / Math.pow(10, chain.decimals),
            }));

            const nonIbcBalances = balances.filter(b => !b.denom.startsWith('ibc/') && !b.denom.startsWith('factory/'));
            balanceResults.push({chain: chain.name, type: 'Balance', data: nonIbcBalances});
        } catch (error) {
            console.error(`Error fetching balances for ${chain.name} (${wallet}):`, error.message);
            balanceResults.push({chain: chain.name, type: 'Balance', data: [], error: error.message});
        }
    }
    return balanceResults;
};

// Fetch staking data for a given chain
const fetchStakings = async (chain) => {
    const stakingResults = [];
    for (const wallet of chain.wallets) {
        const stakingUrl = `${chain.endpoint}/cosmos/staking/v1beta1/delegations/${wallet}`;
        try {
            const response = await axios.get(stakingUrl);

            const stakedAmounts = response.data.delegation_responses.map(delegationResponse => ({
                validator: delegationResponse.delegation.validator_address,
                amount: parseInt(delegationResponse.balance.amount, 10) / Math.pow(10, chain.decimals)
            }));

            stakingResults.push({chain: chain.name, type: 'Staking', data: stakedAmounts});
        } catch (error) {
            console.error(`Error fetching staking data for ${chain.name} (${wallet}):`, error.message);
            stakingResults.push({chain: chain.name, type: 'Staking', data: [], error: error.message});
        }
    }
    return stakingResults;
};


const deriveCorrespondingAddresses = (cosmosAddresses) => {
    const symbolPrefixMap = {
        AKT: "akash",
        DYM: "dym",
        SAGA: "saga",
        ATOM: "cosmos",
        OSMO: "osmo",
        SEI: "sei",
        KUJI: "kujira",
        TIA: "celestia",
        INJ: "inj"
    };

    return cosmosAddresses.reduce((acc, baseAddress) => {
        const {data} = fromBech32(baseAddress);

        Object.entries(symbolPrefixMap).forEach(([symbol, prefix]) => {
            const derivedAddress = toBech32(prefix, data);
            if (!acc[symbol]) {
                acc[symbol] = [];
            }
            acc[symbol].push(derivedAddress);
        });

        return acc;
    }, {});
};

// Function to fetch and return the chains with the derived addresses
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


// Fetch data from node and combine balance and staking results
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
        const cosmosBalances = await fetchNode(cosmosWallets, cosmosChains);


        let total = 0;
        return await Promise.all(cosmosChains.map(async (chain) => {
            const {totalValue, amount} = aggregateChainData(chain.name, cosmosBalances);
            const price = await fetchTokenPrice(chain.id);

            total += totalValue;

            return {
                ...chain, usd_value: totalValue, price: price.usd, amount
            };
        }));

    } catch (error) {
        console.error("Failed to fetch Cosmos data:", error);
        return null;
    }
};
