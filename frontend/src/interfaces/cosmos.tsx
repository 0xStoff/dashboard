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

export const chains: Chain[] = [
    {
        id: "akash-network",
        name: "Akash",
        endpoint: "https://akash-rest.publicnode.com",
        decimals: 6,
        wallets: ['akash158duhhed5hetqrege957h0rq98jadl6l3ssn0w'],
        logo_url: "https://cryptologos.cc/logos/akash-network-akt-logo.png?v=035",
        symbol: "AKT"
    }, {
        id: "dymension",
        name: "Dymension",
        endpoint: "https://dymension-rest.publicnode.com",
        decimals: 18,
        wallets: ['dym1qla0rgq3wv69z7uzv32z7l4p3advhw8wh8rzlp'],
        logo_url: "https://s2.coinmarketcap.com/static/img/coins/200x200/28932.png",
        symbol: "DYM"
    }, {
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