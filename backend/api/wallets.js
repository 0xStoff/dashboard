// api/wallets.js
import express from 'express';
import Wallet from "../models/Wallet.js";
import Token from "../models/Token.js";
import WalletToken from "../models/WalletToken.js";

const router = express.Router();


const flattenAmount = (tokens) => tokens.map(token => {
    const {wallets_tokens, ...tokenData} = token.get();
    return {
        ...tokenData, amount: wallets_tokens.amount, raw_amount: wallets_tokens.raw_amount,
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
        const {chain} = req.query;
        const whereClause = chain ? {chain} : undefined;

        const wallets = await Wallet.findAll({
            where: whereClause, include: [{
                model: Token, through: {
                    model: WalletToken, attributes: ['amount', 'raw_amount'], // as: 'amount'
                }, attributes: ['name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
            }], order: [['id', 'ASC']],
        });

        const result = flattenAllWallets(wallets)

        res.json(result);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({error: 'Failed to fetch wallets'});
    }
});

router.get('/wallets/:walletId', async (req, res) => {
    const {walletId} = req.params;

    try {
        const wallet = await Wallet.findOne({
            where: {id: walletId}, include: [{
                model: Token, through: {
                    model: WalletToken, attributes: ['amount', 'raw_amount'],
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
