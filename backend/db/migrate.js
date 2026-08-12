import { QueryTypes } from "sequelize";
import sequelize from "../sequelize.js";
import { migratePortfolioHistoryV2 } from "./migrations/001_portfolio_history_v2.js";
import { migrateWalletGroups } from "./migrations/002_wallet_groups.js";
import { migrateRefreshJobs } from "./migrations/003_refresh_jobs.js";
import { migrateWalletRefreshPolicy } from "./migrations/004_wallet_refresh_policy.js";
import { migrateRobinhoodHistoricalAudit } from "./migrations/005_robinhood_historical_audit.js";
import { migrateRobinhoodIncrementalIndex } from "./migrations/006_robinhood_incremental_index.js";
import PortfolioSnapshot from "../models/PortfolioSnapshotModel.js";
import PortfolioAsset from "../models/PortfolioAssetModel.js";
import PortfolioAssetSnapshot from "../models/PortfolioAssetSnapshotModel.js";

const migrations = [
  {
    id: "001_portfolio_history_v2",
    up: migratePortfolioHistoryV2,
  },
  {
    id: "002_wallet_groups",
    up: migrateWalletGroups,
  },
  {
    id: "003_refresh_jobs",
    up: migrateRefreshJobs,
  },
  {
    id: "004_wallet_refresh_policy",
    up: migrateWalletRefreshPolicy,
  },
  {
    id: "005_robinhood_historical_audit",
    up: migrateRobinhoodHistoricalAudit,
  },
  {
    id: "006_robinhood_incremental_index",
    up: migrateRobinhoodIncrementalIndex,
  },
];

export const runMigrations = async () => {
  await PortfolioSnapshot.sync();
  await PortfolioAsset.sync();
  await PortfolioAssetSnapshot.sync();
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedRows = await sequelize.query("SELECT id FROM schema_migrations", {
    type: QueryTypes.SELECT,
  });
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    const result = await sequelize.transaction(async (transaction) => {
      const migrationResult = await migration.up({ sequelize, transaction });
      await sequelize.query("INSERT INTO schema_migrations (id) VALUES (:id)", {
        replacements: { id: migration.id },
        transaction,
      });
      return migrationResult;
    });

    console.log(`Applied database migration ${migration.id}`, result);
  }
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runMigrations()
    .then(() => sequelize.close())
    .catch(async (error) => {
      console.error("Database migration failed:", error);
      await sequelize.close();
      process.exitCode = 1;
    });
}
