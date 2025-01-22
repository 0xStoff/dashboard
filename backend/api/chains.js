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



const fetchChains = async (req) => {


  const [evmChains, nonEvmChains] = await Promise.all([
    EvmChains.findAll({ order: [['chain_id', 'ASC']] }),
    NonEvmChains.findAll({ order: [['chain_id', 'ASC']] }),
  ]);

  return [
    ...evmChains.map(chain => ({
      ...chain.dataValues,
      type: 'evm', // Add 'type: evm' for EVM chains
    })),
    ...nonEvmChains.map(chain => ({
      ...chain.dataValues,
      type: 'non-evm', // Add 'type: non-evm' for non-EVM chains
    })),
  ];
};


const fetchWallets = async (req) => {
  // const { chain, usd_value } = req.query;
  //
  //
  // const whereClause = {};
  // if (chain) whereClause.chain = chain;
  //
  // const includeClause = [{
  //   model: TokenModel,
  //   through: {
  //     model: WalletTokenModel,
  //     attributes: ['amount', 'raw_amount', 'usd_value'],
  //     where: usd_value ? { usd_value: { [Op.gt]: usd_value } } : {},
  //   },
  //   attributes: ['name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
  // }];
  //
  // const wallets = await WalletModel.findAll({
  //   // where: whereClause,
  //   include: includeClause,
  //   order: [['id', 'ASC']],
  // });
  //
  // console.log(wallets)
  const wallets = await WalletModel.findAll({
    include: [{
      model: TokenModel,
      through: { model: WalletTokenModel, attributes: ['amount', 'raw_amount', 'usd_value'] },
      attributes: ['name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
    }],
    order: [['id', 'ASC']],
  });

  return wallets.map(wallet => {
    const tokens = wallet.tokens.map(token => ({
      ...token.get(),
      amount: token.wallets_tokens.amount,
      raw_amount: token.wallets_tokens.raw_amount,
      usd_value: parseFloat(token.wallets_tokens.usd_value || 0),
      wallets_tokens: undefined // Explicitly remove the wallets_tokens field
    }));

    const totalUsdValue = tokens.reduce((sum, token) => sum + token.usd_value, 0);

    return {
      ...wallet.get(),
      tokens,
      total_usd_value: parseFloat(totalUsdValue.toFixed(2)),
    };
  });
};

 function mergeAndAggregateChains(accounts) {
  const chainMap = new Map();
  accounts.forEach(account => {
    account.chains?.chain_list.forEach(chain => {
      const existingChain = chainMap.get(chain.id);
      if (existingChain) {
        existingChain.usd_value += chain.usd_value;
      } else {
        chainMap.set(chain.id, {...chain});
      }
    });
  });
  return Array.from(chainMap.values());
}

router.get('/chains', async (req, res) => {
  try {
    // Fetch chains and wallets concurrently
    const [chains, wallets] = await Promise.all([fetchChains(), fetchWallets(req)]);

    // Aggregate USD values by chain
    const walletUsdValues = wallets.reduce((acc, wallet) => {
      wallet.tokens.forEach(token => {
        const chainId = token.chain_id;
        const usdValue = token.usd_value || 0;

        if (!acc[chainId]) {
          acc[chainId] = { chain_id: chainId, total_usd_value: 0 };
        }
        acc[chainId].total_usd_value += usdValue;
      });
      return acc;
    }, {});

    // Enrich chains with USD values
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
        usd_value: parseFloat(usdValue.toFixed(2)), // Ensure two decimal places
      };
    });

    res.json(enrichedChains);
  } catch (err) {
    console.error('Error fetching chains:', err);
    res.status(500).json({ error: 'Failed to fetch chains' });
  }
});

export default router;