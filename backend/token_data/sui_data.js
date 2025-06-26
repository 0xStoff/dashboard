import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import { fetchTokenPriceCoingecko } from "../api/fetchTokenPriceCoingecko.js";
import TokenModel from "../models/TokenModel.js";
import { downloadLogo } from "../utils/download_logo.js";

const createTokenData = (id, name, symbol, decimals, logoUrl, price, amount, walletTag, walletId, walletAddress) => {
  return {
    id,
    name,
    symbol,
    decimals,
    logo_url: logoUrl,
    price: price.usd || 0,
    price_24h_change: price.price_24h_change*100,
    amount: amount || 0,
    is_core: true,
    wallets: [{ tag: walletTag, id: walletId, wallet: walletAddress, amount: amount || 0 }]
  };
};

// Helper function to create chain data
const createChainData = (chainId, chainList, tag, tokens, walletAddress) => {
  const totalUsdValue = tokens.reduce((sum, token) => sum + token.amount * token.price, 0);
  return {
    chains: { usd_value: totalUsdValue, chain_list: chainList },
    id: chainId,
    protocols: [],
    tag,
    tokens,
    wallet: walletAddress
  };
};


export const writeAptosDataToDB = async () => {
  try {
    // Fetch Aptos token data
    const aptosData = await fetchAptosData();
    const { tokens, wallet: walletAddress } = aptosData;


    const wallets = await WalletModel.findAll({
      order: [['id', 'ASC']],
      where: { chain: 'aptos' }
    });


    // Iterate through tokens and write them to the database
    for (const token of tokens) {
      const { name, symbol, decimals, logo_url, price, price_24h_change, amount } = token;
      const logoPath = logo_url ? await downloadLogo(logo_url, symbol) : null;

      // Insert or update token data in the TokenModel
      const [dbToken] = await TokenModel.upsert({
        chain_id: "aptos",
        name,
        symbol,
        decimals,
        logo_path: logoPath,
        price,
        price_24h_change
      }, { conflictFields: ["chain_id", "symbol"], returning: true });

      // Calculate raw_amount and USD value
      const raw_amount = amount * 10 ** decimals;
      const usd_value = amount * price;

      // Insert or update wallet token data
      await WalletTokenModel.upsert({
        wallet_id: wallets[0].id,
        token_id: dbToken.id,
        amount,
        raw_amount,
        usd_value
      });
    }

    console.log(`Aptos token data successfully saved/updated for wallet ${walletAddress}`);
  } catch (error) {
    console.error("Error saving Aptos token data:", error.message);
  }
};

export const writeStaticDataToDB = async () => {
  try {
    // Fetch Static token data
    const staticData = await fetchStaticData();

    for (const chainData of staticData) {
      const { tokens, wallet: walletAddress, id: chainId } = chainData;

      const wallets = await WalletModel.findAll({
        order: [['id', 'ASC']],
        where: { chain: chainId }
      });


      // Iterate through tokens and write them to the database
      for (const token of tokens) {
        const { name, symbol, decimals, logo_url, price, price_24h_change, amount } = token;
        const logoPath = logo_url ? await downloadLogo(logo_url, symbol) : null;

        // Insert or update token data in the TokenModel
        const [dbToken] = await TokenModel.upsert({
          chain_id: chainId,
          name,
          symbol,
          decimals,
          price_24h_change,
          logo_path: logoPath,
          price
        }, { conflictFields: ["chain_id", "symbol"], returning: true });

        // Calculate raw_amount and USD value
        const raw_amount = amount * 10 ** decimals;
        const usd_value = amount * price;


        // Insert or update wallet token data
        await WalletTokenModel.upsert({
          wallet_id: wallets[0]?.id || null,
          token_id: dbToken.id,
          amount,
          raw_amount,
          usd_value
        });
      }

      console.log(`Static token data successfully saved/updated for chain ${chainId} and wallet ${walletAddress}`);
    }
  } catch (error) {
    console.error("Error saving Static token data:", error.message);
  }
};

export const writeSuiDataToDB = async () => {

  try {
    // Fetch Sui token data
    const suiData = await fetchSuiData();
    const { tokens, wallet: walletAddress } = suiData;


    const wallets = await WalletModel.findAll({
      order: [['id', 'ASC']], where: {chain: 'sui'}
    });


    // Iterate through tokens and write them to the database
    for (const token of tokens) {
      const { name, symbol, decimals, logo_url, price, amount, price_24h_change } = token;
      const logoPath = logo_url ? await downloadLogo(logo_url, symbol) : null;


      // Insert or update token data in the TokenModel
      const [dbToken] = await TokenModel.upsert({
        chain_id: "sui", name, symbol, decimals, logo_path: logoPath, price, price_24h_change
      }, { conflictFields: ["chain_id", "symbol"], returning: true });

      // Calculate raw_amount and USD value
      const raw_amount = amount * 10 ** decimals;
      const usd_value = amount * price;

      // Insert or update wallet token data
      await WalletTokenModel.upsert({
        wallet_id: wallets[0].id, token_id: dbToken.id, amount, raw_amount, usd_value
      });
    }

    console.log(`Sui token data successfully saved/updated for wallet ${walletAddress}`);
  } catch (error) {
    console.error("Error saving Sui token data:", error.message);
  }
};


