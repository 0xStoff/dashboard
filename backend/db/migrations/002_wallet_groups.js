export const migrateWalletGroups = async ({ sequelize, transaction }) => {
  await sequelize.query(`
    ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS group_name VARCHAR(80)
  `, { transaction });
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS wallets_user_group_name_idx
    ON wallets (user_id, group_name)
  `, { transaction });
  return { walletGroupsAdded: true };
};
