// Function to fetch Solana tokens and return metadata
import {fetchNode} from "./fetch";
import {chains} from "../interfaces/cosmos";


const calculateTotalValue = (items: any[], priceField: string) => {
    return items.reduce((sum, item) => {
        const price = priceField.split('.').reduce((o, i) => o?.[i], item);
        return sum + (item.amount * (price || 0));
    }, 0);
};

const aggregateChainData = (chainName: string, result: any[]) => {
    const filteredData = result.filter(r => r.chain === chainName);
    const allData = filteredData.flatMap(r => r.data);
    return {
        totalValue: calculateTotalValue(allData, 'price.usd'),
        amount: allData.reduce((sum, item) => (sum + item.amount), 0),
        price: allData[0]?.price?.usd

    };
};


export const fetchCosmosTokens = async () => {
    try {

        const cosmosChains = await chains()

        // Fetch Cosmos data
        const result = await fetchNode();
        let total = 0;
        const chainMetadata = cosmosChains.map(chain => {
            const {totalValue, amount, price} = aggregateChainData(chain.name, result);
            total += totalValue;
            return {
                ...chain, usd_value: totalValue, usd: price, amount, address: chain.wallets[0],
            };
        });


        // Merge Cosmos data
        const mergedCosmos = chainMetadata.map((t, i) => ({
            id: t.id,
            name: t.name,
            symbol: t.symbol,
            decimals: t.decimals,
            logo_url: t.logo_url,
            price: t.usd,
            amount: t.amount,
            is_core: true,
            wallets: [{tag: t.symbol, id: i + 16, wallet: t.address, amount: t.amount}],
        }));


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
