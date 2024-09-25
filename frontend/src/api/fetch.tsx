import axios from "axios";
import {Account} from "../interfaces/account";
import {
    BalanceApiResponse,
    Chain,
    chains,
    FetchResult,
    StakedAmount,
    StakingApiResponse,
    TokenBalance
} from "../interfaces/cosmos";
import {fetchTokenPrice} from "./fetchTokenPriceCoingecko";



// Improved fetchDataForAccount function
async function fetchDataForAccount(id: string): Promise<any> {
    const storedData = localStorage.getItem(id);
    if (storedData) {
        return JSON.parse(storedData); // Parse the string back into an object
    }

    const endpoints = {
        totalBalance: 'https://pro-openapi.debank.com/v1/user/total_balance',
        allTokenList: 'https://pro-openapi.debank.com/v1/user/all_token_list',
        allComplexProtocolList: 'https://pro-openapi.debank.com/v1/user/all_complex_protocol_list'
    };

    const axiosConfig = {
        headers: {'accept': 'application/json', 'AccessKey': process.env.REACT_APP_RABBY_ACCESS_KEY}
    };

    try {
        const responses = await Promise.all([axios.get(endpoints.totalBalance, {
            ...axiosConfig, params: {id}
        }), axios.get(endpoints.allTokenList, {
            ...axiosConfig, params: {id, is_all: 'true'}
        }), axios.get(endpoints.allComplexProtocolList, {
            ...axiosConfig, params: {id}
        })]);

        const [totalBalance, allTokenList, allComplexProtocolList] = responses.map(response => response.data);
        const data = {chains: totalBalance, tokens: allTokenList, protocols: allComplexProtocolList};

        localStorage.setItem(id, JSON.stringify(data));
        return data;
    } catch (error) {
        console.error(`Error fetching data for account ${id}:`, error);
        throw new Error('Failed to fetch account data');
    }
}


export const fetchAllAccountsData = async (accounts: Account[] | null) => {
    if (!accounts) return []
    try {
        const accountDataPromises = accounts.map(async account => {
            if (account.wallet) {
                const data = await fetchDataForAccount(account.wallet);
                return ({...account, ...data});
            }
            return Promise.resolve(null);
        });

        const updatedAccounts = await Promise.all(accountDataPromises);
        return updatedAccounts.filter(account => account !== null);
    } catch (error) {
        console.error(`Error updating account data:`, error);
        throw new Error('Failed to update all accounts data');
    }
};


const fetchBalances = async (chain: Chain): Promise<FetchResult[]> => {
        const balanceResults: FetchResult[] = [];

        for (const wallet of chain.wallets) {
            const balanceUrl = `${chain.endpoint}/cosmos/bank/v1beta1/balances/${wallet}`;
            try {
                const response = await axios.get<BalanceApiResponse>(balanceUrl);
                const price = await fetchTokenPrice(chain.id);

                const balances: TokenBalance[] = response.data.balances.map(token => ({
                    denom: token.denom,
                    amount: parseInt(token.amount, 10) / Math.pow(10, chain.decimals),
                    price,
                }));

                const nonIbcBalances = balances.filter(b => !b.denom.startsWith('ibc/') && !b.denom.startsWith('factory/'));
                balanceResults.push({ chain: chain.name, type: 'Balance', data: nonIbcBalances });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Error fetching balances for ${chain.name} (${wallet}): ${errorMessage}`);
                balanceResults.push({ chain: chain.name, type: 'Balance', data: [], error: errorMessage });
            }
        }
        return balanceResults;
    };

    const fetchStakings = async (chain: Chain): Promise<FetchResult[]> => {
        const stakingResults: FetchResult[] = [];
        for (const wallet of chain.wallets) {
            const stakingUrl = `${chain.endpoint}/cosmos/staking/v1beta1/delegations/${wallet}`;
            try {
                const response = await axios.get<StakingApiResponse>(stakingUrl);
                const price = await fetchTokenPrice(chain.id);

                const stakedAmounts: StakedAmount[] = response.data.delegation_responses.map(delegationResponse => ({
                    validator: delegationResponse.delegation.validator_address,
                    amount: parseInt(delegationResponse.balance.amount, 10) / Math.pow(10, chain.decimals),
                    price,
                }));

                stakingResults.push({ chain: chain.name, type: 'Staking', data: stakedAmounts });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Error fetching stakings for ${chain.name} (${wallet}): ${errorMessage}`);
                stakingResults.push({ chain: chain.name, type: 'Staking', data: [], error: errorMessage });
            }
        }
        return stakingResults;
    };

    export const fetchNode = async (): Promise<FetchResult[]> => {
        const cosmosChains = await chains();
        console.log(cosmosChains)
        const promises = cosmosChains.flatMap(chain => [
            fetchBalances(chain),
            fetchStakings(chain)
        ]);

        const results = await Promise.allSettled(promises);

        // Flatten the results array and filter out any null or rejected results
        return results.flatMap(result =>
            result.status === 'fulfilled' && result.value
                ? result.value
                : []
        );
    };

