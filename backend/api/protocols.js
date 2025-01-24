import express from "express";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";

const router = express.Router();

router.get("/protocols", async (req, res) => {
  try {
    // Fetch protocols and include associated wallets
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

      // Map through wallets and merge wallets_protocols into wallets
      protocolData.wallets = protocolData.wallets.map((wallet) => {
        const walletData = wallet.get();

        // Flatten wallets_protocols into the wallet
        if (walletData.wallets_protocols && walletData.wallets_protocols.portfolio_item_list) {
          walletData.portfolio_item_list = walletData.wallets_protocols.portfolio_item_list;
        }

        // Remove wallets_protocols if it exists
        delete walletData.wallets_protocols;

        // Ensure tokens is present (default to empty array if undefined)
        walletData.tokens = walletData.tokens || [];
        return walletData;
      });

      // Remove portfolio_item_list at the protocol level (if it exists)
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
//     const hideSmallBalances = parseFloat(req.query.hideSmallBalances || 0);
//     const selectedChainId = req.query.selectedChainId || "all";
//
//     const protocols = await ProtocolModel.findAll({
//       include: [
//         {
//           model: WalletModel, // Adjust to your actual Wallet model association
//           include: [
//             {
//               model: ProtocolModel, // Adjust to your actual PortfolioItem model association
//               include: [
//                 {
//                   model: TokenModel, // Adjust to your actual Token model association
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//       order: [["id", "ASC"]],
//     });
//
//     const groupedByProtocol = protocols.reduce((acc, protocol) => {
//       if (!acc[protocol.name]) {
//         acc[protocol.name] = {
//           name: protocol.name,
//           positions: [],
//           totalUSD: 0,
//         };
//       }
//
//       const addWalletPositions = (item, walletTag) => {
//         const validTokens = (item.tokens || []).filter(
//           (token) =>
//             token.amount * token.price > hideSmallBalances &&
//             (selectedChainId === "all" || token.chain === selectedChainId)
//         );
//
//         if (!validTokens.length) return;
//
//         const tokenNames = validTokens.map((t) => t.name).join(" + ");
//         const logoUrls = validTokens.map((t) => t.logo_url);
//         const totalAmount = validTokens.reduce((sum, token) => sum + token.amount, 0);
//         const totalUsdValue = validTokens.reduce(
//           (sum, token) => sum + token.amount * token.price,
//           0
//         );
//         const avgPrice = totalUsdValue / totalAmount;
//
//         const existingPositionIndex = acc[protocol.name].positions.findIndex(
//           (p) =>
//             p.tokenNames === tokenNames &&
//             p.chain === validTokens[0].chain &&
//             p.type === item.type
//         );
//
//         if (existingPositionIndex > -1) {
//           const existingPosition = acc[protocol.name].positions[existingPositionIndex];
//           existingPosition.amount += totalAmount;
//           existingPosition.usdValue += totalUsdValue;
//           existingPosition.wallets.push({ tag: walletTag, amount: totalAmount });
//         } else {
//           acc[protocol.name].positions.push({
//             type: item.type,
//             chain: validTokens[0].chain,
//             tokenNames,
//             logoUrls,
//             price: avgPrice,
//             amount: totalAmount,
//             usdValue: totalUsdValue,
//             wallets: walletTag ? [{ tag: walletTag, amount: totalAmount }] : [],
//           });
//         }
//
//         acc[protocol.name].totalUSD += totalUsdValue;
//       };
//
//       protocol.wallets.forEach((wallet) =>
//         wallet.portfolio_items.forEach((item) =>
//           addWalletPositions(item, wallet.tag)
//         )
//       );
//
//       return acc;
//     }, {});
//
//     const result = Object.values(groupedByProtocol)
//       .map((protocol) => {
//         const unified = {};
//         protocol.positions.forEach((position) => {
//           const key = `${position.tokenNames}-${position.type}-${position.chain}`;
//           if (unified[key]) {
//             unified[key].amount += position.amount;
//             unified[key].usdValue += position.usdValue;
//             unified[key].wallets = [...unified[key].wallets, ...position.wallets];
//           } else {
//             unified[key] = { ...position, wallets: [...position.wallets] };
//           }
//         });
//         protocol.positions = Object.values(unified).sort((a, b) => b.usdValue - a.usdValue);
//         return protocol;
//       })
//       .sort((a, b) => b.totalUSD - a.totalUSD)
//       .filter((protocol) => protocol.totalUSD > hideSmallBalances);
//
