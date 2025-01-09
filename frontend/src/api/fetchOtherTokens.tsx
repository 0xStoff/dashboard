import {getFullnodeUrl, SuiClient} from '@mysten/sui/client';
import {fetchTokenPrice} from "./fetchTokenPriceCoingecko";
import {Aptos, AptosConfig, Network} from "@aptos-labs/ts-sdk";

const createTokenData = (id, name, symbol, decimals, logoUrl, price, amount, walletTag, walletId, walletAddress) => {
    return {
        id,
        name,
        symbol,
        decimals,
        logo_url: logoUrl,
        price: price || 0,
        amount: amount || 0,
        is_core: true,
        wallets: [{tag: walletTag, id: walletId, wallet: walletAddress, amount: amount || 0},],
    };
};

// Helper function to create chain data
const createChainData = (chainId, chainList, tag, tokens, walletAddress) => {
    const totalUsdValue = tokens.reduce((sum, token) => sum + token.amount * token.price, 0);
    return {
        chains: {total_usd_value: totalUsdValue, chain_list: chainList},
        id: chainId,
        protocols: [],
        tag,
        tokens,
        wallet: walletAddress,
    };
};


export const fetchSuiData = async () => {
    const rpcUrl = getFullnodeUrl('mainnet');
    const client = new SuiClient({url: rpcUrl});
    const suiAddress = "0xb0ff460367eae42bc92566dc50135dc12eed99ead8938d18f6b8c0dd0f41b11b";

    const [suiBalance, stakingData, suiPrice, deepPrice] = await Promise.all([client.getAllCoins({owner: suiAddress}), client.getStakes({owner: suiAddress}), fetchTokenPrice('sui'), fetchTokenPrice('deep')]);

    const suiAmount = stakingData[0]?.stakes[0]?.principal / 10 ** 9 + suiBalance.data[0]?.balance / 10 ** 9;
    const deepAmount = suiBalance.data.filter(coin => coin.coinType.includes("DEEP"))[0]?.balance / 10 ** 6 || 0;

    const tokens = [createTokenData('sui', 'Sui', 'SUI', 18, "https://cryptologos.cc/logos/sui-sui-logo.png?v=035", suiPrice?.usd, suiAmount, 'Sui', 30, suiAddress), createTokenData('deep', 'DEEP', 'DEEP', 18, "https://s2.coinmarketcap.com/static/img/coins/200x200/33391.png", deepPrice?.usd, deepAmount, 'Sui', 30, suiAddress)];

    return createChainData(30, ['sui'], 'Sui', tokens, suiAddress);
};

export const fetchAptosData = async () => {
    const config = new AptosConfig({network: Network.MAINNET});
    const aptosConf = new Aptos(config);

    const aptosAddress = "0x7acbb55470beae407d0c897c3d1c85ba5d17955cf48ce128a05a36c2e23e2260";
    const [stakingActivities, aptosBalance, aptosPrice] = await Promise.all([aptosConf.staking.getDelegatedStakingActivities({
        poolAddress: "0xdb5247f859ce63dbe8940cf8773be722a60dcc594a8be9aca4b76abceb251b8e",
        delegatorAddress: aptosAddress
    }), aptosConf.getAccountAPTAmount({accountAddress: aptosAddress}), fetchTokenPrice('aptos')]);

    let totalStake = 0;
    stakingActivities.forEach(activity => {
        if (activity.event_type === "0x1::delegation_pool::AddStakeEvent") {
            totalStake += activity.amount;
        } else if (activity.event_type === "0x1::delegation_pool::UnlockStakeEvent") {
            totalStake -= activity.amount;
        }
    });

    const aptosAmount = totalStake / 10 ** 8 + aptosBalance / 10 ** 8;
    const tokens = [createTokenData('aptos', 'Aptos', 'APT', 8, "https://cryptologos.cc/logos/aptos-apt-logo.png?v=035", aptosPrice?.usd, aptosAmount, 'Aptos', 39, aptosAddress)];

    return createChainData(39, ['aptos'], 'Aptos', tokens, aptosAddress);
};

export const fetchStaticData = async () => {
    const chains = [{
        id: 'doge',
        name: 'Dogecoin',
        symbol: 'DOGE',
        decimals: 8,
        logo_url: "https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=035",
        priceKey: 'dogecoin',
        wallet: 'DRbbCDmZKR6p8xwx2926iM6BuPnxTS7reV',
        amount: 5000
    }, {
        id: 'dot',
        name: 'Polkadot',
        symbol: 'DOT',
        decimals: 10,
        logo_url: "https://cryptologos.cc/logos/polkadot-new-dot-logo.png?v=035",
        priceKey: 'polkadot',
        wallet: '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2',
        amount: 100
    }, {
        id: 'flow',
        name: 'Flow',
        symbol: 'FLOW',
        decimals: 8,
        logo_url: "https://cryptologos.cc/logos/flow-flow-logo.png?v=035",
        priceKey: 'flow',
        wallet: '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2',
        amount: 700
    }, {
        id: 'strk',
        name: 'Starknet',
        symbol: 'STRK',
        decimals: 16,
        logo_url: "https://cryptologos.cc/logos/starknet-token-strk-logo.png?v=040",
        priceKey: 'starknet',
        amount: 900,
        wallet: '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2'
    }, {
        id: 'bvm',
        name: 'BVM',
        symbol: 'BVM',
        decimals: 16,
        logo_url: "https://cryptologos.cc/logos/bitcoin-plus-xbc-logo.png?v=040",
        priceKey: 'bvm',
        amount: 1400,
        wallet: '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2',
    }, {
        id: 'magic',
        name: 'MAGIC',
        symbol: 'MAGIC',
        decimals: 16,
        logo_url: "https://cryptologos.cc/logos/magic-token-magic-logo.svg?v=040",
        priceKey: 'magic',
        amount: 4349,
        wallet: '0x770353615119F0f701118d3A4eaf1FE57fA00F84',
    }];

    return Promise.all(chains.map(async chain => {
        const price = (await fetchTokenPrice(chain.priceKey))?.usd || 0;
        const tokens = [createTokenData(chain.id, chain.name, chain.symbol, chain.decimals, chain.logo_url, price, chain.amount, chain.name, chain.id, chain.wallet)];
        return createChainData(chain.id, [chain.name.toLowerCase()], chain.name, tokens, chain.wallet);
    }));
};
