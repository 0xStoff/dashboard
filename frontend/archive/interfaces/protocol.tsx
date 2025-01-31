

export type ProtocolList = Protocol[]

export interface Protocol {
    id: string
    chain: string
    name: string
    site_url: string
    logo_url: string
    has_supported_portfolio: boolean
    tvl: number
    portfolio_item_list?: PortfolioItemList[]
    wallets?: Wallet[]
}
export interface Wallet {
    id: number;
    wallet: string;
    tag: string;
    portfolio_items: PortfolioItemList[];
}


export interface PortfolioItemList {
    wallet?: {address: string | undefined, tag: string}
    stats: Stats
    // asset_dict: AssetDict
    // chain: string
    asset_token_list: AssetTokenList[]
    update_at: number
    name: string
    detail_types: string[]
    detail: Detail
    proxy_detail: ProxyDetail
    pool: Pool
}

export interface Stats {
    asset_usd_value: number
    debt_usd_value: number
    net_usd_value: number
}

export interface AssetDict {
    string: number
}

export interface AssetTokenList {
    id: string
    chain: string
    name: string
    symbol: string
    display_symbol: any
    optimized_symbol: string
    decimals: number
    logo_url: string
    protocol_id: string
    price: number
    is_verified: boolean
    is_core: boolean
    is_wallet: boolean
    time_at: number | null
    amount: number
}

export interface Detail {
    supply_token_list: SupplyTokenList[]
    reward_token_list?: RewardTokenList[]
}

export interface SupplyTokenList {
    id: string
    chain: string
    name: string
    symbol: string
    display_symbol: any
    optimized_symbol: string
    decimals: number
    logo_url: string
    protocol_id: string
    price: number
    is_verified: boolean
    is_core: boolean
    is_wallet: boolean
    time_at: number | null
    amount: number
}

export interface RewardTokenList {
    id: string
    chain: string
    name: string
    symbol: string
    display_symbol: any
    optimized_symbol: string
    decimals: number
    logo_url: string
    protocol_id: string
    price: number
    is_verified: boolean
    is_core: boolean
    is_wallet: boolean
    time_at: number | null
    amount: number
}

export interface ProxyDetail {
}

export interface Pool {
    id: string
    chain: string
    project_id: string
    adapter_id: string
    controller: string
    index?: string | null
    time_at: number | null
}

export interface GroupedProtocols {
    [protocolName: string]: {
        name: string;
        positions: Position[];
        totalUSD: number;
    };
}

export interface Position {
    type: string;
    chain: string;
    tokenNames: string;
    logoUrls: string[];
    price: number;
    amount: number;
    usdValue: number;
    wallets: { tag: string; amount: number }[];
}