import express from "express";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";

const router = express.Router();


const fetchProtocolData = async() => {
  const protocols = await ProtocolModel.findAll({
    include: [{
      model: WalletModel, attributes: ["id", "wallet", "tag", "chain"]
    }], order: [["id", "ASC"]]
  });

  return protocols.map((protocol) => {
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
  })
}
router.get("/protocols", async (req, res) => {
  try {
    const protocols = await fetchProtocolData()
    res.json(protocols);
  } catch (err) {
    console.error("Error fetching protocols:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
});


router.get("/protocols-table", async (req, res) => {
  try {
    const selectedChainId = req.query.chain || "all";
    const hideSmallBalances = parseFloat(req.query.hideSmallBalances) || 10;
    const protocols = await fetchProtocolData()


    const addPosition = (protocolName, acc, tokens, itemName, walletTag, walletAmount) => {
      const validTokens = tokens.filter((token) => token.amount * token.price > hideSmallBalances && (selectedChainId === "all" || token.chain === selectedChainId));

      if (!validTokens.length) return;

      const tokenNames = validTokens.map((t) => t.name).join(" + ");
      const logoUrls = validTokens.map((t) => t.logo_url);
      const totalAmount = validTokens.reduce((sum, token) => sum + token.amount, 0);
      const totalUsdValue = validTokens.reduce((sum, token) => sum + token.amount * token.price, 0);
      const avgPrice = totalUsdValue / totalAmount;

      const protocol = acc[protocolName];
      const existingPositionIndex = protocol.positions.findIndex((p) => p.tokenNames === tokenNames && p.chain === validTokens[0].chain && p.type === itemName);

      if (existingPositionIndex > -1) {
        const existingPosition = protocol.positions[existingPositionIndex];
        if (walletTag && walletAmount !== undefined) {
          existingPosition.wallets.push({ tag: walletTag, amount: walletAmount });
        }
      } else {
        protocol.positions.push({
          type: itemName,
          chain: validTokens[0].chain,
          tokenNames,
          logoUrls,
          price: avgPrice,
          amount: totalAmount,
          usdValue: totalUsdValue,
          wallets: walletTag && walletAmount !== undefined ? [{ tag: walletTag, amount: walletAmount }] : []
        });
      }

      protocol.totalUSD += totalUsdValue;
    };

    const groupedByProtocol = protocols.reduce((acc, protocol) => {
      if (!acc[protocol.name]) {
        acc[protocol.name] = { name: protocol.name, positions: [], totalUSD: 0 };
      }

      const addWalletPositions = (item, walletTag) => {
        const walletAmount = item.detail.supply_token_list?.[0]?.amount || 0;
        addPosition(protocol.name, acc, item.detail.supply_token_list || [], item.name, walletTag, walletAmount);
      };


      protocol.wallets ? protocol.wallets.forEach((wallet) => wallet.portfolio_item_list.forEach((item) => addWalletPositions(item, wallet.tag))) : protocol.portfolio_item_list.forEach((item) => addWalletPositions(item, ""));

      return acc;
    }, {}) || {};

    const unifyPositions = (positions) => {
      const unified = {};

      positions.forEach((position) => {
        const key = `${position.tokenNames}-${position.type}-${position.chain}`;
        if (unified[key]) {
          unified[key].amount += position.amount;
          unified[key].usdValue += position.usdValue;
          unified[key].wallets = [...unified[key].wallets, ...position.wallets];
        } else {
          unified[key] = { ...position, wallets: [...position.wallets] };
        }
      });

      return Object.values(unified).sort((a, b) => b.usdValue - a.usdValue); // Sort by USD value
    }


    const sortedGroupedProtocols = Object.values(groupedByProtocol)
      .map((protocol) => ({
        ...protocol, positions: unifyPositions(protocol.positions)
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .filter((protocol) => protocol.totalUSD > hideSmallBalances);



    res.json(sortedGroupedProtocols);
  } catch (err) {
    console.error("Error fetching protocols:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
});


export default router;