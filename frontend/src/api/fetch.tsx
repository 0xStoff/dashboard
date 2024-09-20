import axios from "axios";
import {Account} from "../interfaces/account";
import {fetchTokenPrice} from "./fetchSolanaTokens";



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


// Define the API response structures if not already defined
interface BalanceApiResponse {
    balances: Array<{
        denom: string; amount: string;
    }>;
}

interface StakingApiResponse {
    delegation_responses: Array<{
        delegation: {
            validator_address: string; shares: string;
        }; balance: {
            denom: string; amount: string;
        };
    }>;
}

export interface Chain {
    id: string;
    name: string;
    endpoint: string;
    decimals: number;
    wallets: string[];
    logo_url: string;
    symbol: string;
}

export interface TokenBalance {
    denom: string;
    amount: number;
}

export interface StakedAmount {
    validator: string;
    amount: number;
}

export interface FetchResult {
    chain: string;
    type: 'Balance' | 'Staking';
    data: TokenBalance[] | StakedAmount[];
    error?: string;
}

export const chains: Chain[] = [
    {
    id: "akash-network",
    name: "Akash",
    endpoint: "https://akash-rest.publicnode.com",
    decimals: 6,
    wallets: ['akash158duhhed5hetqrege957h0rq98jadl6l3ssn0w'],
    logo_url: "https://cryptologos.cc/logos/akash-network-akt-logo.png?v=035",
    symbol: "AKT"
},{
    id: "dymension",
    name: "Dymension",
    endpoint: "https://dymension-rest.publicnode.com",
    decimals: 18,
    wallets: ['dym1qla0rgq3wv69z7uzv32z7l4p3advhw8wh8rzlp'],
    logo_url: "https://s2.coinmarketcap.com/static/img/coins/200x200/28932.png",
    symbol: "DYM"
},{
    id: "saga-2",
    name: "Saga",
    endpoint: "https://saga-rest.publicnode.com",
    decimals: 6,
    wallets: ['saga1kdjwfc8rhjd744qvmza6qzv3d5k9wzudwqm9m7'],
    logo_url: "https://pbs.twimg.com/profile_images/1508474357315616768/zcPXETKs_400x400.jpg",
    symbol: "SAGA"
}, {
    id: "cosmos",
    name: "Cosmos Hub",
    endpoint: "https://cosmos-rest.publicnode.com",
    decimals: 6,
    wallets: ['cosmos158duhhed5hetqrege957h0rq98jadl6luta5k5'],
    logo_url: "https://cryptologos.cc/logos/cosmos-atom-logo.png?v=035",
    symbol: "ATOM"
}, {
    id: "osmosis",
    name: "Osmosis",
    endpoint: "https://osmosis-rest.publicnode.com",
    decimals: 6,
    wallets: ['osmo158duhhed5hetqrege957h0rq98jadl6l5swyqx'],
    logo_url: "https://cryptologos.cc/logos/osmosis-osmo-logo.png",
    symbol: "OSMO"
}, {
    id: "sei-network",
    name: "Sei",
    endpoint: "https://sei-rest.publicnode.com",
    decimals: 6,
    wallets: ['sei158duhhed5hetqrege957h0rq98jadl6l38vzs4'],
    logo_url: "https://s3.coinmarketcap.com/static-gravity/image/992744cfbd5e40f5920018ee7a830b98.png",
    symbol: "SEI"
}, {
    id: "kujira",
    name: "Kujira",
    endpoint: "https://kujira-rest.publicnode.com",
    decimals: 6,
    wallets: ['kujira158duhhed5hetqrege957h0rq98jadl6ldrlvm7'],
    logo_url: "https://seeklogo.com/images/K/kujira-kuji-logo-AD5D735DCD-seeklogo.com.png",
    symbol: "KUJI"
}, {
    id: "celestia",
    name: "Celestia",
    endpoint: "https://celestia-rest.publicnode.com",
    decimals: 6,
    wallets: ['celestia1kdjwfc8rhjd744qvmza6qzv3d5k9wzudpen8x4', 'celestia158duhhed5hetqrege957h0rq98jadl6ldpvyve'],
    logo_url: "https://cryptologos.cc/logos/celestia-tia-logo.png?v=035",
    symbol: "TIA"
}, {
    id: "injective-protocol",
    name: "Injective",
    endpoint: "https://injective-rest.publicnode.com",
    decimals: 18,
    wallets: ['inj1tlr42l84gs4tmgq4kwytaz7n08hd08c7ncc6p5'],
    logo_url: "https://cryptologos.cc/logos/injective-inj-logo.png?v=035",
    symbol: "INJ"
}];

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

        const promises = chains.flatMap(chain => [
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

//*Get user total balance on all supported chains
// *Get user complex protocol list
// *Get a list of token balances on all supported chains
//

//         const response = await axios.post('https://arbitrum.publicnode.com', {
//             jsonrpc: "2.0", method: "eth_getBalance", params: ["0x770353615119F0f701118d3A4eaf1FE57fA00F84", "latest"], id: 1
//         });
//
//         const balanceInWei = response.data.result;
//         const balanceInEth = balanceInWei / 1e18;
//         console.log(`Balance in ETH: ${balanceInEth}`);

// curl -X POST https://arbitrum.publicnode.com \
//     -H "Content-Type: application/json" \
// -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x6e04f6242703b9b29811fc5e2e5c2556db4c0c82","latest"],"id":1}'

// curl -X 'GET' 'https://pro-openapi.debank.com/v1/user/total_balance?id=0x6e04f6242703b9b29811fc5e2e5c2556db4c0c82' \
// -H 'accept: application/json' -H 'AccessKey: 330226b6d83919220b43d1be654d83fb98492d70'
// curl -X GET "https://pro-openapi.debank.com/v1/user/all_complex_protocol_list?id=0x6e04f6242703b9b29811fc5e2e5c2556db4c0c82&chain_ids=matic,arb,eth,op" \
// -H "accept: application/json" -H "AccessKey: 330226b6d83919220b43d1be654d83fb98492d70"
// curl -X 'GET' \
//   'https://pro-openapi.debank.com/v1/user/all_token_list?id=0x6e04f6242703b9b29811fc5e2e5c2556db4c0c82&is_all=true' \
//   -H 'accept: application/json' -H 'AccessKey: 330226b6d83919220b43d1be654d83fb98492d70'

// Get user protocol
// curl -X 'GET' \
//   'https://pro-openapi.debank.com/v1/user/protocol?id=0x770353615119F0f701118d3A4eaf1FE57fA00F84&protocol_id=0x' \
//   -H 'accept: application/json' -H 'AccessKey: 330226b6d83919220b43d1be654d83fb98492d70'


// Get user token list
// curl -X 'GET' \
//   'https://pro-openapi.debank.com/v1/user/token_list?id=0x770353615119F0f701118d3A4eaf1FE57fA00F84&chain_id=arb&is_all=true' \
//   -H 'accept: application/json' -H 'AccessKey: 330226b6d83919220b43d1be654d83fb98492d70'
//
// curl https://api.mainnet-beta.solana.com/ -X POST -H "Content-Type: application/json" -d '
// {
//     "jsonrpc": "2.0", "id": 1,
//     "method": "getBalance",
//     "params": [
//     "BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq"
// ]
// }
// '


//
// curl -X GET "https://pro-openapi.debank.com/v1/user/all_complex_protocol_list?id=0x9c4da1823855d1a69dc73da74082336f8fdbdc96&chain_ids=matic,arb,eth,era" \
// -H "accept: application/json" -H "AccessKey: 330226b6d83919220b43d1be654d83fb98492d70"




// export const fetchNode = async (): Promise<FetchResult[]> => {
//
//     const fetchBalances = async (chain: Chain): Promise<FetchResult | null> => {
//         const balanceUrl = `${chain.endpoint}/cosmos/bank/v1beta1/balances/${chain.wallets[0]}`;
//         try {
//             const response = await axios.get<BalanceApiResponse>(balanceUrl);
//
//             const balances: TokenBalance[] = response.data.balances.map(token => ({
//                 denom: token.denom, amount: parseInt(token.amount, 10) / Math.pow(10, chain.decimals),
//             }));
//             return {chain: chain.name, type: 'Balance', data: balances};
//         } catch (error) {
//             const errorMessage = error instanceof Error ? error.toString() : 'Unknown error';
//             return {chain: chain.name, type: 'Balance', data: [], error: errorMessage};
//         }
//
//     };
//
//     const fetchStakings = async (chain: Chain): Promise<FetchResult> => {
//         const stakingUrl = `${chain.endpoint}/cosmos/staking/v1beta1/delegations/${chain.wallets[0]}`;
//         try {
//             const response = await axios.get<StakingApiResponse>(stakingUrl);
//             const stakedAmounts: StakedAmount[] = response.data.delegation_responses.map((delegationResponse) => ({
//                 validator: delegationResponse.delegation.validator_address, amount: parseInt(delegationResponse.balance.amount, 10) / Math.pow(10, chain.decimals),
//             }));
//             return {chain: chain.name, type: 'Staking', data: stakedAmounts};
//         } catch (error) {
//             const errorMessage = error instanceof Error ? error.toString() : 'Unknown error';
//             return {chain: chain.name, type: 'Staking', data: [], error: errorMessage};
//         }
//
//     };
//
//     try {
//         const promises = chains.flatMap(chain => [fetchBalances(chain), fetchStakings(chain)]);
//         const results = await Promise.allSettled(promises);
//
//         results.forEach(result => {
//             if (result.status === 'fulfilled' && result.value) {
//                 console.log(result.value);
//             } else if (result.status === 'rejected') {
//                 console.error(result.reason);
//             }
//         });
//     } catch (error) {
//         console.error('An error occurred:', error);
//     }
//
//     try {
//         const promises = chains.flatMap((chain) => [
//             fetchBalances(chain),
//             fetchStakings(chain),
//         ]);
//         const results = await Promise.allSettled(promises);
//
//         return results.map((result) => {
//             if (result.status === 'fulfilled' && result.value) {
//                 return result.value;
//             } else if (result.status === 'rejected') {
//                 // Return a default error object or handle as needed
//                 return {
//                     chain: '',
//                     type: 'Error',
//                     data: [],
//                     error: 'Error fetching data',
//                 };
//             }
//         }).filter((result): result is FetchResult => result !== undefined);
//     } catch (error) {
//         console.error('An error occurred:', error);
//         throw error; // Re-throw the error if you want to handle it in the component as well
//     }
// };



