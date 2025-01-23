DROP TABLE coins_old, historical_prices, user_coins, wallets;

-- Create the coins table
CREATE TABLE coins
(
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)   NOT NULL,
    symbol        VARCHAR(10)    NOT NULL UNIQUE,
    logo_url      VARCHAR(255),
    current_price DECIMAL(10, 2) NOT NULL,
    CONSTRAINT price_non_negative CHECK (current_price >= 0)
);

-- Create the historical_prices table with partitioning
CREATE TABLE historical_prices
(
    id      SERIAL PRIMARY KEY,
    coin_id INT REFERENCES coins_old (id) ON DELETE CASCADE,
    date    DATE           NOT NULL,
    price   DECIMAL(10, 2) NOT NULL,
    UNIQUE (coin_id, date), -- Ensure no duplicate entries for the same date
    CONSTRAINT price_non_negative CHECK (price >= 0)
);

-- Create the users table
CREATE TABLE wallets
(
    id     SERIAL PRIMARY KEY,
    wallet VARCHAR(255) NOT NULL UNIQUE,
    tag    VARCHAR(100),
    chain  VARCHAR(10)
);

-- Create the user_coins table to manage user holdings
CREATE TABLE user_coins
(
    user_id INT REFERENCES wallets (id) ON DELETE CASCADE,
    coin_id INT REFERENCES coins_old (id) ON DELETE CASCADE,
    amount  DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (user_id, coin_id),
    CONSTRAINT amount_non_negative CHECK (amount >= 0)
);

-- Insert sample coins
INSERT INTO coins_old (name, symbol, logo_url, current_price)
VALUES ('Solana', 'SOL', 'https://example.com/solana-logo.png', 20.5),
       ('Bitcoin', 'BTC', 'https://example.com/bitcoin-logo.png', 30000);

-- Insert sample historical prices for Solana
INSERT INTO historical_prices (coin_id, date, price)
VALUES (1, '2023-01-01', 15.0),
       (1, '2023-01-02', 18.0);


