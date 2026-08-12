// Refresh policy is intentionally independent from wallet tags/groups. A group
// is for organisation; policy controls paid/provider work. Existing GMGN lab
// wallets become audit-only rather than being deleted, preserving history and
// allowing an explicit one-time refresh when needed.
export const migrateWalletRefreshPolicy = async ({ sequelize, transaction }) => {
  await sequelize.query(`
    ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS refresh_policy VARCHAR(24) NOT NULL DEFAULT 'auto'
  `, { transaction });
  await sequelize.query(`
    UPDATE wallets
    SET refresh_policy = 'audit-only'
    WHERE refresh_policy = 'auto'
      AND LOWER(TRIM(COALESCE(group_name, ''))) = 'gmgn lab'
  `, { transaction });
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS wallets_user_refresh_policy_idx
    ON wallets (user_id, refresh_policy)
  `, { transaction });
  return { walletRefreshPolicyAdded: true };
};
