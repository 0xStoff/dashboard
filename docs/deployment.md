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
