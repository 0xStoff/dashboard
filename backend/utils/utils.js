import {Op} from "sequelize";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import SettingsModel from "../models/SettingsModel.js";
import CryptoJS from "crypto-js";
import axios from "axios";
import querystring from "querystring";
import crypto from "crypto";


const TOKEN_ATTRIBUTES = [
  "name", "symbol", "decimals", "price", "logo_path", "chain_id", "price_24h_change"
];

export const getHideSmallBalances = async () => {
  const setting = await SettingsModel.findOne({ where: { key: "HIDESMALLBALANCES" } });
  return setting ? setting.value : 10;
};

export const fetchWalletData = async (chain, usd_value, walletId, userId) => {
  const walletWhereClause = { user_id: userId };
  if (walletId && walletId !== 'all') walletWhereClause.id = walletId;

  const tokenWhereClause = {};
  if (chain && chain !== 'all') tokenWhereClause.chain_id = chain;

  return WalletModel.findAll({
    where: walletWhereClause,
    include: [
      {
        model: TokenModel,
        where: tokenWhereClause,
        through: {
          model: WalletTokenModel,
          attributes: ["amount", "raw_amount", "usd_value"],
          where: usd_value ? { usd_value: { [Op.gt]: usd_value } } : {},
        },
        attributes: TOKEN_ATTRIBUTES,
      },
      {
        model: ProtocolModel,
        through: {
          model: WalletProtocolModel,
          attributes: ["portfolio_item_list"]
        },
        attributes: ["name", "logo_path", "chain_id"]
      }
    ],
    nest: true,
  });
};


export const transformData = async (wallets) => {
  const tokenMap = new Map();
  const hideSmallBalances = await getHideSmallBalances();

  wallets.forEach(({ id: walletId, wallet: walletAddress, tag, chain, tokens }) => {
    tokens.forEach((token) => {
      const {
        name,
        chain_id,
        symbol,
        decimals,
        logo_path,
        price,
        price_24h_change,
        wallets_tokens: { amount, is_core },
      } = token;

      const tokenKey = `${name}-${chain_id}`;

      const newTokenData = {
        chain_id,
        name,
        symbol,
        decimals,
        logo_path,
        price: parseFloat(price),
        price_24h_change: price_24h_change || null,
        amount: parseFloat(amount),
        is_core,
        wallets: new Map(), // Use Map to ensure unique wallets
      };

      if (!tokenMap.has(tokenKey)) {
        newTokenData.wallets.set(walletId, {
          tag,
          id: walletId,
          wallet: walletAddress,
          amount: parseFloat(amount),
        });
        tokenMap.set(tokenKey, newTokenData);
      } else {
        const existingToken = tokenMap.get(tokenKey);
        existingToken.amount += parseFloat(amount);

        // Prevent duplicate wallet entries
        if (!existingToken.wallets.has(walletId)) {
          existingToken.wallets.set(walletId, {
            tag,
            id: walletId,
            wallet: walletAddress,
            amount: parseFloat(amount),
          });
        } else {
          existingToken.wallets.get(walletId).amount += parseFloat(amount); // Merge amounts
        }
      }
    });
  });

  return [...tokenMap.values()]
      .map((token) => ({
        ...token,
        wallets: [...token.wallets.values()], // Convert Map back to array
        total_usd_value: token.amount * token.price,
      }))
      .filter((token) => token.total_usd_value > hideSmallBalances)
      .sort((a, b) => b.total_usd_value - a.total_usd_value);
};

const createBinanceSignature = (queryString, secret) => {
  return CryptoJS.HmacSHA256(queryString, secret).toString();
};

