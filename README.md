# Dashboard  
*Still in progress*  

A dashboard to **fetch and track token balances across different chains** (**EVM, Cosmos, Solana, Sui**).  
This makes it **more convenient to track different tokens** across multiple wallets.  

## **Features**
- ✅ **EVM chains** data from **Rabby**  
- ✅ **Solana & Cosmos** data from **PublicNode**  
- ✅ **Track multiple wallets**  
- ✅ **Add tags** to categorize wallets  
- ✅ **Filter by wallet and/or chain**  
- ✅ **Search functionality**  
- ✅ **Database storage** for wallet & token data  



<br><br><br>



# **Instructions**

### **Clone the Repository**
```sh
git clone https://github.com/0xStoff/dashboard.git
cd dashboard
````

Install Dependencies

    yarn setup

This will install dependencies for both backend and frontend.

<br>

### Environment Variables

You need two .env files:

	•	backend/.env
	•	frontend/.env

Backend .env Example

You will need an API Key from DeBank (Rabby): https://cloud.debank.com/en <br>
Coingecko API (demo works too): https://www.coingecko.com/en/api

    RABBY_ACCESS_KEY=your_rabby_api_key
    COINGECKO_API_KEY=your_coingecko_api_key

Optional: CEX Integration

If you want to use the Transaction Page (CEX integration), you’ll need:

    BINANCE_API_KEY=your_binance_api_key
    BINANCE_API_SECRET=your_binance_api_secret
    KRAKEN_API_KEY=your_kraken_api_key
    KRAKEN_API_SECRET=your_kraken_api_secret
    COOKIE="your_cookie_token"

🚨 Note: CEX integration is limited at the moment.

Frontend .env Example

    REACT_APP_API_BASE_URL="http://localhost:3000/api"
    REACT_APP_LOGO_BASE_URL="http://localhost:3000/logos/"

Private Static Data

Optional manual/static balances are now loaded from a private file instead of being committed in source.

1. Copy:

    backend/config/static-data.example.json

to:

    backend/config/static-data.private.json

2. Fill in the real wallet addresses and amounts there.

If that file is missing, the app still runs, but the optional static bootstrap syncs are skipped.

3. Database Setup

Step 1: Edit the db_init.sql File

Before running the database initialization, open backend/db_init.sql and add the necessary wallets.

Example:

    INSERT INTO wallets (wallet, tag, chain) VALUES
    ('ENTER_ADDRESS', 'TAG', 'CHAIN'),

supported chains are: evm, sol, cosmos, aptos, sui


Step 2: Run Database Initialization

	psql -U stoff -d template1 -c "CREATE DATABASE crypto_dashboard;"

    yarn db:init


4. Running the Project

Now you can run both the backend and frontend from the root using:

    yarn start


•	🖥️ Backend → http://localhost:3000 <br>
•	🌐 Frontend → http://localhost:8080
