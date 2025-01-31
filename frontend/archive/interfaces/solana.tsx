// SolToken interface to represent each token in the response
export interface SolToken {
    amount: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI: string;
    tags?: string[];
    daily_volume?: number;
    created_at?: string;
    freeze_authority?: string;
    mint_authority?: string;
    permanent_delegate?: any;
    minted_at?: string;
    extensions?: Extensions;
    mintAuthority?: string;
    freezeAuthority?: string;
    type?: string;
    priority?: number;
    programId?: string;
    usd: number | null;
}

export interface Extensions {
    coingeckoId?: string;
}