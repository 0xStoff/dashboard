// /api/chains.js
import express from "express";
import EvmChains from "../models/EvmChainsModel.js";
import NonEvmChains from "../models/NonEvmChainsModel.js";
import { Model as ChainModel, Op } from "sequelize";
import WalletModel from "../models/WalletModel.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";

const router = express.Router();

router.get('/evm-chains', async (req, res) => {
    try {
        const evmChains = await EvmChains.findAll({
            order: [['chain_id', 'ASC']],
        });
        res.json(evmChains);
    } catch (err) {
        console.error('Error fetching chains', err);
        res.status(500).json({ error: 'Failed to fetch chains' });
    }
});

router.get('/non-evm-chains', async (req, res) => {
    try {
        const nonEvmChains = await NonEvmChains.findAll({
            order: [['chain_id', 'ASC']],
        });
        res.json(nonEvmChains);
    } catch (err) {
        console.error('Error fetching non-EVM chains', err);
        res.status(500).json({ error: 'Failed to fetch non-EVM chains' });
    }
});

// Combined route for all chains
router.get('/chains1', async (req, res) => {
    try {
        const [evmChains, nonEvmChains] = await Promise.all([
            EvmChains.findAll({ order: [['chain_id', 'ASC']] }),
            NonEvmChains.findAll({ order: [['chain_id', 'ASC']] }),
        ]);

        const combinedChains = [
            ...evmChains.map(chain => ({ ...chain.dataValues, type: 'EVM' })),
            ...nonEvmChains.map(chain => ({ ...chain.dataValues, type: 'Non-EVM' })),
        ];

        res.json(combinedChains);
    } catch (err) {
        console.error('Error fetching all chains', err);
        res.status(500).json({ error: 'Failed to fetch all chains' });
    }
});


router.get('/chains', async (req, res) => {
    try {
        // Include clause for WalletModel to fetch associated tokens
        const includeClause = [{
            model: TokenModel,
            through: {
                model: WalletTokenModel,
                attributes: ['amount', 'raw_amount', 'usd_value'],
            },
            attributes: ['name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
        }];

        // Fetch wallets with tokens
        const unflattedWallets = await WalletModel.findAll({
            include: includeClause,
            order: [['id', 'ASC']],
        });

        // Helper to flatten token data
        const flattenAmount = (tokens) => tokens.map(token => {
            const { wallets_tokens, ...tokenData } = token.get();
            return {
                ...tokenData,
                amount: wallets_tokens.amount,
                raw_amount: wallets_tokens.raw_amount,
                usd_value: wallets_tokens.usd_value
            };
        });

        // Flatten wallets and calculate total USD value
        const flattenAllWallets = (wallets) => wallets.map(wallet => {
            const modifiedTokens = flattenAmount(wallet.tokens);
            return {
                ...wallet.get(),
                tokens: modifiedTokens,
            };
        });

        const wallets = flattenAllWallets(unflattedWallets);

        // Helper to calculate total USD value per wallet
        const calculateTotalUsdValue = (wallets) => {
            return wallets.map(wallet => {
                const totalUsdValue = wallet.tokens.reduce((sum, token) => {
                    return sum + parseFloat(token.usd_value || 0); // Ensure usd_value is a number
                }, 0);

                return {
                    ...wallet, // Spread existing wallet properties
                    total_usd_value: totalUsdValue.toFixed(2), // Add the aggregated USD value
                };
            });
        };

        const enrichedWallets = calculateTotalUsdValue(wallets);


        // Fetch chains
        const [evmChains, nonEvmChains] = await Promise.all([
            EvmChains.findAll({ order: [['chain_id', 'ASC']] }),
            NonEvmChains.findAll({ order: [['chain_id', 'ASC']] }),
        ]);

        // Combine chains
        const combinedChains = [
            ...evmChains.map(chain => ({ ...chain.dataValues})),
            ...nonEvmChains.map(chain => ({ ...chain.dataValues })),
        ];

        // Enrich chains with total USD value by filtering wallets
        const enrichedChains = combinedChains.map((chain) => {
            const chainWallets = enrichedWallets.filter(wallet => wallet.chain === chain.chain_id);

            const totalUsdValue = chainWallets.reduce((sum, wallet) => {
                return sum + parseFloat(wallet.total_usd_value || 0);
            }, 0);

            console.log(chainWallets)

            return {
                ...chain, // Spread existing chain properties
                usd_value: totalUsdValue.toFixed(2), // Add aggregated USD value
            };
        });

        res.json(enrichedChains); // Return enriched chains
    } catch (err) {
        console.error('Error fetching chains:', err);
        res.status(500).json({ error: 'Failed to fetch chains' });
    }
});
export default router;