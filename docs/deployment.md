# Deployment Notes

## Runtime config

- Public runtime values belong in `.env` and Docker Compose.
- Private static wallet/bootstrap data is intentionally excluded from git.
- Copy `backend/config/static-data.example.json` to `backend/config/static-data.private.json` on the deployment host and fill in the real values.
- If you need non-standard Cosmos address mappings such as `INJ` or `DYM`, add them under `cosmosAddressOverrides` in the private static data file on a per-wallet basis.
- If that file is missing, the backend skips Aptos, Sui, and manual static-chain bootstrap syncs instead of crashing.

## Deploy flow

For the deployed checkout:

```sh
git pull --ff-only origin main
docker compose up -d --build backend frontend
```

If only the bind-mounted source changed and the images are already current:

```sh
docker compose restart backend frontend
```

## Database lifecycle

The backend runs pending versioned migrations during startup. Before deploying a database change, create a compressed backup outside the checkout:

```sh
mkdir -p /mnt/ssd_nvme/backups/dashboard
docker exec dashboard-postgres pg_dump -U stoff -d crypto_dashboard -Fc \
  > /mnt/ssd_nvme/backups/dashboard/crypto_dashboard-$(date +%Y%m%d-%H%M%S).dump
```

After the portfolio-history migration has been verified, the legacy JSON table can be removed once:

```sh
docker exec -e CONFIRM_DROP_LEGACY_HISTORY=yes dashboard-backend yarn db:compact-history
```

The compaction command refuses to remove the old table unless every legacy day and at least one asset point were migrated. Existing backups are not deleted automatically.

For database access from a workstation, use an SSH tunnel. PostgreSQL is published only on the Pi's loopback interface (`127.0.0.1:5432`) and is not exposed publicly.
