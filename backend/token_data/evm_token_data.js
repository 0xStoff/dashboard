import fetchDebankData from "../utils/debank_api.js";
import { downloadLogo } from "../utils/download_logo.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";

export const fetchAndSaveEvmTokenData = async (walletId, walletAddress) => {
  try {
    // Fetch tokens
    const tokens = await fetchDebankData("/user/all_token_list", {
        id: walletAddress,
        is_all: false,
    });

    for (const token of tokens) {
        const { id, chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change } = token;

        // const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;

        const [dbToken] = await TokenModel.upsert(
          {
              chain_id: chain,
              name,
              symbol,
              decimals,
              logo_path: logo_url,
              price,
              price_24h_change: price_24h_change * 100,
          },
          {
              conflictFields: ["chain_id", "symbol"],
          }
        );

        const usd_value = amount * price;

        await WalletTokenModel.upsert({
            wallet_id: walletId,
            token_id: dbToken.id,
            amount,
            raw_amount,
            usd_value,
        });
    }


    const protocols = await fetchDebankData("/user/all_complex_protocol_list", {
      id: walletAddress
    });


    for (const protocol of protocols) {
      const { id, chain, name, logo_url, portfolio_item_list } = protocol;

      // const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;

      const [dbProtocol] = await ProtocolModel.upsert({
        chain_id: chain,
        name,
        logo_path: logo_url,
        portfolio_item_list,
        total_usd: portfolio_item_list.reduce((sum, item) => sum + item.stats.asset_usd_value, 0)
      }, {
        conflictFields: ["chain_id", "name"]
      });

      await WalletProtocolModel.upsert({
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

export const fetchAndSaveEvmTokenDataForAllWallets = async () => {
  try {
    const wallets = await WalletModel.findAll({
      order: [["id", "ASC"]], where: { chain: "evm" }
    });

    for (const wallet of wallets) {
      await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet);
    }

    console.log("Token and protocol data for all wallets successfully updated");
  } catch (error) {
    console.error("Error fetching data for all wallets:", error.message);
  }
};
