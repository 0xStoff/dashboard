export const migrateRobinhoodIncrementalIndex = async ({ sequelize, transaction }) => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS robinhood_index_states (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet_address VARCHAR(42) NOT NULL,
      resource VARCHAR(32) NOT NULL,
      scan_mode VARCHAR(16) NULL
        CHECK (scan_mode IS NULL OR scan_mode IN ('backfill', 'incremental')),
      status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'indexing', 'ready', 'failed')),
      next_page_params JSONB NULL,
      backfill_complete BOOLEAN NOT NULL DEFAULT FALSE,
      last_indexed_block BIGINT NOT NULL DEFAULT 0,
      last_indexed_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT robinhood_index_states_scope_unique
        UNIQUE (user_id, wallet_address, resource)
    )
  `, { transaction });

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS robinhood_index_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet_address VARCHAR(42) NOT NULL,
      resource VARCHAR(32) NOT NULL,
      event_key VARCHAR(512) NOT NULL,
      block_number BIGINT NULL,
      transaction_hash VARCHAR(80) NULL,
      event_timestamp TIMESTAMPTZ NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT robinhood_index_events_scope_key_unique
        UNIQUE (user_id, wallet_address, resource, event_key)
    )
  `, { transaction });

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS robinhood_index_events_wallet_resource_block_idx
    ON robinhood_index_events (user_id, wallet_address, resource, block_number DESC)
  `, { transaction });
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS robinhood_index_events_transaction_idx
    ON robinhood_index_events (user_id, transaction_hash)
  `, { transaction });

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS robinhood_index_accounts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet_address VARCHAR(42) NOT NULL,
      account JSONB NOT NULL DEFAULT '{}'::jsonb,
      token_balances JSONB NOT NULL DEFAULT '[]'::jsonb,
      indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT robinhood_index_accounts_scope_unique
        UNIQUE (user_id, wallet_address)
    )
  `, { transaction });

  return { robinhoodIncrementalIndexReady: true };
};