export const fetchBinanceData = async (endpoint, apiKey, apiSecret, params) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const signature = createBinanceSignature(queryString, apiSecret);

    const headers = {'X-MBX-APIKEY': apiKey};
    const response = await axios.get(`https://api.binance.com${endpoint}?${queryString}&signature=${signature}`, {
      headers,
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching Binance data from ${endpoint}:`, error.response?.data || error.message);
    throw error.response?.data || error.message;
  }
};


function getKrakenSignature(urlPath, data, secret) {
  let encoded;

  if (typeof data === 'string') {
    const jsonData = JSON.parse(data);
    encoded = jsonData.nonce + data;
  } else if (typeof data === 'object') {
    const dataStr = querystring.stringify(data);
    encoded = data.nonce + dataStr;
  } else {
    throw new Error('Invalid data type');
  }

  const sha256Hash = crypto.createHash('sha256').update(encoded).digest();
  const message = urlPath + sha256Hash.toString('binary');
  const secretBuffer = Buffer.from(secret, 'base64');
  const hmac = crypto.createHmac('sha512', secretBuffer);
  hmac.update(message, 'binary');
  return hmac.digest('base64');
}


export const fetchXMRHistoricalPrice = async (timestamp) => {
  const xmrPair = "XXMRZUSD";
  const chfPair = "USDCHF";
  const interval = 1440;

  try {
    const xmrResponse = await axios.get(`https://api.kraken.com/0/public/OHLC`, {
      params: { pair: xmrPair, interval, since: timestamp }
    });

    if (!xmrResponse.data || !xmrResponse.data.result || !xmrResponse.data.result[xmrPair]) {
      console.error("Kraken API returned unexpected data for XMR/USD:", xmrResponse.data);
      return null;
    }

    const xmrUsdPrice = parseFloat(xmrResponse.data.result[xmrPair][0][4]);

    const chfResponse = await axios.get(`https://api.kraken.com/0/public/OHLC`, {
      params: { pair: chfPair, interval, since: timestamp }
    });

    if (!chfResponse.data || !chfResponse.data.result || !chfResponse.data.result[chfPair]) {
      console.error("Kraken API returned unexpected data for USD/CHF:", chfResponse.data);
      return xmrUsdPrice;
    }

    const usdToChfRate = parseFloat(chfResponse.data.result[chfPair][0][4]);

    const xmrChfPrice = xmrUsdPrice * usdToChfRate;


    return xmrChfPrice;
  } catch (error) {
    console.error("Error fetching XMR historical price in CHF:", error.response?.data || error.message);
    return null;
  }
};


export async function fetchKrakenLedgers(apiKey, apiSecret, asset, type) {
  const now = Math.floor(Date.now() / 1000);
  const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60;
  const allLedgers = [];
  let offset = 0;

  while (true) {
    const nonce = Date.now().toString();
    const data = JSON.stringify({
      nonce, asset, type, start: fiveYearsAgo, end: now, ofs: offset,
    });

    const signature = getKrakenSignature('/0/private/Ledgers', data, apiSecret);

    const config = {
      method: 'post',
      url: 'https://api.kraken.com/0/private/Ledgers',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-Key': apiKey,
        'API-Sign': signature,
      },
      data,
    };

    const response = await axios.request(config);
    const result = response.data?.result?.ledger || {};
    const ledgerEntries = Object.values(result);

    if (ledgerEntries.length === 0) break;

    for (let entry of ledgerEntries) {
      if (entry.asset === "XXMR") {
        const price = await fetchXMRHistoricalPrice(entry.time);
        entry.transactionAmount = price ? price * Math.abs(entry.amount) : null;
      }
    }

    allLedgers.push(...ledgerEntries);
    offset += ledgerEntries.length;
  }

  return allLedgers;
}

export const binanceCredentials = (req, res)=> {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  const transactionType = req.query.transactionType || 0;

  if(!apiKey || !apiSecret) {
    console.error("Missing API key or secret");
    return res.status(400).json({error: 'Missing API key or secret'});
  }

  const params = {
    transactionType,
    beginTime: new Date('2020-01-01').getTime(),
    endTime: Date.now(),
    timestamp: Date.now(),
  };

  return {apiKey, apiSecret, params}
}