-- Create the coins table
CREATE TABLE coins
(
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)   NOT NULL,
    symbol        VARCHAR(10)    NOT NULL UNIQUE,
    logo_url      VARCHAR(255),
    current_price DECIMAL(10, 2) NOT NULL
);

-- Create the historical_prices table
CREATE TABLE historical_prices
(
    id      SERIAL PRIMARY KEY,
    coin_id INT REFERENCES coins (id) ON DELETE CASCADE,
    date    DATE           NOT NULL,
    price   DECIMAL(10, 2) NOT NULL,
    UNIQUE (coin_id, date) -- Ensure no duplicate entries for the same date
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
    user_id INT REFERENCES users (id) ON DELETE CASCADE,
    coin_id INT REFERENCES coins (id) ON DELETE CASCADE,
    amount  DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (user_id, coin_id)
);


-- Insert sample coins
INSERT INTO coins (name, symbol, logo_url, current_price)
VALUES ('Solana', 'SOL', 'https://example.com/solana-logo.png', 20.5),
       ('Bitcoin', 'BTC', 'https://example.com/bitcoin-logo.png', 30000);

-- Insert sample historical prices for Solana
INSERT INTO historical_prices (coin_id, date, price)
VALUES (1, '2023-01-01', 15.0),
       (1, '2023-01-02', 18.0);

-- Insert a sample user
INSERT INTO users (wallet, tag)
VALUES ('0x1234567890abcdef', 'User1');

-- Insert user coin holdings
INSERT INTO user_coins (user_id, coin_id, amount)
VALUES (1, 1, 5.0), -- User1 holds 5 SOL
       (1, 2, 0.1); -- User1 holds 0.1 BTC