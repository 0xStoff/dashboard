import WalletModel from "./WalletModel.js";
import TokenModel from "./TokenModel.js";
import WalletTokenModel from "./WalletTokenModel.js";
import ProtocolModel from "./ProtocolModel.js";
import WalletProtocolModel from "./WalletProtocolModel.js";
import UserModel from "./UserModel.js";
import PortfolioSnapshot from "./PortfolioSnapshotModel.js";
import PortfolioAsset from "./PortfolioAssetModel.js";
import PortfolioAssetSnapshot from "./PortfolioAssetSnapshotModel.js";

let initialized = false;

export const setupAssociations = () => {
  if (initialized) return;
  initialized = true;

  UserModel.hasMany(WalletModel, { foreignKey: "user_id" });
  WalletModel.belongsTo(UserModel, { foreignKey: "user_id" });
  WalletModel.belongsToMany(TokenModel, { through: WalletTokenModel, foreignKey: "wallet_id" });
  TokenModel.belongsToMany(WalletModel, { through: WalletTokenModel, foreignKey: "token_id" });
  WalletModel.belongsToMany(ProtocolModel, { through: WalletProtocolModel, foreignKey: "wallet_id" });
  ProtocolModel.belongsToMany(WalletModel, { through: WalletProtocolModel, foreignKey: "protocol_id" });
  UserModel.hasMany(WalletTokenModel, { foreignKey: "user_id" });
  WalletTokenModel.belongsTo(UserModel, { foreignKey: "user_id" });
  UserModel.hasMany(WalletProtocolModel, { foreignKey: "user_id" });
  WalletProtocolModel.belongsTo(UserModel, { foreignKey: "user_id" });
  UserModel.hasMany(PortfolioSnapshot, { foreignKey: "user_id", as: "portfolioSnapshots" });
  PortfolioSnapshot.belongsTo(UserModel, { foreignKey: "user_id", as: "user" });
  UserModel.hasMany(PortfolioAsset, { foreignKey: "user_id", as: "portfolioAssets" });
  PortfolioAsset.belongsTo(UserModel, { foreignKey: "user_id", as: "user" });
  PortfolioSnapshot.hasMany(PortfolioAssetSnapshot, {
    foreignKey: "snapshot_id",
    as: "assets",
    onDelete: "CASCADE",
  });
  PortfolioAssetSnapshot.belongsTo(PortfolioSnapshot, {
    foreignKey: "snapshot_id",
    as: "snapshot",
  });
  PortfolioAsset.hasMany(PortfolioAssetSnapshot, {
    foreignKey: "asset_id",
    as: "snapshots",
    onDelete: "CASCADE",
  });
  PortfolioAssetSnapshot.belongsTo(PortfolioAsset, {
    foreignKey: "asset_id",
    as: "asset",
  });
};
