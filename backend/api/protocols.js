import express from "express";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";

const router = express.Router();

router.get("/protocols", async (req, res) => {
  try {
    const protocols = await ProtocolModel.findAll({
      include: [
        {
          model: WalletModel,
          attributes: ["id", "wallet", "tag", "chain"],
        },
      ],
      order: [["id", "ASC"]],
    });

    const response = protocols.map((protocol) => {
      const protocolData = protocol.get();

      protocolData.wallets = protocolData.wallets.map((wallet) => {
        const walletData = wallet.get();
        if (walletData.wallets_protocols && walletData.wallets_protocols.portfolio_item_list) {
          walletData.portfolio_item_list = walletData.wallets_protocols.portfolio_item_list;
        }
        delete walletData.wallets_protocols;
        walletData.tokens = walletData.tokens || [];
        return walletData;
      });
      delete protocolData.portfolio_item_list;
      return protocolData;
    });

    res.json(response);
  } catch (err) {
    console.error("Error fetching protocols:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
});

export default router;