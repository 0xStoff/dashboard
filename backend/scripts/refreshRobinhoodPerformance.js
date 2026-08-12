import { writeFile } from "node:fs/promises";
import sequelize from "../sequelize.js";
import { getRobinhoodPerformance } from "../services/robinhood/performanceService.js";

const userId = Number(process.argv[2]);
const statusFile = process.argv[3] || "/tmp/robinhood-refresh-status.json";

if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usage: node scripts/refreshRobinhoodPerformance.js <user-id> [status-file]");
}

const saveStatus = (status) => writeFile(statusFile, JSON.stringify(status, null, 2));

try {
    let result = await getRobinhoodPerformance({ userId, force: true });
    await saveStatus({
        state: result.dataFreshness?.isIndexing ? "indexing" : "complete",
        asOf: result.dataFreshness?.asOf,
        startedAt: new Date().toISOString(),
    });

    while (result.dataFreshness?.isIndexing) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        result = await getRobinhoodPerformance({ userId });
        await saveStatus({
            state: result.dataFreshness?.isIndexing ? "indexing" : "complete",
            asOf: result.dataFreshness?.asOf,
            updatedAt: new Date().toISOString(),
            error: result.dataFreshness?.lastError || null,
        });
    }
} catch (error) {
    await saveStatus({ state: "failed", error: error.message, updatedAt: new Date().toISOString() });
    process.exitCode = 1;
} finally {
    await sequelize.close();
}
