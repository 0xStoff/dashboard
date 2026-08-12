import type React from "react";

export interface TokenWallet {
  id: number;
  tag: string;
  wallet: string;
  amount: number;
  usd_value?: number;
}

export interface ValuationMeta {
  amountUsd: number;
  pricingMethod: "direct" | "pool-implied" | "unavailable";
  confidence: "direct" | "estimated" | "unavailable";
  source: string;
}

export interface Wallet {
  id: number;
  wallet: string;
  tag: string;
  chain: string;
  show_chip?: boolean;
  approximate_usd_value?: number;
  group_name?: string | null;
  refresh_policy?: "auto" | "manual" | "audit-only";
  valuation?: {
    source: string;
    captured_at: string;
    token_usd_value: number;
    protocol_usd_value: number;
    estimated_usd_value: number;
    unpriced_asset_count: number;
    pricing_methods: string[];
  };
}

export interface WalletFormValues {
  tag: string;
  wallet: string;
  chain: string;
  show_chip: boolean;
  group_name: string;
  refresh_policy?: "auto" | "manual" | "audit-only";
}

export interface Token {
  chain_id: string;
  name: string;
  symbol: string;
  contract_address?: string | null;
  contract_addresses?: string[];
  decimals: number;
  logo_path: string;
  price: number;
  price_24h_change: number | null;
  amount: number;
  wallets: TokenWallet[];
  total_usd_value: number;
  valuation?: ValuationMeta;
}

export interface ProtocolWallet {
  id: number | null;
  tag: string;
  amount: number;
  usdValue: number;
}

export interface Position {
  type: string;
  chain: string;
  tokenNames: string;
  tokenSymbols?: string;
  contractAddresses?: string[];
  assetAmounts?: Array<{
    contract?: string | null;
    symbol: string;
    name: string;
    amount: number;
    price?: number;
    usdValue?: number;
    pricingMethod?: string;
  }>;
  logoUrls: string[];
  price: number;
  amount: number;
  usdValue: number;
  tokenCount?: number;
  valuation?: {
    method: string;
    confidence: string;
    source: string;
    inferredAssetPrices?: Array<{ contract: string; priceUsd: number; amount: number }>;
  };
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

export interface PortfolioSnapshot {
  schemaVersion: number;
  snapshotId: string;
  capturedAt: string;
  filters: { chain: string; walletId: string; searchQuery: string };
  totals: { tokenUsd: number; protocolUsd: number; totalUsd: number };
  chains: Chain[];
  assets: Token[];
  protocols: Protocol[];
  walletSummaries: Array<{
    walletId: number;
    tokenUsd: number;
    protocolUsd: number;
    totalUsd: number;
    estimatedUsd: number;
    unpricedAssetCount: number;
    pricingMethods: string[];
  }>;
  dataHealth: {
    source: string;
    totalMatchesChainSummary: boolean;
    estimatedAssetCount: number;
    fuelPrice: { priceUsd: number; source: string; confidence: string } | null;
    warnings: string[];
  };
}

export interface NetWorthData {
  date: string;
  totalNetWorth: number;
  totalTokenUSD: number;
  totalProtocolUSD: number;
}

export interface AssetHistoryData {
  date: string;
  balance: number | null;
  usdValue: number;
}

export interface AssetMarketHistoryPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  price: number | null;
  volumeUsd: number | null;
}

export interface AssetMarketHistoryResponse {
  supported: boolean;
  reason?: string | null;
  currentPrice: number | null;
  priceChange24h?: number | null;
  pairAddress: string | null;
  pairName: string | null;
  provider: string;
  marketTokenAddress: string | null;
  points: AssetMarketHistoryPoint[];
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

export interface TransactionRecord {
  orderNo: string | null;
  exchange: string;
  type: string;
  amount: number;
  fee: number;
  asset: string;
  status: string;
  date: string;
  merchant?: string | null;
  transactionAmount?: number | string | null;
  timestamp: string | number;
  chf_value: number;
  excludedFromTotals: boolean;
}

export interface GnosisTransactionRecord {
  orderNo: string | null;
  exchange: string;
  type: string;
  amount: number | string | null;
  fee: number | string | null;
  asset: string | null;
  status: string;
  date: string;
  merchant: string | null;
  transactionAmount: number | string | null;
  billingAmount: number | string | null;
  excludedFromTotals: boolean;
}

export interface FormattedGnosisTransaction {
  orderNo: string | null;
  createdAt: string;
  transactionAmountFormatted: string;
  billingAmountFormatted: string;
  merchantFormatted: string;
  status: string;
  excludedFromTotals: boolean;
}

export interface TableColumn<T> {
  label: string;
  key: keyof T;
}
