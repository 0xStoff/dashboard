import {Chain} from "./chain";
import {WalletList} from "./tokens";
import {ProtocolList} from "./protocol";

export interface Account {
    id: number
    wallet: string
    tag: string
    chains?: Chain | null
    tokens?: WalletList | null
    protocols?: ProtocolList | null
}