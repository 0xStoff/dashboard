import {fromBech32, toBech32, fromBase64, toBase64, fromHex, toHex} from "@cosmjs/encoding";

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

export const chains: () => Promise<({
    symbol: string; endpoint: string; logo_url: string; decimals: number; name: string; wallets: string[]; id: string
})[]> = async () => {

    // Function to derive corresponding addresses for different chains
    function deriveCorrespondingAddresses(cosmosAddresses) {
        const prefixes = [
            "cosmos",
            "osmo",
            "celestia",
            "akash",
            "saga",
            "sei",
            "kujira",
            "dym",
            "inj"
        ];

        return cosmosAddresses.reduce((acc, baseAddress) => {
            const { data } = fromBech32(baseAddress);

            prefixes.forEach(prefix => {
                const derivedAddress = toBech32(prefix, data);
                if (!acc[prefix]) {
                    acc[prefix] = [];
                }
                acc[prefix].push(derivedAddress);
            });

            return acc;
        }, {});
    }


    // Example: Multiple Cosmos base addresses
    const cosmosAddresses = [
        "cosmos158duhhed5hetqrege957h0rq98jadl6luta5k5",
        "cosmos1kdjwfc8rhjd744qvmza6qzv3d5k9wzudsnzhuc",
        "cosmos16klm7csdvz86x98xu827hd6tnsjvdc98ducran"
        ]

    const derivedAddresses = deriveCorrespondingAddresses(cosmosAddresses);

    // console.log("Hardcoded dym: ", "dym1qla0rgq3wv69z7uzv32z7l4p3advhw8wh8rzlp")
    // console.log("Hardcoded inj: ", "inj1tlr42l84gs4tmgq4kwytaz7n08hd08c7ncc6p5")
    // const { data } = fromBech32("cosmos158duhhed5hetqrege957h0rq98jadl6luta5k5");
    // console.log(toBech32('inj',data))


    // console.log("derived dym: ", deriveCorrespondingAddresses(["cosmos16klm7csdvz86x98xu827hd6tnsjvdc98ducran"]).dym)
    // console.log("derived inj: ", deriveCorrespondingAddresses(["cosmos158duhhed5hetqrege957h0rq98jadl6luta5k5"]).inj)

    return [{
        id: "akash-network",
        name: "Akash",
        endpoint: "https://akash-rest.publicnode.com",
        decimals: 6,
        wallets: derivedAddresses["akash"],
        logo_url: "https://cryptologos.cc/logos/akash-network-akt-logo.png?v=035",
        symbol: "AKT"
    }, {
        id: "dymension",
        name: "Dymension",
        endpoint: "https://dymension-rest.publicnode.com",
        decimals: 18,
        wallets: ["dym1qla0rgq3wv69z7uzv32z7l4p3advhw8wh8rzlp"],
        logo_url: "https://s2.coinmarketcap.com/static/img/coins/200x200/28932.png",
        symbol: "DYM"
    }, {
        id: "saga-2",
        name: "Saga",
        endpoint: "https://saga-rest.publicnode.com",
        decimals: 6,
        wallets: derivedAddresses["saga"],
        logo_url: "https://pbs.twimg.com/profile_images/1508474357315616768/zcPXETKs_400x400.jpg",
        symbol: "SAGA"
    }, {
        id: "cosmos",
        name: "Cosmos Hub",
        endpoint: "https://cosmos-rest.publicnode.com",
        decimals: 6,
        wallets: cosmosAddresses,
        logo_url: "https://cryptologos.cc/logos/cosmos-atom-logo.png?v=035",
        symbol: "ATOM"
    }, {
        id: "osmosis",
        name: "Osmosis",
        endpoint: "https://osmosis-rest.publicnode.com",
        decimals: 6,
        wallets: derivedAddresses["osmo"],
        logo_url: "https://cryptologos.cc/logos/osmosis-osmo-logo.png",
        symbol: "OSMO"
    }, {
        id: "sei-network",
        name: "Sei",
        endpoint: "https://sei-rest.publicnode.com",
        decimals: 6,
        wallets: derivedAddresses["sei"],
        logo_url: "https://s3.coinmarketcap.com/static-gravity/image/992744cfbd5e40f5920018ee7a830b98.png",
        symbol: "SEI"
    }, {
        id: "kujira",
        name: "Kujira",
        endpoint: "https://kujira-rest.publicnode.com",
        decimals: 6,
        wallets: derivedAddresses["kujira"],
        logo_url: "https://seeklogo.com/images/K/kujira-kuji-logo-AD5D735DCD-seeklogo.com.png",
        symbol: "KUJI"
    }, {
        id: "celestia",
        name: "Celestia",
        endpoint: "https://celestia-rest.publicnode.com",
        decimals: 6,
        wallets:  derivedAddresses["celestia"],
        logo_url: "https://cryptologos.cc/logos/celestia-tia-logo.png?v=035",
        symbol: "TIA"
    }, {
        id: "injective-protocol",
        name: "Injective",
        endpoint: "https://injective-rest.publicnode.com",
        decimals: 18,
        wallets: ["inj1tlr42l84gs4tmgq4kwytaz7n08hd08c7ncc6p5"],
        logo_url: "https://cryptologos.cc/logos/injective-inj-logo.png?v=035",
        symbol: "INJ"
    }]
};