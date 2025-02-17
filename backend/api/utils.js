import { Op, Sequelize } from "sequelize";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import SettingsModel from "../models/SettingsModel.js";


const TOKEN_ATTRIBUTES = [
  "name", "symbol", "decimals", "price", "logo_path", "chain_id", "price_24h_change"
];

export const getHideSmallBalances = async () => {
  const setting = await SettingsModel.findOne({ where: { key: "HIDESMALLBALANCES" } });
  return setting ? setting.value : 10;
};

export const fetchWalletData = async (chain, usd_value, walletId) => {
  const walletWhereClause = {};
  if (walletId && walletId !== 'all') walletWhereClause.id = walletId;

  const tokenWhereClause = {};
  if (chain && chain !== 'all') tokenWhereClause.chain_id = chain;

  return await WalletModel.findAll({
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
        wallets: [
          {
            tag,
            id: walletId,
            wallet: walletAddress,
            amount: parseFloat(amount),
          },
        ],
      };

      if (!tokenMap.has(tokenKey)) {
        tokenMap.set(tokenKey, newTokenData);
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


  return [...tokenMap.values()]
    .reduce((acc, token) => {
      const total_usd_value = token.amount * token.price;
      if (total_usd_value > hideSmallBalances) {
        acc.push({
          ...token,
          total_usd_value,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.total_usd_value - a.total_usd_value);

};