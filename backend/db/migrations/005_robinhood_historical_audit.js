// Historical audit ledgers deliberately live outside `wallets`.  They are a
// one-time evidence bundle for retired GMGN test wallets, not live portfolio
// inventory and not a refresh target.  A completed raw ledger is immutable at
// the database layer so a later retry cannot silently rewrite the audit trail.
export const migrateRobinhoodHistoricalAudit = async ({ sequelize, transaction }) => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS robinhood_historical_audit_ledgers (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      address VARCHAR(42) NOT NULL,
      source VARCHAR(80) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'fetching', 'complete', 'failed')),
      fetched_at TIMESTAMPTZ NULL,
      raw_ledger JSONB NULL,
      last_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT robinhood_historical_audit_ledgers_user_address_unique UNIQUE (user_id, address)
    )
  `, { transaction });

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS robinhood_historical_audit_ledgers_user_status_idx
    ON robinhood_historical_audit_ledgers (user_id, status)
  `, { transaction });

  await sequelize.query(`
    CREATE OR REPLACE FUNCTION prevent_robinhood_historical_ledger_rewrite()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.raw_ledger IS NOT NULL AND NEW.raw_ledger IS DISTINCT FROM OLD.raw_ledger THEN
        RAISE EXCEPTION 'Completed Robinhood historical audit ledgers are immutable';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `, { transaction });

  await sequelize.query(`
    DROP TRIGGER IF EXISTS robinhood_historical_audit_immutable_ledger
    ON robinhood_historical_audit_ledgers
  `, { transaction });
  await sequelize.query(`
    CREATE TRIGGER robinhood_historical_audit_immutable_ledger
    BEFORE UPDATE ON robinhood_historical_audit_ledgers
    FOR EACH ROW EXECUTE FUNCTION prevent_robinhood_historical_ledger_rewrite()
  `, { transaction });

  return { robinhoodHistoricalAuditReady: true };
};
