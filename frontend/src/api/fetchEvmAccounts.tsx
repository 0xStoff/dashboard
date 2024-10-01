import axios, { AxiosRequestConfig } from 'axios';
import { mergeAndAggregateChains, mergeAndAggregateTokens, mergeProtocols } from '../utils/data-transform';
import { Account } from '../interfaces/account';

async function fetchDataForAccount(id: string): Promise<any> {
    const storedData = localStorage.getItem(id);
    if (storedData) return JSON.parse(storedData);

    const endpoints = {
        totalBalance: 'https://pro-openapi.debank.com/v1/user/total_balance',
        allTokenList: 'https://pro-openapi.debank.com/v1/user/all_token_list',
        allComplexProtocolList: 'https://pro-openapi.debank.com/v1/user/all_complex_protocol_list',
    };

    const axiosConfig: AxiosRequestConfig = {
        headers: {
            accept: 'application/json',
            AccessKey: process.env.REACT_APP_RABBY_ACCESS_KEY || '',
        },
    };

    try {
        const [totalBalance, allTokenList, allComplexProtocolList] = await Promise.all([
            axios.get(endpoints.totalBalance, { ...axiosConfig, params: { id } }),
            axios.get(endpoints.allTokenList, { ...axiosConfig, params: { id, is_all: 'true' } }),
            axios.get(endpoints.allComplexProtocolList, { ...axiosConfig, params: { id } }),
        ]);

        console.log('totalBalance -->', totalBalance)
        console.log('allTokenList -->', allTokenList)
        console.log('allComplexProtocolList -->', allComplexProtocolList)

        const data = {
            chains: totalBalance.data,
            tokens: allTokenList.data,
            protocols: allComplexProtocolList.data,
        };

        localStorage.setItem(id, JSON.stringify(data));
        return data;
    } catch (error) {
        console.error(`Error fetching data for account ${id}:`, error);
        return null;
    }
}

const fetchAllAccountsData = async (accounts: Account[] | null) => {
    if (!accounts) return [];

    const accountDataPromises = accounts.map(async (account) => {
        if (!account.wallet) return null;
        const data = await fetchDataForAccount(account.wallet);
        return data ? { ...account, ...data } : null;
    });

    const updatedAccounts = await Promise.all(accountDataPromises);
    return updatedAccounts.filter(account => account !== null);
};

export const fetchEvmAccounts = async (wallets: Account[]) => {
    try {
        const updated = await fetchAllAccountsData(wallets.filter(wallet => wallet.chain === 'evm'));

        if (!updated.length) {
            console.warn("No EVM accounts were fetched.");
            return { updated: [], allChains: [], allTokens: [], allProtocols: [] };
        }

        const allChains = mergeAndAggregateChains(updated);
        const allTokens = mergeAndAggregateTokens(updated);
        const allProtocols = mergeProtocols(updated);

        return { updated, allChains, allTokens, allProtocols };
    } catch (error) {
        console.error("Failed to fetch EVM accounts:", error);
        return { updated: [], allChains: [], allTokens: [], allProtocols: [] };
    }
};