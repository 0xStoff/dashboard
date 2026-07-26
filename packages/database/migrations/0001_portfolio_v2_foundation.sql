BEGIN;

CREATE SCHEMA IF NOT EXISTS portfolio_v2;

CREATE TABLE portfolio_v2.accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  reporting_currency TEXT NOT NULL CHECK (reporting_currency ~ '^[A-Z][A-Z0-9]{2,11}$'),
  reporting_timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_v2.users (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_v2.account_memberships (
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  user_id UUID NOT NULL REFERENCES portfolio_v2.users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);
CREATE INDEX account_memberships_user_idx ON portfolio_v2.account_memberships(user_id);

CREATE TABLE portfolio_v2.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES portfolio_v2.users(id),
  current_account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_active_idx ON portfolio_v2.sessions(token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE portfolio_v2.auth_challenges (
  id UUID PRIMARY KEY,
  intended_account_id UUID REFERENCES portfolio_v2.accounts(id),
  normalized_address TEXT NOT NULL,
  domain TEXT NOT NULL,
  uri TEXT NOT NULL,
  chain_reference TEXT NOT NULL,
  nonce_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CHECK (expires_at > issued_at)
);
CREATE INDEX auth_challenges_active_idx ON portfolio_v2.auth_challenges(normalized_address, expires_at) WHERE consumed_at IS NULL;

CREATE TABLE portfolio_v2.chains (
  id UUID PRIMARY KEY,
  namespace TEXT NOT NULL,
  reference TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (namespace, reference)
);

CREATE TABLE portfolio_v2.wallets (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  chain_id UUID NOT NULL REFERENCES portfolio_v2.chains(id),
  normalized_address TEXT NOT NULL,
  address_display TEXT NOT NULL,
  wallet_kind TEXT NOT NULL CHECK (wallet_kind IN ('self_custody', 'exchange', 'protocol', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, chain_id, normalized_address)
);
CREATE INDEX wallets_account_idx ON portfolio_v2.wallets(account_id);

CREATE TABLE portfolio_v2.assets (
  id UUID PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES portfolio_v2.chains(id),
  asset_namespace TEXT NOT NULL,
  asset_reference TEXT NOT NULL,
  decimals INTEGER CHECK (decimals BETWEEN 0 AND 255),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unverified', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, asset_namespace, asset_reference)
);

CREATE TABLE portfolio_v2.provider_connections (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  encrypted_credential_envelope TEXT,
  credential_key_version TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'revoked')),
  daily_credit_budget BIGINT CHECK (daily_credit_budget IS NULL OR daily_credit_budget >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX provider_connections_account_idx ON portfolio_v2.provider_connections(account_id);

CREATE TABLE portfolio_v2.sync_jobs (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  provider_connection_id UUID NOT NULL REFERENCES portfolio_v2.provider_connections(id),
  wallet_id UUID REFERENCES portfolio_v2.wallets(id),
  chain_id UUID REFERENCES portfolio_v2.chains(id),
  capability TEXT NOT NULL CHECK (capability IN ('balances', 'transactions', 'prices')),
  request JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 100,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  cancelled_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'running') = (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE INDEX sync_jobs_claim_idx ON portfolio_v2.sync_jobs(status, scheduled_at, priority DESC);
CREATE INDEX sync_jobs_lease_idx ON portfolio_v2.sync_jobs(lease_expires_at) WHERE status = 'running';
CREATE INDEX sync_jobs_account_idx ON portfolio_v2.sync_jobs(account_id);
CREATE UNIQUE INDEX sync_jobs_active_idempotency_uidx
  ON portfolio_v2.sync_jobs(account_id, idempotency_key)
  WHERE status IN ('queued', 'running');

CREATE TABLE portfolio_v2.sync_runs (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  job_id UUID NOT NULL REFERENCES portfolio_v2.sync_jobs(id),
  provider_connection_id UUID NOT NULL REFERENCES portfolio_v2.provider_connections(id),
  wallet_id UUID REFERENCES portfolio_v2.wallets(id),
  chain_id UUID REFERENCES portfolio_v2.chains(id),
  provider TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  capability TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  accepted_observation_count INTEGER NOT NULL DEFAULT 0,
  rejected_observation_count INTEGER NOT NULL DEFAULT 0,
  provider_credits NUMERIC(30,6),
  freshness TEXT,
  reconciliation_status TEXT,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sync_runs_account_started_idx ON portfolio_v2.sync_runs(account_id, started_at DESC);

CREATE TABLE portfolio_v2.raw_observations (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  sync_run_id UUID NOT NULL REFERENCES portfolio_v2.sync_runs(id),
  provider_connection_id UUID NOT NULL REFERENCES portfolio_v2.provider_connections(id),
  wallet_id UUID REFERENCES portfolio_v2.wallets(id),
  chain_id UUID REFERENCES portfolio_v2.chains(id),
  capability TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  source_key TEXT,
  request_fingerprint TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  payload JSONB,
  archive_locator TEXT,
  schema_version TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ,
  effective_at TIMESTAMPTZ,
  page INTEGER,
  cursor_before JSONB,
  cursor_after JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payload IS NOT NULL OR archive_locator IS NOT NULL),
  UNIQUE (account_id, provider_connection_id, capability, request_fingerprint, content_sha256)
);
CREATE INDEX raw_observations_account_received_idx ON portfolio_v2.raw_observations(account_id, received_at DESC);

CREATE TABLE portfolio_v2.projection_versions (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  model_type TEXT NOT NULL,
  source_cut JSONB NOT NULL,
  projector_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'active', 'superseded', 'failed')),
  built_at TIMESTAMPTZ NOT NULL,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projection_versions_account_status_idx ON portfolio_v2.projection_versions(account_id, model_type, status);
CREATE UNIQUE INDEX projection_versions_one_active_uidx
  ON portfolio_v2.projection_versions(account_id, model_type)
  WHERE status = 'active';

CREATE TABLE portfolio_v2.portfolio_snapshots (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  projection_version_id UUID NOT NULL REFERENCES portfolio_v2.projection_versions(id),
  valuation_policy_version TEXT NOT NULL,
  reporting_policy_version TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  reporting_currency TEXT NOT NULL,
  net_worth NUMERIC(48,18),
  cost_basis NUMERIC(48,18),
  unrealized_pnl NUMERIC(48,18),
  completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'partial', 'unknown')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  unpriced_asset_count INTEGER NOT NULL DEFAULT 0 CHECK (unpriced_asset_count >= 0),
  unknown_event_count INTEGER NOT NULL DEFAULT 0 CHECK (unknown_event_count >= 0),
  calculation_id UUID NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, projection_version_id, valuation_policy_version, reporting_policy_version, as_of)
);
CREATE INDEX portfolio_snapshots_latest_idx ON portfolio_v2.portfolio_snapshots(account_id, as_of DESC);

CREATE TABLE portfolio_v2.calculation_explanations (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  metric TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  formula TEXT NOT NULL,
  reporting_currency TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  completeness TEXT NOT NULL,
  confidence TEXT NOT NULL,
  included_source_ids UUID[] NOT NULL DEFAULT '{}',
  excluded_record_ids UUID[] NOT NULL DEFAULT '{}',
  price_ids UUID[] NOT NULL DEFAULT '{}',
  adjustment_ids UUID[] NOT NULL DEFAULT '{}',
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX calculation_explanations_account_idx ON portfolio_v2.calculation_explanations(account_id, as_of DESC);

CREATE TABLE portfolio_v2.audit_log (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  actor_user_id UUID REFERENCES portfolio_v2.users(id),
  actor_kind TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  safe_diff JSONB,
  reason TEXT,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_account_created_idx ON portfolio_v2.audit_log(account_id, created_at DESC);

CREATE OR REPLACE FUNCTION portfolio_v2.authenticate_session(p_token_hash TEXT)
RETURNS TABLE(session_id UUID, user_id UUID, account_id UUID, role TEXT, reporting_currency TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portfolio_v2, pg_temp
AS $$
DECLARE
  selected_account_id UUID;
BEGIN
  SELECT s.current_account_id INTO selected_account_id
  FROM sessions AS s
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  LIMIT 1;

  IF selected_account_id IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.account_id', selected_account_id::text, true);

  RETURN QUERY
  SELECT s.id, s.user_id, s.current_account_id, membership.role, account.reporting_currency
  FROM sessions AS s
  JOIN account_memberships AS membership
    ON membership.user_id = s.user_id
   AND membership.account_id = s.current_account_id
  JOIN accounts AS account ON account.id = s.current_account_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND s.current_account_id = selected_account_id
    AND account.status = 'active'
  LIMIT 1;
END
$$;
REVOKE ALL ON FUNCTION portfolio_v2.authenticate_session(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION portfolio_v2.reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER raw_observations_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.raw_observations
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER portfolio_snapshots_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.portfolio_snapshots
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.audit_log
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'account_memberships', 'wallets', 'provider_connections', 'sync_jobs', 'sync_runs',
    'raw_observations', 'projection_versions', 'portfolio_snapshots',
    'calculation_explanations', 'audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE portfolio_v2.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE portfolio_v2.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY account_isolation ON portfolio_v2.%I USING (account_id = nullif(current_setting(''app.account_id'', true), '''')::uuid) WITH CHECK (account_id = nullif(current_setting(''app.account_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END;
$$;

COMMIT;
