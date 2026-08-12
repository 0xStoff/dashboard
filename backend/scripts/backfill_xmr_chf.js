import axios from "axios";
import { Op } from "sequelize";
import sequelize from "../sequelize.js";
import TransactionModel from "../models/TransactionsModel.js";

const DAY_SECONDS = 86_400;

const fetchDailyCloses = async (pair, since) => {
    const { data } = await axios.get("https://api.kraken.com/0/public/OHLC", {
        params: { pair, interval: 1440, since },
    });
    if (data.error?.length) throw new Error(data.error.join(", "));

    const key = Object.keys(data.result || {}).find((candidate) => candidate !== "last");
    if (!key) throw new Error(`No OHLC data returned for ${pair}`);
    return data.result[key].map((candle) => ({ timestamp: Number(candle[0]), close: Number(candle[4]) }));
};

const closeForDay = (candles, timestamp) => {
    const day = Math.floor(timestamp / DAY_SECONDS) * DAY_SECONDS;
    return candles.find((candle) => candle.timestamp === day)?.close ?? null;
};

try {
    const rows = await TransactionModel.findAll({
        where: {
            exchange: "Kraken",
            type: "withdrawal",
            asset: { [Op.in]: ["XMR", "XXMR", "MONERO"] },
        },
    });
    const missing = rows.filter((row) => !(Number(row.transactionAmount) > 0));
    if (!missing.length) {
        console.log("No missing XMR valuations.");
        process.exitCode = 0;
    } else {
        const earliest = Math.min(...missing.map((row) => new Date(row.date).getTime() / 1000));
        const [xmrUsd, usdChf] = await Promise.all([
            fetchDailyCloses("XMRUSD", Math.floor(earliest) - DAY_SECONDS),
            fetchDailyCloses("USDCHF", Math.floor(earliest) - DAY_SECONDS),
        ]);

        let updated = 0;
        for (const row of missing) {
            const timestamp = new Date(row.date).getTime() / 1000;
            const xmrClose = closeForDay(xmrUsd, timestamp);
            const chfClose = closeForDay(usdChf, timestamp);
            if (!xmrClose || !chfClose) continue;

            row.transactionAmount = String(Math.abs(Number(row.amount)) * xmrClose * chfClose);
            await row.save();
            updated += 1;
        }
        console.log(`Backfilled ${updated} of ${missing.length} XMR withdrawals.`);
    }
} finally {
    await sequelize.close();
}
