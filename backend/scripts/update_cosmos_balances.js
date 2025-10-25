import NetWorth from '../models/NetWorthModel.js';
import { Op } from 'sequelize';

const displayedAmounts = {
    SEI: 1302,
    INJ: 24.74,
    ATOM: 50.09,
    TIA: 114,
    AKT: 116,
    DYM: 465,
    SAGA: 434,
    OSMO: 500,
    KUJI: 212
};

function applyTokenAmountsFromDisplay(entry, displayedAmountsMap) {
    for (const token of entry.tokens) {
        if (token.chain_id !== 'cosmos') continue;
        const displayed = displayedAmountsMap[token.symbol];
        if (displayed !== undefined) {
            token.amount = displayed;
            if (token.wallets && Array.isArray(token.wallets)) {
                for (const wallet of token.wallets) {
                    wallet.amount = displayed;
                }
            }
            token.total_usd_value = parseFloat((token.amount * token.price).toFixed(6));
        }
    }

    for (const chain of entry.chains) {
        const tokensInChain = entry.tokens.filter(t => t.chain_id === chain.chain_id);
        chain.token_usd_value = tokensInChain.reduce((acc, t) => acc + t.total_usd_value, 0);
        chain.usd_value = parseFloat((chain.token_usd_value + chain.protocol_usd_value).toFixed(6));
    }

    entry.totalTokenUSD = entry.tokens.reduce((acc, t) => acc + t.total_usd_value, 0);
    entry.totalProtocolUSD = entry.protocolsTable.reduce((acc, p) => acc + p.totalUSD, 0);

    return entry;
}

async function run() {
    const entries = await NetWorth.findAll({
        where: {
            date: {
                [Op.between]: [new Date('2025-06-25'), new Date('2025-07-22')]
            }
        },
        attributes: ['id', 'history', 'date', 'totalNetWorth']
    });

    for (const entry of entries) {
        const raw = entry.history;
        const historyObj = typeof raw === 'string'
            ? JSON.parse(raw)
            : Buffer.isBuffer(raw)
                ? JSON.parse(raw.toString())
                : raw;

        console.log(`Processing entry ${entry.id}`);
        for (const token of historyObj.tokens) {
            if (token.chain_id !== 'cosmos') continue;
            if (displayedAmounts[token.symbol] !== undefined) {
                console.log(` - ${token.symbol}: original amount = ${token.amount}, new amount = ${displayedAmounts[token.symbol]}`);
            }
        }

        const updatedHistory = applyTokenAmountsFromDisplay(historyObj, displayedAmounts);
        // Log the computed values before saving
        const newTotal = updatedHistory.totalTokenUSD + updatedHistory.totalProtocolUSD;
        console.log(`new totalNetWorth: ${newTotal}`);
        console.dir(updatedHistory, { depth: null });

        try {
            await entry.update({
                history: updatedHistory,
                totalNetWorth: newTotal
            });
            await entry.reload();
            console.log(`Confirmed update for ${entry.id}: new totalNetWorth = ${entry.totalNetWorth}`);
        } catch (err) {
            console.error(`Failed to update entry ${entry.id}`, err);
        }
    }
}

run().catch(console.error);