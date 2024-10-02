import axios from "axios";

export const evmChains = async () => {
    const response = await axios.get('https://pro-openapi.debank.com/v1/chain/list', {
        headers: {
            accept: 'application/json', AccessKey: process.env.RABBY_ACCESS_KEY,
        },
    });
    return response.data
}

export const nonEvmChains = [{
    id: "akash-network",
    name: "Akash",
    endpoint: "https://akash-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://cryptologos.cc/logos/akash-network-akt-logo.png?v=035",
    symbol: "AKT"
}, {
    id: "dymension",
    name: "Dymension",
    endpoint: "https://dymension-rest.publicnode.com",
    decimals: 18,
    logo_url: "https://s2.coinmarketcap.com/static/img/coins/200x200/28932.png",
    symbol: "DYM"
}, {
    id: "saga-2",
    name: "Saga",
    endpoint: "https://saga-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://pbs.twimg.com/profile_images/1508474357315616768/zcPXETKs_400x400.jpg",
    symbol: "SAGA"
}, {
    id: "cosmos",
    name: "Cosmos Hub",
    endpoint: "https://cosmos-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://cryptologos.cc/logos/cosmos-atom-logo.png?v=035",
    symbol: "ATOM"
}, {
    id: "osmosis",
    name: "Osmosis",
    endpoint: "https://osmosis-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://cryptologos.cc/logos/osmosis-osmo-logo.png",
    symbol: "OSMO"
}, {
    id: "sei-network",
    name: "Sei",
    endpoint: "https://sei-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://s3.coinmarketcap.com/static-gravity/image/992744cfbd5e40f5920018ee7a830b98.png",
    symbol: "SEI"
}, {
    id: "kujira",
    name: "Kujira",
    endpoint: "https://kujira-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://seeklogo.com/images/K/kujira-kuji-logo-AD5D735DCD-seeklogo.com.png",
    symbol: "KUJI"
}, {
    id: "celestia",
    name: "Celestia",
    endpoint: "https://celestia-rest.publicnode.com",
    decimals: 6,
    logo_url: "https://cryptologos.cc/logos/celestia-tia-logo.png?v=035",
    symbol: "TIA"
}, {
    id: "injective-protocol",
    name: "Injective",
    endpoint: "https://injective-rest.publicnode.com",
    decimals: 18,
    logo_url: "https://cryptologos.cc/logos/injective-inj-logo.png?v=035",
    symbol: "INJ"
}, {
    id: "solana",
    name: "Solana",
    endpoint: "https://solana-rpc.publicnode.com/",
    decimals: 9,
    logo_url: "https://cryptologos.cc/logos/solana-sol-logo.png?v=035",
    symbol: "SOL",
}];