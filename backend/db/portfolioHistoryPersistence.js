import { Op } from "sequelize";
import PortfolioAsset from "../models/PortfolioAssetModel.js";

export const persistAssetCatalog = async ({ userId, assets, transaction }) => {
  if (!assets.length) return new Map();

  const uniqueAssets = [...new Map(assets.map((asset) => [asset.assetKey, asset])).values()];
  for (const { assetType, assetKey, chainId, name, symbol, contractAddress } of uniqueAssets) {
    await PortfolioAsset.upsert(
      {
        userId,
        assetType,
        assetKey,
        chainId,
        name,
        symbol,
        contractAddress: contractAddress || null,
      },
      {
        conflictFields: ["user_id", "asset_type", "asset_key"],
        transaction,
      }
    );
  }

  const catalogRows = await PortfolioAsset.findAll({
    where: {
      userId,
      assetKey: { [Op.in]: uniqueAssets.map((asset) => asset.assetKey) },
    },
    transaction,
  });

  const assetIds = new Map(catalogRows.map((asset) => [asset.assetKey, asset.id]));
  const missingAsset = uniqueAssets.find((asset) => !assetIds.has(asset.assetKey));
  if (missingAsset) {
    throw new Error(`Failed to persist portfolio asset ${missingAsset.assetKey}`);
  }
  return assetIds;
};
