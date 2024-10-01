import { BalanceApiResponse, Chain, chains, FetchResult, StakedAmount, StakingApiResponse, TokenBalance } from "../interfaces/cosmos";
import axios from "axios";
import { fetchTokenPrice } from "./fetchTokenPriceCoingecko";

// Helper to calculate total value of items
const calculateTotalValue = (items: any[], priceField: string) =>
    items.reduce((sum, item) => {
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
        price: allData[0]?.price?.usd
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

            stakingResults.push({ chain: chain.name, type: 'Staking', data: stakedAmounts });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error fetching staking data for ${chain.name} (${wallet}): ${errorMessage}`);
            stakingResults.push({ chain: chain.name, type: 'Staking', data: [], error: errorMessage });
        }
    }
    return stakingResults;
};

// Fetch data from node and combine balance and staking results
const fetchNode = async (): Promise<FetchResult[]> => {
    const cosmosChains = await chains();
    const promises = cosmosChains.flatMap(chain => [fetchBalances(chain), fetchStakings(chain)]);

    const results = await Promise.allSettled(promises);

    return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
};

// Fetch Cosmos tokens, utilizing caching and refetch mechanisms
export const fetchCosmosTokens = async () => {
    try {
        // Load from localStorage if available
        const storedCosmosChains = localStorage.getItem('cosmosChains');
        const storedCosmosBalances = localStorage.getItem('cosmosBalances');

        let cosmosChains = storedCosmosChains ? JSON.parse(storedCosmosChains) : await chains();
        let cosmosBalances = storedCosmosBalances ? JSON.parse(storedCosmosBalances) : await fetchNode();

        // Filter out empty data arrays before caching
        cosmosBalances = cosmosBalances.filter(result => result.data && result.data.length > 0);

        // Cache chains and non-empty balances
        if (!storedCosmosChains) localStorage.setItem('cosmosChains', JSON.stringify(cosmosChains));
        if (cosmosBalances.length > 0) localStorage.setItem('cosmosBalances', JSON.stringify(cosmosBalances));

        // Calculate total values
        let total = 0;
        const chainMetadata = cosmosChains.map(chain => {
            const { totalValue, amount, price } = aggregateChainData(chain.name, cosmosBalances);
            total += totalValue;
            return { ...chain, usd_value: totalValue, usd: price, amount, address: chain.wallets[0] };
        });

        // Merge and structure Cosmos data
        const mergedCosmos = chainMetadata.map((chain, index) => ({
            id: chain.id,
            name: chain.name,
            symbol: chain.symbol,
            decimals: chain.decimals,
            logo_url: chain.logo_url,
            price: chain.usd,
            amount: chain.amount,
            is_core: true,
            wallets: [{ tag: chain.symbol, id: index + 16, wallet: chain.address, amount: chain.amount }],
        }));

        // Final Cosmos structure
        const cosmos = {
            chains: { total_usd_value: total, chain_list: [chainMetadata] },
            id: 16,
            protocols: [],
            tag: "Cosmos",
            tokens: mergedCosmos,
            wallet: "cosmos1kdjwfc8rhjd744qvmza6qzv3d5k9wzudsnzhuc",
        };

        return { chainMetadata, mergedCosmos, cosmos };
    } catch (error) {
        console.error("Failed to fetch Cosmos data:", error);
        return null;
    }
};