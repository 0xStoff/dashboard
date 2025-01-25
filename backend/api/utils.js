import { Op } from "sequelize";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";

const TOKEN_ATTRIBUTES = [
  "name", "symbol", "decimals", "price", "logo_path", "chain_id", "price_24h_change"
];

export const fetchWalletData = async (chain, usd_value) => {
  const whereClause = {};
  if (chain && chain !== 'all') whereClause.chain = chain;

  return await WalletModel.findAll({
    where: whereClause,
    include: [
      {
        model: TokenModel,
        through: {
          model: WalletTokenModel,
          attributes: ["amount", "raw_amount", "usd_value"],
          where: usd_value ? { usd_value: { [Op.gt]: usd_value } } : {},
        },
        attributes: TOKEN_ATTRIBUTES,
      },
      {
        model: ProtocolModel,
        attributes: ["name", "total_usd", "logo_path", "chain_id", "portfolio_item_list"],
      },
    ],
    order: [["id", "ASC"]],
    nest: true, // Keeps nested structure for relationships
  });
};
export const transformData = (wallets) => {
  const tokenMap = new Map();

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

      if (!tokenMap.has(tokenKey)) {
        tokenMap.set(tokenKey, {
          chain_id,
          name,
          symbol,
          decimals,
          logo_path,
          price: parseFloat(price),
          price_24h_change: price_24h_change || null,
          amount: parseFloat(amount),
          is_core,
          wallets: [
            {
              tag,
              id: walletId,
              wallet: walletAddress,
              amount: parseFloat(amount),
            },
          ],
        });
      } else {
        const existingToken = tokenMap.get(tokenKey);
        existingToken.amount += parseFloat(amount);
        existingToken.wallets.push({
          tag,
          id: walletId,
          wallet: walletAddress,
          amount: parseFloat(amount),
        });
      }
    });
  });

  return [...tokenMap.values()];
};