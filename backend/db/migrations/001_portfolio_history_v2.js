import { QueryTypes } from "sequelize";
import PortfolioAssetSnapshot from "../../models/PortfolioAssetSnapshotModel.js";
import { getSnapshotDate, summarizeLegacyHistory } from "../../utils/portfolioHistory.js";
import { persistAssetCatalog } from "../portfolioHistoryPersistence.js";

const findLegacyOwnerId = async (sequelize, transaction) => {
  if (process.env.LEGACY_HISTORY_USER_ID) {
    const configuredId = Number(process.env.LEGACY_HISTORY_USER_ID);
    if (!Number.isInteger(configuredId) || configuredId <= 0) {
      throw new Error("LEGACY_HISTORY_USER_ID must be a positive integer");
    }
    return configuredId;
  }

  const [owner] = await sequelize.query(
    `
      SELECT u.id
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      GROUP BY u.id
      ORDER BY COUNT(w.id) DESC, u.id ASC
      LIMIT 1
    `,
    { type: QueryTypes.SELECT, transaction }
  );
  return owner?.id ? Number(owner.id) : null;
};

export const migratePortfolioHistoryV2 = async ({ sequelize, transaction }) => {
  const [legacyTable] = await sequelize.query(
    `SELECT to_regclass('public."net-worths"') AS table_name`,
    { type: QueryTypes.SELECT, transaction }
  );
  if (!legacyTable?.table_name) {
    return { migratedSnapshots: 0, migratedAssets: 0 };
  }

  const ownerId = await findLegacyOwnerId(sequelize, transaction);
  if (!ownerId) {
    throw new Error("Cannot migrate legacy portfolio history without an owning user");
  }

  const legacyRows = await sequelize.query(
    `
      SELECT DISTINCT ON ((date AT TIME ZONE 'UTC')::date)
        id,
        date,
        "totalNetWorth" AS "totalNetWorth",
        history
      FROM "net-worths"
      WHERE "totalNetWorth" > 0
      ORDER BY (date AT TIME ZONE 'UTC')::date, date DESC, id DESC
    `,
    { type: QueryTypes.SELECT, transaction }
  );

  const preparedRows = legacyRows.map((legacyRow) => ({
    legacyRow,
    summary: summarizeLegacyHistory(legacyRow.history || {}),
  }));
  const allAssets = preparedRows.flatMap(({ summary }) => summary.assets);
  const assetIds = await persistAssetCatalog({
    userId: ownerId,
    assets: allAssets,
    transaction,
  });

  let migratedAssets = 0;
  for (const { legacyRow, summary } of preparedRows) {
    const { tokenUsd, protocolUsd, assets } = summary;
    const snapshotDate = getSnapshotDate(legacyRow.date, "UTC");
    const [snapshot] = await sequelize.query(
      `
        INSERT INTO portfolio_snapshots
          (user_id, captured_at, snapshot_date, total_usd, token_usd, protocol_usd)
        VALUES
          (:ownerId, :capturedAt, :snapshotDate, :totalUsd, :tokenUsd, :protocolUsd)
        ON CONFLICT (user_id, snapshot_date)
        DO UPDATE SET
          captured_at = EXCLUDED.captured_at,
          total_usd = EXCLUDED.total_usd,
          token_usd = EXCLUDED.token_usd,
          protocol_usd = EXCLUDED.protocol_usd
        RETURNING id
      `,
      {
        replacements: {
          ownerId,
          capturedAt: legacyRow.date,
          snapshotDate,
          totalUsd: Number(legacyRow.totalNetWorth),
          tokenUsd,
          protocolUsd,
        },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    await PortfolioAssetSnapshot.destroy({
      where: { snapshotId: snapshot.id },
      transaction,
    });
    if (assets.length) {
      await PortfolioAssetSnapshot.bulkCreate(
        assets.map((asset) => ({
          snapshotId: snapshot.id,
          assetId: assetIds.get(asset.assetKey),
          balance: asset.balance,
          usdValue: asset.usdValue,
        })),
        { transaction }
      );
      migratedAssets += assets.length;
    }
  }

  return { migratedSnapshots: legacyRows.length, migratedAssets, ownerId };
};
