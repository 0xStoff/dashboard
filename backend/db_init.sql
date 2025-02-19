CREATE TABLE wallets
(
    id     SERIAL PRIMARY KEY,
    wallet VARCHAR(255) NOT NULL UNIQUE,
    tag    VARCHAR(100),
    chain  VARCHAR(10)
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

CREATE TABLE wallets_protocols
(
    id          SERIAL PRIMARY KEY,
    wallet_id   INT REFERENCES wallets (id) ON DELETE CASCADE,
    protocol_id INT REFERENCES protocols (id) ON DELETE CASCADE,
    portfolio_item_list JSON,
    UNIQUE (wallet_id, protocol_id)
);



CREATE TABLE net_worth (
                           id         SERIAL PRIMARY KEY,
                           date       DATE NOT NULL,
                           total_usd  DECIMAL(20, 8) NOT NULL,
                           UNIQUE (date)
);

