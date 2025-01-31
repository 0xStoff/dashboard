export interface Token {
  chain_id: string
  name: string
  symbol: string
  decimals: number
  logo_path: string
  price: number
  price_24h_change: string
  amount: number
  wallets: Wallet[]
  total_usd_value: number
}

export interface Wallet {
  id: number;
  wallet: string;
  tag: string;
  chain: string;
}


export interface NetWorthData {
  date: string;
  totalNetWorth: number;
}

export interface HistoryData {
  wallets: Wallet[];
  chains: Chain[];
  tokens: Token[];
  protocolsTable: Protocol[];
  totalProtocolUSD: string | number;
  totalTokenUSD: string | number;
}



export interface Protocol {
  name: string;
  positions: Position[];
  totalUSD: number;
}

export interface Position {
  type: string;
  chain: string;
  tokenNames: string;
  logoUrls: string[];
  price: number;
  amount: number;
  usdValue: number;
  wallets: Wallet[];
}


export interface Chain {
  id: number;
  chain_id: string;
  name: string;
  native_token_id: string;
  wrapped_token_id: string;
  logo_path: string;
  type: string;
  usd_value: number;
  token_usd_value: number;
  protocol_usd_value: number;
}
