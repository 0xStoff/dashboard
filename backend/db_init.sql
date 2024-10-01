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
CREATE TABLE users
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
    coin_id      VARCHAR(100) REFERENCES coins(id),
    platform_id  INT REFERENCES platforms(id),
    PRIMARY KEY (coin_id, platform_id)
);