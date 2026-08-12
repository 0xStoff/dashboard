import { QueryTypes } from "sequelize";
import sequelize from "../sequelize.js";

const compactPortfolioHistory = async () => {
  if (process.env.CONFIRM_DROP_LEGACY_HISTORY !== "yes") {
    throw new Error("Set CONFIRM_DROP_LEGACY_HISTORY=yes after creating a verified database backup");
  }

  const [legacyTable] = await sequelize.query(
    `SELECT to_regclass('public."net-worths"') AS table_name`,
    { type: QueryTypes.SELECT }
  );
  if (!legacyTable?.table_name) {
    console.log("Legacy portfolio history is already compacted");
    return;
  }

  const [legacy] = await sequelize.query(
    `SELECT COUNT(DISTINCT (date AT TIME ZONE 'UTC')::date)::integer AS days FROM "net-worths"`,
    { type: QueryTypes.SELECT }
  );
  const [current] = await sequelize.query(
    `
      SELECT
        COUNT(DISTINCT snapshot_date)::integer AS days,
        (SELECT COUNT(*)::integer FROM portfolio_asset_snapshots) AS assets
      FROM portfolio_snapshots
    `,
    { type: QueryTypes.SELECT }
  );

  if (Number(current?.days || 0) < Number(legacy?.days || 0)) {
    throw new Error(
      `Refusing to remove legacy history: migrated ${current?.days || 0} of ${legacy?.days || 0} days`
    );
  }
  if (Number(current?.assets || 0) <= 0) {
    throw new Error("Refusing to remove legacy history: no asset history was migrated");
  }

  await sequelize.query('DROP TABLE "net-worths"');
  console.log(
    `Removed legacy JSON history after verifying ${current.days} days and ${current.assets} asset points`
  );
};

compactPortfolioHistory()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error("Portfolio history compaction failed:", error);
    await sequelize.close();
    process.exitCode = 1;
  });
