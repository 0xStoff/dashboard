# Database migrations

These migrations are additive and target only the `portfolio_v2` schema. They
must first run against an empty disposable database and a restored production-like
snapshot. Applying them to the production checkout or Raspberry Pi is outside the
scope of this branch.

The application role must not own these objects and must not have `BYPASSRLS`.
Set `app.account_id` locally inside every account-scoped transaction.
