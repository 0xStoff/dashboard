BEGIN;

CREATE TABLE portfolio_v2.legacy_import_batches (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  source_deployment TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_snapshot_sha256 TEXT NOT NULL CHECK (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_server_version TEXT NOT NULL,
  source_commit TEXT,
  importer_version TEXT NOT NULL,
  config_sha256 TEXT NOT NULL CHECK (config_sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  source_record_count INTEGER NOT NULL DEFAULT 0 CHECK (source_record_count >= 0),
  imported_record_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_record_count >= 0),
  quarantined_record_count INTEGER NOT NULL DEFAULT 0 CHECK (quarantined_record_count >= 0),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (source_deployment, source_database, source_snapshot_sha256, importer_version, config_sha256)
);
CREATE INDEX legacy_import_batches_account_idx
  ON portfolio_v2.legacy_import_batches(account_id, started_at DESC);

CREATE TABLE portfolio_v2.legacy_import_records (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  source_table TEXT NOT NULL,
  source_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, source_table, source_key),
  UNIQUE (import_batch_id, source_table, source_key, content_sha256)
);
CREATE INDEX legacy_import_records_account_table_idx
  ON portfolio_v2.legacy_import_records(account_id, source_table, source_key);

CREATE TABLE portfolio_v2.legacy_import_refs (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  source_table TEXT NOT NULL,
  source_key TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  mapping_status TEXT NOT NULL CHECK (mapping_status IN ('normalized', 'candidate', 'quarantined')),
  mapping_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, source_table, source_key, target_table, target_id)
);
CREATE INDEX legacy_import_refs_target_idx
  ON portfolio_v2.legacy_import_refs(account_id, target_table, target_id);

CREATE TABLE portfolio_v2.legacy_mapping_quarantine (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  legacy_record_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_records(id),
  entity_kind TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  safe_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review', 'resolved', 'rejected')),
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (import_batch_id, legacy_record_id, entity_kind, reason_code)
);
CREATE INDEX legacy_mapping_quarantine_open_idx
  ON portfolio_v2.legacy_mapping_quarantine(account_id, entity_kind, status)
  WHERE status = 'needs_review';

CREATE TABLE portfolio_v2.legacy_balance_candidates (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  legacy_record_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_records(id),
  wallet_id UUID REFERENCES portfolio_v2.wallets(id),
  legacy_wallet_key TEXT NOT NULL,
  legacy_token_key TEXT NOT NULL,
  amount NUMERIC(100,30) NOT NULL,
  raw_amount NUMERIC(100,0) NOT NULL,
  source_usd_value NUMERIC(48,18) NOT NULL,
  observed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'mapped', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, legacy_record_id)
);

CREATE TABLE portfolio_v2.legacy_protocol_candidates (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  legacy_record_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_records(id),
  wallet_id UUID REFERENCES portfolio_v2.wallets(id),
  legacy_wallet_key TEXT NOT NULL,
  legacy_protocol_key TEXT NOT NULL,
  opaque_position JSONB,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'mapped', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, legacy_record_id)
);

CREATE TABLE portfolio_v2.legacy_transaction_candidates (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  legacy_record_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_records(id),
  source_namespace TEXT NOT NULL,
  source_key TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  excluded_from_totals BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'unclassified' CHECK (status IN ('unclassified', 'classified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, legacy_record_id)
);

CREATE TABLE portfolio_v2.legacy_unverified_snapshots (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  import_batch_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_batches(id),
  legacy_record_id UUID NOT NULL REFERENCES portfolio_v2.legacy_import_records(id),
  as_of TIMESTAMPTZ NOT NULL,
  source_currency TEXT NOT NULL,
  source_total_value NUMERIC(48,18) NOT NULL,
  source_history JSONB,
  verification_status TEXT NOT NULL DEFAULT 'legacy_unverified'
    CHECK (verification_status IN ('legacy_unverified', 'reconciled', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, legacy_record_id)
);
CREATE INDEX legacy_unverified_snapshots_account_time_idx
  ON portfolio_v2.legacy_unverified_snapshots(account_id, as_of DESC);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'legacy_import_batches', 'legacy_import_records', 'legacy_import_refs',
    'legacy_mapping_quarantine', 'legacy_balance_candidates',
    'legacy_protocol_candidates', 'legacy_transaction_candidates',
    'legacy_unverified_snapshots'
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

CREATE TRIGGER legacy_import_records_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.legacy_import_records
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER legacy_import_refs_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.legacy_import_refs
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER legacy_balance_candidates_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.legacy_balance_candidates
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER legacy_protocol_candidates_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.legacy_protocol_candidates
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER legacy_transaction_candidates_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.legacy_transaction_candidates
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

CREATE TRIGGER legacy_unverified_snapshots_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.legacy_unverified_snapshots
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

COMMIT;
