import express from "express";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";
import { getHideSmallBalances } from "../utils/utils.js";

const router = express.Router();

export const fetchProtocolData = async (req) => {
  const protocols = await ProtocolModel.findAll({
    include: [{
      model: WalletModel, attributes: ["id", "wallet", "tag", "chain", "user_id"], where: { user_id: req.user.user.id },
    }], order: [["id", "ASC"]]
  });

  return protocols.map((protocol) => {
    const protocolData = protocol.get();
    protocolData.user_id = req.user.user.id;

    const walletSet = new Map();
    protocolData.wallets.forEach((wallet) => {
      const walletKey = `${wallet.id}-${wallet.wallet}`;
      if (!walletSet.has(walletKey)) {
        walletSet.set(walletKey, {
          tag: wallet.tag,
          id: wallet.id,
          wallet: wallet.wallet,
          chain: wallet.chain,
          amount: wallet.amount || 0,
          portfolio_item_list: wallet.wallets_protocols?.portfolio_item_list || [],
        });
      }
    });

    protocolData.wallets = Array.from(walletSet.values());

    delete protocolData.portfolio_item_list;
    return protocolData;
  });
};


export const addPosition = (protocolName, acc, tokens, itemName, walletTag, walletAmount, selectedChainId, item) => {
  const validTokens = tokens
    .filter((token) => selectedChainId === "all" || token.chain === selectedChainId)
    .filter((token) => token.amount * token.price > 0.01 || item.stats.asset_usd_value > 0.01);

  if (!validTokens.length) return;

  const tokenNames = validTokens.map((t) => t.name).join(" + ");
  const logoUrls = validTokens.map((t) => t.logo_url);
  const totalAmount = validTokens.reduce((sum, token) => sum + token.amount, 0);
  const totalUsdValue = item.stats.asset_usd_value;
  const avgPrice = totalUsdValue / totalAmount;

  const protocol = acc[protocolName];
  const existingPositionIndex = protocol.positions.findIndex((p) => p.tokenNames === tokenNames && p.chain === validTokens[0].chain && p.type === itemName);

  if (existingPositionIndex > -1) {
    const existingPosition = protocol.positions[existingPositionIndex];

    // Ensure wallet is unique in existing position
    if (walletTag && walletAmount !== undefined) {
      const existingWallet = existingPosition.wallets.find(w => w.tag === walletTag);
      if (!existingWallet) {
        existingPosition.wallets.push({ tag: walletTag, amount: walletAmount });
      }
      // else {
      //   existingWallet.amount += walletAmount; // Merge amounts if duplicate
      // }
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


export const unifyPositions = (positions) => {
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

  return Object.values(unified).sort((a, b) => b.usdValue - a.usdValue);
};

// router.get("/protocols", async (req, res) => {
//   try {
//     const protocols = await fetchProtocolData();
//     res.json(protocols);
//   } catch (err) {
//     console.error("Error fetching protocols:", err);
//     res.status(500).json({ error: "Failed to fetch protocols" });
//   }
// });

router.get("/protocols-table", async (req, res) => {
  try {
    const selectedChainId = req.query.chain || "all";
    const walletId = req.query.wallet_id || "all";
    const searchQuery = req.query.query ? req.query.query.toLowerCase() : "";

    const hideSmallBalances = await getHideSmallBalances();

    const groupedByProtocol = (await fetchProtocolData(req)).reduce((acc, protocol) => {
      if (!acc[protocol.name]) {
        acc[protocol.name] = { name: protocol.name, positions: [], totalUSD: 0 };
      }

      const addWalletPositions = (item, walletTag) => {
        const walletAmount = item.detail.supply_token_list?.[0]?.amount || 0;
        addPosition(protocol.name, acc, item.detail.supply_token_list || [], item.name, walletTag, walletAmount, selectedChainId, item);
      };

      if (protocol.wallets) {
        protocol.wallets
          .filter((wallet) => (walletId === "all" || wallet.id === Number(walletId)))
          .forEach((wallet) => wallet.portfolio_item_list.forEach((item) => addWalletPositions(item, wallet.tag)));
      } else {
        protocol.portfolio_item_list.forEach((item) => addWalletPositions(item, ""));
      }

      return acc;
    }, {});

    let sortedGroupedProtocols = Object.values(groupedByProtocol)
      .map((protocol) => ({
        ...protocol, positions: unifyPositions(protocol.positions)
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .filter((protocol) => protocol.totalUSD > hideSmallBalances);

    if (searchQuery) {
      sortedGroupedProtocols = sortedGroupedProtocols
        .map(protocol => {
          const matchingPositions = protocol.positions.filter(position =>
            position.tokenNames.toLowerCase().includes(searchQuery)
          );

          if (matchingPositions.length > 0) {
            return {
              ...protocol,
              positions: matchingPositions,
              totalUSD: matchingPositions.reduce((sum, pos) => sum + pos.usdValue, 0),
            };
          }

          return null;
        })
        .filter(protocol => protocol !== null)
        .sort((a, b) => b.totalUSD - a.totalUSD);
    }

    res.json(sortedGroupedProtocols);
  } catch (err) {
    console.error("Error fetching protocols:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
});

export default router;
