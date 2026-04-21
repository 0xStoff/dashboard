import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import { fetchTokenPriceCoingecko } from "../api/fetchTokenPriceCoingecko.js";
import TokenModel from "../models/TokenModel.js";
import { downloadLogo } from "../utils/download_logo.js";
import { staticDataConfig } from "../config/staticData.js";

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
    if (!aptosData) {
      console.log("Skipping Aptos static sync because no private config is present");
      return;
    }
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

    console.log('Aptos token data successfully saved/updated');
  } catch (error) {
    console.error("Error saving Aptos token data:", error.message);
  }
};

export const writeStaticDataToDB = async () => {
  try {
    // Fetch Static token data
    const staticData = await fetchStaticData();
    if (!staticData.length) {
      console.log("Skipping static token sync because no private config is present");
      return;
    }

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

      console.log(`Static token data successfully saved/updated for chain ${chainId}`);
    }
  } catch (error) {
    console.error("Error saving Static token data:", error.message);
  }
};

export const writeSuiDataToDB = async () => {

  try {
    // Fetch Sui token data
    const suiData = await fetchSuiData();
    if (!suiData) {
      console.log("Skipping Sui static sync because no private config is present");
      return;
    }
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

    console.log('Sui token data successfully saved/updated');
  } catch (error) {
    console.error("Error saving Sui token data:", error.message);
  }
};


export const fetchSuiData = async () => {
  const suiConfig = staticDataConfig.sui;
  if (!suiConfig?.walletAddress || !Array.isArray(suiConfig.tokens) || suiConfig.tokens.length < 2) {
    return null;
  }

  const rpcUrl = getFullnodeUrl("mainnet");
  const client = new SuiClient({ url: rpcUrl });
  const suiAddress = suiConfig.walletAddress;

  const [suiBalance, stakingData, suiPrice, deepPrice] = await Promise.all([
    client.getAllCoins({ owner: suiAddress }),
    client.getStakes({ owner: suiAddress }),
    fetchTokenPriceCoingecko(suiConfig.tokens[0].priceKey),
    fetchTokenPriceCoingecko(suiConfig.tokens[1].priceKey)
  ]);


  const suiAmount =
    stakingData[0]?.stakes[0]?.principal / 10 ** suiConfig.stakingDecimals +
    suiBalance.data[0]?.balance / 10 ** suiConfig.liquidDecimals;
  const deepAmount = suiBalance.data.filter(coin => coin.coinType.includes("DEEP"))[0]?.balance / 10 ** 6 || 0;

  const tokens = [
    createTokenData(
      suiConfig.tokens[0].id,
      suiConfig.tokens[0].name,
      suiConfig.tokens[0].symbol,
      suiConfig.tokens[0].decimals,
      suiConfig.tokens[0].logoUrl,
      suiPrice,
      suiAmount,
      suiConfig.symbol,
      suiConfig.walletId,
      suiAddress
    ),
    createTokenData(
      suiConfig.tokens[1].id,
      suiConfig.tokens[1].name,
      suiConfig.tokens[1].symbol,
      suiConfig.tokens[1].decimals,
      suiConfig.tokens[1].logoUrl,
      deepPrice,
      deepAmount,
      suiConfig.symbol,
      suiConfig.walletId,
      suiAddress
    )
  ];

  return createChainData(suiConfig.walletId, ["sui"], suiConfig.symbol, tokens, suiAddress);
};

export const fetchAptosData = async () => {
  const aptosConfigData = staticDataConfig.aptos;
  if (!aptosConfigData?.walletAddress || !aptosConfigData?.stakingPoolAddress) {
    return null;
  }

  const config = new AptosConfig({ network: Network.MAINNET });
  const aptosConf = new Aptos(config);

  const aptosAddress = aptosConfigData.walletAddress;
  const [stakingActivities, aptosBalance, aptosPrice] = await Promise.all([aptosConf.staking.getDelegatedStakingActivities({
    poolAddress: aptosConfigData.stakingPoolAddress, delegatorAddress: aptosAddress
  }), aptosConf.getAccountAPTAmount({ accountAddress: aptosAddress }), fetchTokenPriceCoingecko(aptosConfigData.priceKey)]);

  let unlockedTotal = 0;
  let withdrawnTotal = 0;
  let addedStake = 0;

  stakingActivities.forEach(activity => {
    const type = activity.event_type;

    if (type === "0x1::delegation_pool::AddStakeEvent") {
      addedStake += activity.amount;
    } else if (
      type === "0x1::delegation_pool::UnlockStakeEvent" ||
      type === "0x1::delegation_pool::UnlockStake"
    ) {
      unlockedTotal += activity.amount;
    } else if (
      type === "0x1::delegation_pool::WithdrawStakeEvent" ||
      type === "0x1::delegation_pool::WithdrawStake"
    ) {
      withdrawnTotal += activity.amount;
    }
  });

  const undelegated = (unlockedTotal - withdrawnTotal) / 1e8;
  const liquid = aptosBalance / 1e8;
  const aptosAmount = undelegated + liquid;

  const tokens = [createTokenData(
    "aptos",
    "Aptos",
    aptosConfigData.symbol,
    aptosConfigData.decimals,
    aptosConfigData.logoUrl,
    aptosPrice,
    aptosAmount,
    "Aptos",
    aptosConfigData.walletId,
    aptosAddress
  )];

  return createChainData(aptosConfigData.walletId, ["aptos"], "Aptos", tokens, aptosAddress);
};

export const fetchStaticData = async () => {
  return Promise.all(staticDataConfig.staticChains.map(async chain => {
    const price = (await fetchTokenPriceCoingecko(chain.priceKey)) || 0;
    const tokens = [createTokenData(chain.id, chain.name, chain.symbol, chain.decimals, chain.logoUrl, price, chain.amount, chain.name, chain.id, chain.wallet)];
    return createChainData(chain.id, [chain.name.toLowerCase()], chain.name, tokens, chain.wallet);
  }));
};
