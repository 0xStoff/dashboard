BEGIN;

CREATE TABLE portfolio_v2.portfolio_refresh_snapshots (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES portfolio_v2.accounts(id),
  job_id UUID NOT NULL UNIQUE REFERENCES portfolio_v2.sync_jobs(id),
  sync_run_id UUID NOT NULL REFERENCES portfolio_v2.sync_runs(id),
  as_of TIMESTAMPTZ NOT NULL,
  reporting_currency TEXT NOT NULL DEFAULT 'USD',
  total_value NUMERIC(48,18) NOT NULL,
  snapshot JSONB NOT NULL,
  source_status JSONB NOT NULL,
  completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'partial')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_refresh_snapshots_latest_idx
  ON portfolio_v2.portfolio_refresh_snapshots(account_id, as_of DESC);

CREATE TRIGGER portfolio_refresh_snapshots_append_only
BEFORE UPDATE OR DELETE ON portfolio_v2.portfolio_refresh_snapshots
FOR EACH ROW EXECUTE FUNCTION portfolio_v2.reject_mutation();

ALTER TABLE portfolio_v2.portfolio_refresh_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_v2.portfolio_refresh_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY account_isolation ON portfolio_v2.portfolio_refresh_snapshots
  USING (account_id = nullif(current_setting('app.account_id', true), '')::uuid)
  WITH CHECK (account_id = nullif(current_setting('app.account_id', true), '')::uuid);

GRANT SELECT, INSERT ON portfolio_v2.portfolio_refresh_snapshots TO dashboard_runtime;

COMMIT;
