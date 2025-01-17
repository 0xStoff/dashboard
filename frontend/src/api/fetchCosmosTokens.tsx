import {
    BalanceApiResponse, Chain, FetchResult, StakedAmount, StakingApiResponse, TokenBalance
} from "../interfaces/cosmos";
import axios from "axios";
import {fetchTokenPrice} from "./fetchTokenPriceCoingecko";
import {fromBech32, toBech32} from "@cosmjs/encoding";
import {useFetchWallets} from "../hooks/useFetchWallets";

// Helper to calculate total value of items
const calculateTotalValue = (items: any[], priceField: string) => items.reduce((sum, item) => {
    const price = priceField.split('.').reduce((o, i) => o?.[i], item);
    return sum + (item.amount * (price || 0));
}, 0);

// Aggregate chain data to compute total value and amounts
const aggregateChainData = (chainName: string, result: any[]) => {
    const filteredData = result.filter(r => r.chain === chainName);
    const allData = filteredData.flatMap(r => r.data);
    return {
        totalValue: calculateTotalValue(allData, 'price.usd'),
        amount: allData.reduce((sum, item) => (sum + item.amount), 0),
        price: allData[0]?.price
    };
};

// Fetch balances for a given chain
const fetchBalances = async (chain: Chain): Promise<FetchResult[]> => {
    const balanceResults: FetchResult[] = [];
    for (const wallet of chain.wallets) {
        const balanceUrl = `${chain.endpoint}/cosmos/bank/v1beta1/balances/${wallet}`;
        try {
            const response = await axios.get<BalanceApiResponse>(balanceUrl);
            const price = await fetchTokenPrice(chain.id);

            const balances: TokenBalance[] = response.data.balances.map(token => ({
                denom: token.denom, amount: parseInt(token.amount, 10) / Math.pow(10, chain.decimals), price
            }));

            const nonIbcBalances = balances.filter(b => !b.denom.startsWith('ibc/') && !b.denom.startsWith('factory/'));
            balanceResults.push({chain: chain.name, type: 'Balance', data: nonIbcBalances});
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error fetching balances for ${chain.name} (${wallet}): ${errorMessage}`);
            balanceResults.push({chain: chain.name, type: 'Balance', data: [], error: errorMessage});
        }
    }
    return balanceResults;
};

// Fetch staking data for a given chain
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

            stakingResults.push({chain: chain.name, type: 'Staking', data: stakedAmounts});
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error fetching staking data for ${chain.name} (${wallet}): ${errorMessage}`);
            stakingResults.push({chain: chain.name, type: 'Staking', data: [], error: errorMessage});
        }
    }
    return stakingResults;
};

const chains = async (wallets): Promise<({
    symbol: string; endpoint: string; logo_url: string; decimals: number; name: string; wallets: string[]; id: string
})[]> => {

    if (!wallets) return [];

    function deriveCorrespondingAddresses(cosmosAddresses) {
        const prefixes = ["cosmos", "osmo", "celestia", "akash", "saga", "sei", "kujira", "dym", "inj"];

        return cosmosAddresses.reduce((acc, baseAddress) => {
            const {data} = fromBech32(baseAddress);

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


    // const cosmosAddresses = ["cosmos158duhhed5hetqrege957h0rq98jadl6luta5k5", "cosmos1kdjwfc8rhjd744qvmza6qzv3d5k9wzudsnzhuc", "cosmos16klm7csdvz86x98xu827hd6tnsjvdc98ducran"]

    const cosmosAddresses = wallets.map(({ wallet }) => wallet);
    const derivedAddresses = deriveCorrespondingAddresses(cosmosAddresses);


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
        wallets: derivedAddresses["celestia"],
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
// Fetch data from node and combine balance and staking results
const fetchNode = async (wallets): Promise<FetchResult[]> => {
    const cosmosChains = await chains(wallets);
    const promises = cosmosChains.flatMap(chain => [fetchBalances(chain), fetchStakings(chain)]);

    const results = await Promise.allSettled(promises);

    return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
};

// Fetch Cosmos tokens, utilizing caching and refetch mechanisms
export const fetchCosmosTokens = async (cosmosWallets) => {
    try {
        const storedCosmosChains = localStorage.getItem('cosmosChains');
        const storedCosmosBalances = localStorage.getItem('cosmosBalances');

        let cosmosChains = storedCosmosChains ? JSON.parse(storedCosmosChains) : await chains(cosmosWallets);
        let cosmosBalances = storedCosmosBalances ? JSON.parse(storedCosmosBalances) : await fetchNode(cosmosWallets);


        // Filter out empty data arrays before caching
        cosmosBalances = cosmosBalances.filter(result => result.data && result.data.length > 0);

        // Cache chains and non-empty balances
        if (!storedCosmosChains) localStorage.setItem('cosmosChains', JSON.stringify(cosmosChains));
        if (cosmosBalances.length > 0) localStorage.setItem('cosmosBalances', JSON.stringify(cosmosBalances));

        // Calculate total values
        let total = 0;
        const chainMetadata = cosmosChains.map(chain => {
            const {totalValue, amount, price, price_24h_change} = aggregateChainData(chain.name, cosmosBalances);
            total += totalValue;
            return {...chain, usd_value: totalValue, usd: price.usd, price_24h_change: price.price_24h_change, amount, address: chain.wallets[0]};
        });

        // Merge and structure Cosmos data
        const mergedCosmos = chainMetadata.map((chain, index) => ({
            id: chain.id,
            name: chain.name,
            symbol: chain.symbol,
            decimals: chain.decimals,
            logo_url: chain.logo_url,
            price: chain.usd,
            price_24h_change: chain.price_24h_change,
            amount: chain.amount,
            is_core: true,
            wallets: [{tag: chain.symbol, id: index + 16, wallet: chain.address, amount: chain.amount}],
        }));

        console.log(mergedCosmos)

        // Final Cosmos structure
        const cosmos = {
            chains: {total_usd_value: total, chain_list: [chainMetadata]},
            id: 16,
            protocols: [],
            tag: "Cosmos",
            tokens: mergedCosmos,
            wallet: "cosmos1kdjwfc8rhjd744qvmza6qzv3d5k9wzudsnzhuc",
        };

        return {chainMetadata, mergedCosmos, cosmos};
    } catch (error) {
        console.error("Failed to fetch Cosmos data:", error);
        return null;
    }
};