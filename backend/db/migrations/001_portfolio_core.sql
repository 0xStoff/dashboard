CREATE SCHEMA IF NOT EXISTS portfolio_core;

CREATE TABLE portfolio_core.accounts (
    id UUID PRIMARY KEY,
    legacy_user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    reporting_currency TEXT NOT NULL DEFAULT 'CHF' CHECK (reporting_currency ~ '^[A-Z][A-Z0-9]{2,11}$'),
    reporting_timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_core.chain_identities (
    id UUID PRIMARY KEY,
    namespace TEXT NOT NULL CHECK (namespace IN ('eip155', 'solana', 'cosmos', 'sui', 'aptos', 'bip122', 'exchange', 'other')),
    reference TEXT NOT NULL CHECK (btrim(reference) <> ''),
    display_name TEXT NOT NULL CHECK (btrim(display_name) <> ''),
    native_asset_reference TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'unverified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (namespace, reference)
);

CREATE TABLE portfolio_core.wallet_identities (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES portfolio_core.accounts(id) ON DELETE RESTRICT,
    chain_id UUID NOT NULL REFERENCES portfolio_core.chain_identities(id) ON DELETE RESTRICT,
    legacy_wallet_id INTEGER UNIQUE REFERENCES wallets(id) ON DELETE RESTRICT,
    normalized_address TEXT NOT NULL CHECK (btrim(normalized_address) <> ''),
    display_address TEXT NOT NULL CHECK (btrim(display_address) <> ''),
    label TEXT,
    wallet_kind TEXT NOT NULL DEFAULT 'self_custody' CHECK (wallet_kind IN ('self_custody', 'exchange', 'protocol', 'other')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'unverified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, chain_id, normalized_address)
);
CREATE INDEX wallet_identities_account_idx ON portfolio_core.wallet_identities(account_id);

CREATE TABLE portfolio_core.asset_identities (
    id UUID PRIMARY KEY,
    chain_id UUID NOT NULL REFERENCES portfolio_core.chain_identities(id) ON DELETE RESTRICT,
    legacy_token_id INTEGER UNIQUE REFERENCES tokens(id) ON DELETE RESTRICT,
    asset_namespace TEXT NOT NULL CHECK (asset_namespace IN ('native', 'erc20', 'erc721', 'erc1155', 'spl', 'denom', 'coin_type', 'exchange', 'other')),
    asset_reference TEXT NOT NULL CHECK (btrim(asset_reference) <> ''),
    symbol TEXT,
    name TEXT,
    decimals INTEGER CHECK (decimals BETWEEN 0 AND 255),
    status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('active', 'unverified', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chain_id, asset_namespace, asset_reference)
);
CREATE INDEX asset_identities_chain_idx ON portfolio_core.asset_identities(chain_id);

CREATE TABLE portfolio_core.provider_connections (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES portfolio_core.accounts(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL CHECK (btrim(provider) <> ''),
    label TEXT NOT NULL CHECK (btrim(label) <> ''),
    encrypted_credential_envelope TEXT,
    credential_key_version TEXT,
    daily_credit_budget NUMERIC(30,6) CHECK (daily_credit_budget IS NULL OR daily_credit_budget >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, provider, label)
);

CREATE TABLE portfolio_core.sync_runs (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES portfolio_core.accounts(id) ON DELETE RESTRICT,
    provider_connection_id UUID REFERENCES portfolio_core.provider_connections(id) ON DELETE RESTRICT,
    wallet_id UUID REFERENCES portfolio_core.wallet_identities(id) ON DELETE RESTRICT,
    chain_id UUID REFERENCES portfolio_core.chain_identities(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    capability TEXT NOT NULL CHECK (capability IN ('balances', 'positions', 'transactions', 'prices', 'metadata')),
    adapter_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed', 'cancelled')),
    request_fingerprint TEXT,
    cursor_before JSONB,
    cursor_after JSONB,
    accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
    rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
    provider_credits NUMERIC(30,6) CHECK (provider_credits IS NULL OR provider_credits >= 0),
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    error JSONB,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (status = 'running' AND completed_at IS NULL)
        OR (status <> 'running' AND completed_at IS NOT NULL)
    )
);
CREATE INDEX sync_runs_account_started_idx ON portfolio_core.sync_runs(account_id, started_at DESC);
CREATE INDEX sync_runs_provider_started_idx ON portfolio_core.sync_runs(provider, started_at DESC);

CREATE TABLE portfolio_core.raw_observations (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES portfolio_core.accounts(id) ON DELETE RESTRICT,
    sync_run_id UUID NOT NULL REFERENCES portfolio_core.sync_runs(id) ON DELETE RESTRICT,
    wallet_id UUID REFERENCES portfolio_core.wallet_identities(id) ON DELETE RESTRICT,
    chain_id UUID REFERENCES portfolio_core.chain_identities(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    capability TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    source_key TEXT,
    request_fingerprint TEXT NOT NULL,
    content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    payload JSONB,
    archive_locator TEXT,
    schema_version TEXT NOT NULL,
    observed_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (payload IS NOT NULL OR archive_locator IS NOT NULL),
    UNIQUE (account_id, provider, capability, request_fingerprint, content_sha256)
);
CREATE INDEX raw_observations_account_received_idx ON portfolio_core.raw_observations(account_id, received_at DESC);

CREATE TABLE portfolio_core.prices (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES portfolio_core.asset_identities(id) ON DELETE RESTRICT,
    quote_currency TEXT NOT NULL CHECK (quote_currency ~ '^[A-Z][A-Z0-9]{2,11}$'),
    price NUMERIC(60,30) NOT NULL CHECK (price >= 0),
    provider TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('observed', 'manual', 'interpolated', 'carried')),
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
    observed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_id, quote_currency, provider, observed_at)
);
CREATE INDEX prices_asset_time_idx ON portfolio_core.prices(asset_id, quote_currency, observed_at DESC);

CREATE TABLE portfolio_core.manual_adjustments (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES portfolio_core.accounts(id) ON DELETE RESTRICT,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('classification', 'quantity', 'value', 'cost_basis', 'exclusion', 'other')),
    target_type TEXT NOT NULL,
    target_reference TEXT NOT NULL,
    before_value JSONB,
    after_value JSONB NOT NULL,
    reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
    evidence JSONB,
    created_by_legacy_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX manual_adjustments_account_idx ON portfolio_core.manual_adjustments(account_id, created_at DESC);

CREATE TABLE portfolio_core.audit_log (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES portfolio_core.accounts(id) ON DELETE RESTRICT,
    actor_legacy_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    actor_kind TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_reference TEXT,
    safe_diff JSONB,
    reason TEXT,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_account_created_idx ON portfolio_core.audit_log(account_id, created_at DESC);

CREATE OR REPLACE FUNCTION portfolio_core.reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER raw_observations_append_only
BEFORE UPDATE OR DELETE ON portfolio_core.raw_observations
FOR EACH ROW EXECUTE FUNCTION portfolio_core.reject_mutation();

CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON portfolio_core.audit_log
FOR EACH ROW EXECUTE FUNCTION portfolio_core.reject_mutation();
