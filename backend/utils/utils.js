import CryptoJS from "crypto-js";
import axios from "axios";
import querystring from "querystring";
import crypto from "crypto";

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
