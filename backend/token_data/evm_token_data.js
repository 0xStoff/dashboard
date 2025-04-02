import fetchDebankData from "../utils/debank_api.js";
import { downloadLogo } from "../utils/download_logo.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";

export const fetchAndSaveEvmTokenData = async (walletId, walletAddress, req) => {
  try {
    const tokens = await fetchDebankData("/user/all_token_list", {
        id: walletAddress,
        is_all: false,
    });

    const fetchedTokenSymbols = tokens.map(t => t.symbol);
    const existingWalletTokens = await WalletTokenModel.findAll({
      where: {
        user_id: req.user.user.id,
        wallet_id: walletId,
      },
      include: [{
        model: TokenModel,
        as: 'token'
      }]
    });

    for (const walletToken of existingWalletTokens) {
      if (!fetchedTokenSymbols.includes(walletToken.token.symbol)) {
        await walletToken.destroy();
      }
    }

    for (const token of tokens) {
      const { id, chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change } = token;

      const existingToken = await TokenModel.findOne({
        where: { chain_id: chain, symbol },
      });

      const logoPath = existingToken?.logo_path || (logo_url ? await downloadLogo(logo_url, id) : null);

      const [dbToken] = await TokenModel.upsert(
        {
          chain_id: chain,
          name,
          symbol,
          decimals,
          logo_path: logoPath,
          price,
          price_24h_change: price_24h_change * 100,
        }
        ,
        {
          conflictFields: ["chain_id", "symbol"],
        }
      );

      const usd_value = amount * price;

      await WalletTokenModel.upsert({
        user_id: req.user.user.id,
        wallet_id: walletId,
        token_id: dbToken.id,
        amount,
        raw_amount,
        usd_value,
      });
    }

    const protocols = await fetchDebankData("/user/all_complex_protocol_list", {
      id: walletAddress,
    });

    const fetchedProtocolNames = protocols.map(p => p.name);
    const existingWalletProtocols = await WalletProtocolModel.findAll({
      where: {
        user_id: req.user.user.id,
        wallet_id: walletId,
      },
      include: [{
        model: ProtocolModel,
        as: 'protocol'
      }]
    });

    for (const walletProtocol of existingWalletProtocols) {
      if (!fetchedProtocolNames.includes(walletProtocol.protocol.name)) {
        await walletProtocol.destroy();
      }
    }

    for (const protocol of protocols) {
      const { id, chain, name, logo_url, portfolio_item_list } = protocol;

      const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;

      const [dbProtocol] = await ProtocolModel.upsert({
        chain_id: chain,
        name,
        logo_path: logoPath,
      }
      , {
        conflictFields: ["chain_id", "name"]
      }
      );

      await WalletProtocolModel.upsert({
        user_id: req.user.user.id,
        wallet_id: walletId, protocol_id: dbProtocol.id, portfolio_item_list
      }, {
        conflictFields: ["wallet_id", "protocol_id"]
      });
    }

    console.log(`Token and protocol data successfully saved/updated for wallet ID ${walletId}`);
  } catch (error) {
    console.error(`Error fetching or saving data for wallet ID ${walletId}:`, error.message);
  }
};

export const fetchAndSaveEvmTokenDataForAllWallets = async (req) => {
  try {
    const wallets = await WalletModel.findAll({
      order: [["id", "ASC"]], where: { chain: "evm" }
    });


    for (const wallet of wallets) {
      await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet, req);
    }

    console.log("Token and protocol data for all wallets successfully updated");
  } catch (error) {
    console.error("Error fetching data for all wallets:", error.message);
  }
};
