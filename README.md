# Dashboard

Multi-chain portfolio dashboard for tracking wallets, token balances, protocol positions, and transaction history across EVM, Solana, Cosmos, Sui, and Aptos.

## What It Does

- Aggregates token balances and protocol positions across supported chains
- Groups balances by wallet and chain with historical net worth tracking
- Supports wallet tagging, filtering, search, and hide-small-balance controls
- Syncs optional CEX and payment-provider transaction history
- Keeps private/manual static data outside of committed source
- Includes a separate ETH/USDG Pool Radar for timestamped Uniswap v2/v3/v4 LP fee and estimated APY tracking on Robinhood Chain

## Project Structure

- `frontend/`: React + TypeScript UI
- `backend/`: Express API, sync jobs, and persistence
- `backend/config/static-data.example.json`: template for private optional static data
- `docs/deployment.md`: deployment and Pi workflow notes

## Setup

```sh
git clone https://github.com/0xStoff/dashboard.git
cd dashboard
```

Install dependencies with your preferred workspace flow. If you already use the repo-level scripts, keep using those.

## Environment

Create:

- `backend/.env`
- `frontend/.env`

Backend example:

```env
RABBY_ACCESS_KEY=your_rabby_api_key
COINGECKO_API_KEY=your_coingecko_api_key
JWT_SECRET=replace_me
```

Pool Radar defaults to Robinhood Chain's public RPC and verified Uniswap deployment addresses. Override the `ROBINHOOD_*` and `POOL_RADAR_*` values shown in `.env.example` when using a dedicated RPC. Its background indexer stores pool keys and timestamped aggregate swap values in PostgreSQL; it does not store trader wallet addresses.

Optional transaction integrations:

```env
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
KRAKEN_API_KEY=your_kraken_api_key
KRAKEN_API_SECRET=your_kraken_api_secret
BEARER_TOKEN=your_gnosis_pay_token
RUBIC_BACKEND_URL=https://api.rubic.exchange
```

Frontend example:

```env
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_LOGO_BASE_URL=http://localhost:3000/logos/
```

## Private Static Data

Optional manual/static balances are loaded from a private file instead of source control.

1. Copy `backend/config/static-data.example.json` to `backend/config/static-data.private.json`
2. Add the real wallet addresses and manual values there
3. Keep that private file out of git

If the file is missing, the app still runs and simply skips the optional static bootstrap syncs.

## Database

Before initializing the database, update any local bootstrap SQL or seed data to match the wallets you want to track.

Example database creation:

```sh
psql -U stoff -d template1 -c "CREATE DATABASE crypto_dashboard;"
```

## Running Locally

Use your existing repo scripts or run the frontend and backend separately from their package directories.

Default local URLs:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:8080`