export const fetchSuiData = async () => {
  const rpcUrl = getFullnodeUrl("mainnet");
  const client = new SuiClient({ url: rpcUrl });
  const suiAddress = "0xb0ff460367eae42bc92566dc50135dc12eed99ead8938d18f6b8c0dd0f41b11b";

  const [suiBalance, stakingData, suiPrice, deepPrice] = await Promise.all([
    client.getAllCoins({ owner: suiAddress }),
    client.getStakes({ owner: suiAddress }),
    fetchTokenPriceCoingecko("sui"),
    fetchTokenPriceCoingecko("deep")
  ]);


  const suiAmount = stakingData[0]?.stakes[0]?.principal / 10 ** 9 + suiBalance.data[0]?.balance / 10 ** 9;
  const deepAmount = suiBalance.data.filter(coin => coin.coinType.includes("DEEP"))[0]?.balance / 10 ** 6 || 0;

  const tokens = [createTokenData("sui", "Sui", "SUI", 18, "https://cryptologos.cc/logos/sui-sui-logo.png?v=035", suiPrice, suiAmount, "Sui", 30, suiAddress), createTokenData("deep", "DEEP", "DEEP", 18, "https://s2.coinmarketcap.com/static/img/coins/200x200/33391.png", deepPrice, deepAmount, "Sui", 30, suiAddress)];

  return createChainData(30, ["sui"], "Sui", tokens, suiAddress);
};

export const fetchAptosData = async () => {
  const config = new AptosConfig({ network: Network.MAINNET });
  const aptosConf = new Aptos(config);

  const aptosAddress = "0x7acbb55470beae407d0c897c3d1c85ba5d17955cf48ce128a05a36c2e23e2260";
  const [stakingActivities, aptosBalance, aptosPrice] = await Promise.all([aptosConf.staking.getDelegatedStakingActivities({
    poolAddress: "0xdb5247f859ce63dbe8940cf8773be722a60dcc594a8be9aca4b76abceb251b8e", delegatorAddress: aptosAddress
  }), aptosConf.getAccountAPTAmount({ accountAddress: aptosAddress }), fetchTokenPriceCoingecko("aptos")]);

  let totalStake = 0;
  stakingActivities.forEach(activity => {
    if (activity.event_type === "0x1::delegation_pool::AddStakeEvent") {
      totalStake += activity.amount;
    } else if (activity.event_type === "0x1::delegation_pool::UnlockStakeEvent") {
      totalStake -= activity.amount;
    }
  });

  const aptosAmount = totalStake / 10 ** 8 + aptosBalance / 10 ** 8;
  const tokens = [createTokenData("aptos", "Aptos", "APT", 8, "https://cryptologos.cc/logos/aptos-apt-logo.png?v=035", aptosPrice, aptosAmount, "Aptos", 39, aptosAddress)];

  return createChainData(39, ["aptos"], "Aptos", tokens, aptosAddress);
};

export const fetchStaticData = async () => {
  const chains = [{
    id: "doge",
    name: "Dogecoin",
    symbol: "DOGE",
    decimals: 8,
    logo_url: "https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=035",
    priceKey: "dogecoin",
    wallet: "DRbbCDmZKR6p8xwx2926iM6BuPnxTS7reV",
    amount: 2000
  }, {
    id: "dot",
    name: "Polkadot",
    symbol: "DOT",
    decimals: 10,
    logo_url: "https://cryptologos.cc/logos/polkadot-new-dot-logo.png?v=035",
    priceKey: "polkadot",
    wallet: "14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2",
    amount: 70
  }, {
    id: "flow",
    name: "Flow",
    symbol: "FLOW",
    decimals: 8,
    logo_url: "https://cryptologos.cc/logos/flow-flow-logo.png?v=035",
    priceKey: "flow",
    wallet: "14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2",
    amount: 500
  }, {
    id: "strk",
    name: "Starknet",
    symbol: "STRK",
    decimals: 16,
    logo_url: "https://cryptologos.cc/logos/starknet-token-strk-logo.png?v=040",
    priceKey: "starknet",
    amount: 890,
    wallet: "0x0266289d06695abf63A6a962F7671437086824F1C3C87b009e1eD3d89404Efef"
  }, {
    id: "bvm",
    name: "BVM",
    symbol: "BVM",
    decimals: 16,
    logo_url: "https://cryptologos.cc/logos/bitcoin-plus-xbc-logo.png?v=040",
    priceKey: "bvm",
    amount: 1400,
    wallet: "0x41eD1e75d836C5C974030432fDB222f30A274f90"
  }, {
    id: "kraken",
    name: "KRAKEN",
    symbol: "KRAKEN",
    decimals: 16,
    logo_url: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040",
    priceKey: "usd-coin",
    amount: 0,
    wallet: "0x01"
  }, {
    id: "nft",
    name: "NFT",
    symbol: "NFT",
    decimals: 16,
    logo_url: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040",
    priceKey: "usd-coin",
    amount: 0,
    wallet: "0x02"
  }];


  return Promise.all(chains.map(async chain => {
    const price = (await fetchTokenPriceCoingecko(chain.priceKey)) || 0;
    const tokens = [createTokenData(chain.id, chain.name, chain.symbol, chain.decimals, chain.logo_url, price, chain.amount, chain.name, chain.id, chain.wallet)];
    return createChainData(chain.id, [chain.name.toLowerCase()], chain.name, tokens, chain.wallet);
  }));
};