-- Insert a sample user
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (4, '0x770353615119F0f701118d3A4eaf1FE57fA00F84', 'L 1.0', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (9, '0x6e04f6242703b9b29811fc5e2e5c2556db4c0c82', 'L 3.0', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (10, '0xec35d2720ce5b694d22db85c6dd9ed5c26d35483', 'L 3.25', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (7, '0x1a69fe2164b72803b2fd3d0c29628f56831a9524', 'L 2.0', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (6, '0xa8d58cd36835970af11be0ff1f9e2d66c79417cb', 'L 1.25', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (11, '0x07faf1a0117334517b8264542f7ea18f5acbb8ee', 'Purple', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (8, '0x5fc7557cf5442abda015b388be8bd379eed79f1e', 'L 2.25', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (12, '0x1127f90afc5530cff815d17ab14ceba9370481e0', 'Retro', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (2, '0xa25f8ac24164198aacb910dff36cc41d28f730cd', 'Ape', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (13, '0x9b5731b7983cd7a86a51e5831401c32db2c82c76', 'Red', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (3, '0x9c4da1823855d1a69dc73da74082336f8fdbdc96', 'MM', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (5, '0xc9d4d50f8c9e51ca4416aab42e612a886f0d52e8', 'L 1.1', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (1, '0x853a1A66d0D2b760154e9921176aBdB330b40a9e', 'Friend', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (14, '0xCB23eE7496193AEC8587B4fFE886B6AEAE265D75', 'Safe', 'evm');
INSERT INTO wallets (id, wallet, tag, chain)
VALUES (15, 'BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq', 'Sol', 'sol');


INSERT INTO wallets (id, wallet, tag, chain)
VALUES (23, 'DRbbCDmZKR6p8xwx2926iM6BuPnxTS7reV', 'Dogecoin', 'doge');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (24, '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2', 'Polkadot', 'dot');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (25, 'flow0x0', 'Flow', 'flow');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (26, '0x0266289d06695abf63A6a962F7671437086824F1C3C87b009e1eD3d89404Efef', 'Starknet', 'strk');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (27, '0x41eD1e75d836C5C974030432fDB222f30A274f90', 'BVM', 'bvm');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (28, 'magic0x770353615119F0f701118d3A4eaf1FE57fA00F84', 'MAGIC', 'magic');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (29, '0x0', 'KRAKEN', 'kraken');

INSERT INTO wallets (id, wallet, tag, chain)
VALUES (30, '0x0', 'NFT', 'nft');


-- Insert user coin holdings
INSERT INTO user_coins (user_id, coin_id, amount)
VALUES (1, 1, 5.0), -- User1 holds 5 SOL
       (1, 2, 0.1); -- User1 holds 0.1 BTC

CREATE TABLE coins
(
    id     VARCHAR(100) PRIMARY KEY,
    name   VARCHAR(100),
    symbol VARCHAR(20)
);

CREATE TABLE platforms
(
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50)
);

CREATE TABLE coin_platforms
(
    coin_id     VARCHAR(100) REFERENCES coins (id),
    platform_id INT REFERENCES platforms (id),
    PRIMARY KEY (coin_id, platform_id)
);



CREATE TABLE evm_chains
(
    id               SERIAL PRIMARY KEY,
    chain_id         VARCHAR(255) UNIQUE NOT NULL,
    name             VARCHAR(255)        NOT NULL,
    native_token_id  VARCHAR(255),
    wrapped_token_id VARCHAR(255),
    logo_path        VARCHAR(255)
);


CREATE TABLE non_evm_chains
(
    id        SERIAL PRIMARY KEY,
    chain_id  VARCHAR(255) UNIQUE NOT NULL,
    name      VARCHAR(255)        NOT NULL,
    symbol    VARCHAR(10)         NOT NULL,
    decimals  INT                 NOT NULL,
    endpoint  VARCHAR(255),
    logo_path VARCHAR(255)
);


CREATE TABLE tokens
(
    id               SERIAL PRIMARY KEY,
    chain_id         VARCHAR(255) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    symbol           VARCHAR(255)  NOT NULL,
    decimals         INT          NOT NULL,
    price            DECIMAL(20, 8),
    price_24h_change DECIMAL(20, 16),
    logo_path        VARCHAR(255),
    UNIQUE (chain_id, symbol)
);

CREATE TABLE protocols
(
    id               SERIAL PRIMARY KEY,
    chain_id         VARCHAR(255) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    logo_path        VARCHAR(255),
    total_usd        DECIMAL(20, 8) DEFAULT 0,
    UNIQUE (chain_id, name)
);

ALTER TABLE tokens
    MODIFY COLUMN price DECIMAL(30, 16);

ALTER TABLE tokens MODIFY COLUMN price_24h_change DECIMAL(20, 16);

CREATE TABLE wallets_tokens
(
    id         SERIAL PRIMARY KEY,
    wallet_id  INT REFERENCES wallets (id) ON DELETE CASCADE,
    token_id   INT REFERENCES tokens (id) ON DELETE CASCADE,
    amount     DECIMAL(20, 8),
    raw_amount DECIMAL(40, 0),
    usd_value     DECIMAL(20, 8),
    UNIQUE (wallet_id, token_id)
);

-- Drop old tables if they exist
DROP TABLE IF EXISTS coins_old, historical_prices, user_coins, wallets_tokens, wallets, protocols;

-- Drop the old table with protocol_id directly in wallets
DROP TABLE IF EXISTS wallets_protocols;

-- Create the wallets_protocols table for many-to-many relationships
CREATE TABLE wallets_protocols
(
    id          SERIAL PRIMARY KEY,
    wallet_id   INT REFERENCES wallets (id) ON DELETE CASCADE,
    protocol_id INT REFERENCES protocols (id) ON DELETE CASCADE,
    portfolio_item_list JSON,
    UNIQUE (wallet_id, protocol_id)
);

-- Create the protocols table
CREATE TABLE protocols
(
    id               SERIAL PRIMARY KEY,
    chain_id         VARCHAR(255) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    logo_path        VARCHAR(255),
    total_usd        DECIMAL(20, 8) DEFAULT 0,
    portfolio_item_list JSON, -- New column to store portfolio item list
    UNIQUE (chain_id, name)
);
-- Create the wallets table with a foreign key to protocols
CREATE TABLE wallets
(
    id           SERIAL PRIMARY KEY,
    wallet       VARCHAR(255) NOT NULL UNIQUE,
    tag          VARCHAR(100),
    chain        VARCHAR(10) NOT NULL,
    protocol_id  INT REFERENCES protocols (id) ON DELETE SET NULL
);

-- Create the coins table
CREATE TABLE coins
(
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)   NOT NULL,
    symbol        VARCHAR(10)    NOT NULL UNIQUE,
    logo_url      VARCHAR(255),
    current_price DECIMAL(10, 2) NOT NULL,
    CONSTRAINT price_non_negative CHECK (current_price >= 0)
);

-- Create the historical_prices table with partitioning
CREATE TABLE historical_prices
(
    id      SERIAL PRIMARY KEY,
    coin_id INT REFERENCES coins (id) ON DELETE CASCADE,
    date    DATE           NOT NULL,
    price   DECIMAL(10, 2) NOT NULL,
    UNIQUE (coin_id, date), -- Ensure no duplicate entries for the same date
    CONSTRAINT price_non_negative CHECK (price >= 0)
);

-- Create the wallets_tokens table to map wallets and tokens
CREATE TABLE wallets_tokens
(
    id         SERIAL PRIMARY KEY,
    wallet_id  INT REFERENCES wallets (id) ON DELETE CASCADE,
    token_id   INT REFERENCES coins (id) ON DELETE CASCADE,
    amount     DECIMAL(20, 8),
    raw_amount DECIMAL(40, 0),
    usd_value  DECIMAL(20, 8),
    UNIQUE (wallet_id, token_id)
);

-- Insert sample data into protocols
INSERT INTO protocols (chain_id, name, logo_path, total_usd)
VALUES ('evm', 'Uniswap', 'https://example.com/uniswap-logo.png', 1000000.00),
       ('evm', 'Aave', 'https://example.com/aave-logo.png', 750000.00),
       ('sol', 'Serum', 'https://example.com/serum-logo.png', 500000.00);

-- Insert sample data into wallets
INSERT INTO wallets (id, wallet, tag, chain, protocol_id)
VALUES (1, '0x123...', 'L 1.0', 'evm', 1), -- Associated with Uniswap
       (2, '0x456...', 'L 2.0', 'evm', 2), -- Associated with Aave
       (3, '0x789...', 'Serum User', 'sol', 3); -- Associated with Serum

-- Insert sample data into coins
INSERT INTO coins (name, symbol, logo_url, current_price)
VALUES ('Solana', 'SOL', 'https://example.com/solana-logo.png', 20.5),
       ('Bitcoin', 'BTC', 'https://example.com/bitcoin-logo.png', 30000.00),
       ('Ethereum', 'ETH', 'https://example.com/ethereum-logo.png', 2000.00);

-- Insert sample historical prices for Solana
INSERT INTO historical_prices (coin_id, date, price)
VALUES (1, '2023-01-01', 15.0),
       (1, '2023-01-02', 18.0);

-- Insert wallet-token mappings (wallets_tokens)
INSERT INTO wallets_tokens (wallet_id, token_id, amount, raw_amount, usd_value)
VALUES (1, 1, 5.0, 500000000, 102.5),  -- 5 SOL for wallet 1
       (2, 2, 0.1, 10000000, 3000.0); -- 0.1 BTC for wallet 2