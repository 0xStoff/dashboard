import React from "react";

export interface Chain {
    total_usd_value: number
    chain_list: ChainListInterface[]
}

export interface ChainListInterface {
    id: string
    community_id: number
    name: string
    native_token_id: string
    logo_url: string
    wrapped_token_id: string
    is_support_pre_exec: boolean
    usd_value: number
}

export type ChainIdState = [string, React.Dispatch<React.SetStateAction<string>>];
