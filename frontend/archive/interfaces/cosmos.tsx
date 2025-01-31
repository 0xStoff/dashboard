export interface BalanceApiResponse {
    balances: Array<{
        denom: string; amount: string;
    }>;
}

export interface StakingApiResponse {
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

