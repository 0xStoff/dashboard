import type React from "react";

export interface TokenWallet {
  id: number;
  tag: string;
  wallet: string;
  amount: number;
}

export interface Wallet {
  id: number;
  wallet: string;
  tag: string;
  chain: string;
  show_chip?: boolean;
}

export interface Token {
  chain_id: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_path: string;
  price: number;
  price_24h_change: number | null;
  amount: number;
  wallets: TokenWallet[];
  total_usd_value: number;
}

export interface ProtocolWallet {
  tag: string;
  amount: number;
}

export interface Position {
  type: string;
  chain: string;
  tokenNames: string;
  logoUrls: string[];
  price: number;
  amount: number;
  usdValue: number;
  wallets: ProtocolWallet[];
}

export interface Protocol {
  name: string;
  positions: Position[];
  totalUSD: number;
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

export interface NetWorthData {
  date: string;
  totalNetWorth: number;
  tokenHistory: Token[];
  protocolHistory: Protocol[];
}

export interface HistoryData {
  wallets: Wallet[];
  chains: Chain[];
  tokens: Token[];
  protocolsTable: Protocol[];
  totalProtocolUSD: number;
  totalTokenUSD: number;
}

export interface DashboardSelection {
  id: string;
  tag: string;
  chains: {
    total_usd_value: number;
    chain_list: Chain[];
  };
  tokens: Token[];
  protocolsTable: Protocol[];
}

export interface WalletContextValue {
  wallets: Wallet[];
  loading: boolean;
  fetchWallets: () => Promise<void>;
  setWallets: React.Dispatch<React.SetStateAction<Wallet[]>>;
}
