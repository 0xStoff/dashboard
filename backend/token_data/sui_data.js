import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import { fetchTokenPriceCoingecko } from "../api/fetchTokenPriceCoingecko.js";
import TokenModel from "../models/TokenModel.js";
import { downloadLogo } from "../utils/download_logo.js";
import { APTOS_CONFIG, STATIC_CHAINS, SUI_CONFIG } from "../static_data/index.js";

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

    console.log('Aptos token data successfully saved/updated');
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
  const rpcUrl = getFullnodeUrl("mainnet");
  const client = new SuiClient({ url: rpcUrl });
  const suiAddress = SUI_CONFIG.walletAddress;

  const [suiBalance, stakingData, suiPrice, deepPrice] = await Promise.all([
    client.getAllCoins({ owner: suiAddress }),
    client.getStakes({ owner: suiAddress }),
    fetchTokenPriceCoingecko(SUI_CONFIG.tokens[0].priceKey),
    fetchTokenPriceCoingecko(SUI_CONFIG.tokens[1].priceKey)
  ]);


  const suiAmount =
    stakingData[0]?.stakes[0]?.principal / 10 ** SUI_CONFIG.stakingDecimals +
    suiBalance.data[0]?.balance / 10 ** SUI_CONFIG.liquidDecimals;
  const deepAmount = suiBalance.data.filter(coin => coin.coinType.includes("DEEP"))[0]?.balance / 10 ** 6 || 0;

  const tokens = [
    createTokenData(
      SUI_CONFIG.tokens[0].id,
      SUI_CONFIG.tokens[0].name,
      SUI_CONFIG.tokens[0].symbol,
      SUI_CONFIG.tokens[0].decimals,
      SUI_CONFIG.tokens[0].logoUrl,
      suiPrice,
      suiAmount,
      SUI_CONFIG.symbol,
      SUI_CONFIG.walletId,
      suiAddress
    ),
    createTokenData(
      SUI_CONFIG.tokens[1].id,
      SUI_CONFIG.tokens[1].name,
      SUI_CONFIG.tokens[1].symbol,
      SUI_CONFIG.tokens[1].decimals,
      SUI_CONFIG.tokens[1].logoUrl,
      deepPrice,
      deepAmount,
      SUI_CONFIG.symbol,
      SUI_CONFIG.walletId,
      suiAddress
    )
  ];

  return createChainData(SUI_CONFIG.walletId, [SUI_CONFIG.chainId], SUI_CONFIG.symbol, tokens, suiAddress);
};

export const fetchAptosData = async () => {
  const config = new AptosConfig({ network: Network.MAINNET });
  const aptosConf = new Aptos(config);

  const aptosAddress = APTOS_CONFIG.walletAddress;
  const [stakingActivities, aptosBalance, aptosPrice] = await Promise.all([aptosConf.staking.getDelegatedStakingActivities({
    poolAddress: APTOS_CONFIG.stakingPoolAddress, delegatorAddress: aptosAddress
  }), aptosConf.getAccountAPTAmount({ accountAddress: aptosAddress }), fetchTokenPriceCoingecko(APTOS_CONFIG.priceKey)]);

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
    APTOS_CONFIG.chainId,
    "Aptos",
    APTOS_CONFIG.symbol,
    APTOS_CONFIG.decimals,
    APTOS_CONFIG.logoUrl,
    aptosPrice,
    aptosAmount,
    "Aptos",
    APTOS_CONFIG.walletId,
    aptosAddress
  )];

  return createChainData(APTOS_CONFIG.walletId, [APTOS_CONFIG.chainId], "Aptos", tokens, aptosAddress);
};

export const fetchStaticData = async () => {
  return Promise.all(STATIC_CHAINS.map(async chain => {
    const price = (await fetchTokenPriceCoingecko(chain.priceKey)) || 0;
    const tokens = [createTokenData(chain.id, chain.name, chain.symbol, chain.decimals, chain.logoUrl, price, chain.amount, chain.name, chain.id, chain.wallet)];
    return createChainData(chain.id, [chain.name.toLowerCase()], chain.name, tokens, chain.wallet);
  }));
};
