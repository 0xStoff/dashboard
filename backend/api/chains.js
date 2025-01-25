// /api/chains.js
import express from "express";
import EvmChains from "../models/EvmChainsModel.js";
import NonEvmChains from "../models/NonEvmChainsModel.js";
import WalletModel from "../models/WalletModel.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import ProtocolModel from "../models/ProtocolModel.js";

const router = express.Router();

router.get("/evm-chains", async (req, res) => {
  try {
    const evmChains = await EvmChains.findAll({
      order: [["chain_id", "ASC"]]
    });
    res.json(evmChains);
  } catch (err) {
    console.error("Error fetching chains", err);
    res.status(500).json({ error: "Failed to fetch chains" });
  }
});

router.get("/non-evm-chains", async (req, res) => {
  try {
    const nonEvmChains = await NonEvmChains.findAll({
      order: [["chain_id", "ASC"]]
    });
    res.json(nonEvmChains);
  } catch (err) {
    console.error("Error fetching non-EVM chains", err);
    res.status(500).json({ error: "Failed to fetch non-EVM chains" });
  }
});


const fetchChains = async (req) => {
  const [evmChains, nonEvmChains] = await Promise.all([EvmChains.findAll({ order: [["chain_id", "ASC"]] }), NonEvmChains.findAll({ order: [["chain_id", "ASC"]] })]);

  return [...evmChains.map(chain => ({
    ...chain.dataValues, type: "evm" // Add 'type: evm' for EVM chains
  })), ...nonEvmChains.map(chain => ({
    ...chain.dataValues, type: "non-evm" // Add 'type: non-evm' for non-EVM chains
  }))];
};


const fetchWallets = async (req) => {
  const walletId = req.query.wallet_id || "all";

  const walletWhereClause = walletId !== "all" ? { id: walletId } : {};

  const wallets = await WalletModel.findAll({
    where: walletWhereClause, // Apply wallet ID filter here
    include: [
      {
        model: TokenModel,
        through: {
          model: WalletTokenModel,
          attributes: ["amount", "raw_amount", "usd_value"]
        },
        attributes: ["name", "symbol", "decimals", "price", "logo_path", "chain_id"]
      },
      {
        model: ProtocolModel,
        attributes: ["name", "total_usd", "logo_path", "chain_id", "portfolio_item_list"]
      }
    ],
    order: [["id", "ASC"]]
  });

  return wallets.map(wallet => {
    const tokens = wallet.tokens.map(token => ({
      ...token.get(),
      amount: token.wallets_tokens.amount,
      raw_amount: token.wallets_tokens.raw_amount,
      usd_value: parseFloat(token.wallets_tokens.usd_value || 0),
      wallets_tokens: undefined // Explicitly remove the wallets_tokens field
    }));

    const totalTokenUsdValue = tokens.reduce((sum, token) => sum + token.usd_value, 0);
    const totalProtocolUsdValue = wallet.protocols.reduce((sum, protocol) => sum + (protocol.total_usd || 0), 0);

    return {
      ...wallet.get(),
      tokens,
      total_usd_value: parseFloat((totalTokenUsdValue + totalProtocolUsdValue))
    };
  });
};

router.get("/chains", async (req, res) => {
  try {
    const [chains, wallets] = await Promise.all([fetchChains(req), fetchWallets(req)]);

    const walletUsdValues = wallets.reduce((acc, wallet) => {
      wallet.tokens.forEach(token => {
        const chainId = token.chain_id;
        const usdValue = parseFloat(token.usd_value || 0);

        if (!acc[chainId]) {
          acc[chainId] = { chain_id: chainId, total_usd_value: 0 };
        }

        acc[chainId].total_usd_value += usdValue;
      });

      wallet.protocols.forEach(protocol => {
        const chainId = protocol.chain_id;
        const usdValue = parseFloat(protocol.total_usd || 0);

        if (!acc[chainId]) {
          acc[chainId] = { chain_id: chainId, total_usd_value: 0 };
        }

        acc[chainId].total_usd_value += usdValue;
      });

      return acc;
    }, {});

    const enrichedChains = chains.map(chain => {
      const usdValue = walletUsdValues[chain.chain_id]?.total_usd_value || 0;

      return {
        id: chain.id,
        chain_id: chain.chain_id,
        name: chain.name,
        native_token_id: chain.native_token_id,
        wrapped_token_id: chain.wrapped_token_id,
        logo_path: chain.logo_path,
        type: chain.type,
        usd_value: parseFloat(usdValue.toFixed(2)) // Ensure two decimal places
      };
    });

    const hideSmallBalances = 20
    const sortedData = enrichedChains
      .filter((chain) => chain.usd_value > hideSmallBalances)
      .sort((a, b) => b.usd_value - a.usd_value) || [];


    res.json(sortedData);
  } catch (err) {
    console.error("Error fetching chains:", err);
    res.status(500).json({ error: "Failed to fetch chains" });
  }
});


export default router;