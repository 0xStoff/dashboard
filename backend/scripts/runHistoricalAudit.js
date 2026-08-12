import sequelize from "../sequelize.js";
import {
    getHistoricalAuditStatus,
    startHistoricalAudit,
} from "../services/robinhood/historicalAuditService.js";

const userId = Number(process.argv[2]);
if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usage: node scripts/runHistoricalAudit.js <user-id>");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
    const started = await startHistoricalAudit(userId);
    console.log(JSON.stringify({ accepted: started.accepted, reason: started.reason || null, audit: started.audit }));

    const deadline = Date.now() + 15 * 60 * 1_000;
    let audit = started.audit;
    while (audit.isRunning && Date.now() < deadline) {
        await sleep(5_000);
        audit = await getHistoricalAuditStatus(userId);
        console.log(JSON.stringify({ audit }));
    }

    if (audit.isRunning) throw new Error("Historical audit exceeded the 15 minute runner deadline");
    if (!audit.includedInAccounting) process.exitCode = 2;
} finally {
    await sequelize.close();
}
