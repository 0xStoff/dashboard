export type WalletList = Tokens[]

export interface Tokens {
    id: string
    chain: string
    name: string
    symbol: string
    display_symbol?: string | null
    optimized_symbol?: string
    decimals: number
    logo_url?: string | null
    protocol_id?: string
    price: number
    price_24h_change?: number | null
    is_verified?: boolean
    is_core?: boolean
    is_wallet?: boolean
    time_at?: number | null
    amount: number
    raw_amount?: number
    raw_amount_hex_str?: string
    wallets?: [ {
        id: number, wallet: string, tag: string, amount: number
    }]

}