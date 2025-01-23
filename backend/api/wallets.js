// api/wallets.js
import express from 'express';
import WalletModel from "../models/WalletModel.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import {Op} from "sequelize";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";

const router = express.Router();

const flattenAmount = (tokens) => tokens.map(token => {
    const {wallets_tokens, ...tokenData} = token.get();
    return {
        ...tokenData,
        amount: wallets_tokens.amount,
        raw_amount: wallets_tokens.raw_amount,
        usd_value: wallets_tokens.usd_value
    };
});

const flattenSingleWallet = (wallet) => {
    const {id, wallet: walletAddress, tag, chain, tokens} = wallet.get(); // Extract wallet details
    const modifiedTokens = flattenAmount(tokens)
    return {
        id, wallet: walletAddress, tag, chain, tokens: modifiedTokens,
    };
};

const flattenAllWallets = (wallets) => wallets.map(wallet => {
    const modifiedTokens = flattenAmount(wallet.tokens)
    return {
        ...wallet.get(), tokens: modifiedTokens,
    };
});


router.get('/wallets', async (req, res) => {
    try {
        const { chain, usd_value } = req.query;

        const whereClause = {};
        if (chain) whereClause.chain = chain;

        const includeClause = [{
            model: TokenModel,
            through: {
                model: WalletTokenModel,
                attributes: ['amount', 'raw_amount', 'usd_value'],
                where: usd_value ? { usd_value: { [Op.gt]: usd_value } } : {},
            },
            attributes: ['name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id', "price_24h_change"],
        },{
            model: ProtocolModel,
            through: {
                model: WalletProtocolModel,
                attributes: ['wallet_id', 'protocol_id', 'portfolio_item_list'],
                // where: usd_value ? { usd_value: { [Op.gt]: usd_value } } : {},
            },
            attributes: ['name', 'total_usd', 'logo_path', 'chain_id'],
        }];

        const wallets = await WalletModel.findAll({
            where: whereClause,
            include: includeClause,
            order: [['id', 'ASC']],
        });

        const result = flattenAllWallets(wallets);
        res.json(result);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});


router.get('/wallets/:walletId', async (req, res) => {
    const {walletId} = req.params;

    try {
        const wallet = await WalletModel.findOne({
            where: {id: walletId}, include: [{
                model: TokenModel, through: {
                    model: WalletTokenModel, attributes: ['amount', 'raw_amount', 'usd_value'],
                }, attributes: ['id', 'name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
            }],
        });

        if (!wallet) {
            return res.status(404).json({error: `Wallet with id ${walletId} not found`});
        }

        const result = flattenSingleWallet(wallet);
        res.json(result);
    } catch (err) {
        console.error(`Error fetching tokens for wallet ${walletId}:`, err);
        res.status(500).json({error: `Failed to fetch tokens for wallet ${walletId}`});
    }
});
export default router;
