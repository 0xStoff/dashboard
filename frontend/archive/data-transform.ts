import {Account} from "./interfaces/account";
import {ChainListInterface} from "./interfaces/chain";
import { Protocol} from "./interfaces/protocol";
import {Tokens} from "./interfaces/tokens";

export function mergeAndAggregateChains(accounts: Account[]): ChainListInterface[] {
    const chainMap = new Map<string, ChainListInterface>();
    accounts.forEach(account => {
        account.chains?.chain_list.forEach(chain => {
            const existingChain = chainMap.get(chain.id);
            if (existingChain) {
                existingChain.usd_value += chain.usd_value;
            } else {
                chainMap.set(chain.id, {...chain});
            }
        });
    });
    return Array.from(chainMap.values());
}

export function mergeAndAggregateTokens(accounts: Account[]): Tokens[] {
    const tokenMap = new Map<string, { token: Tokens }>();
    accounts.forEach(account => {
        account.tokens?.forEach(token => {
            const key = token.id + token.chain;
            const existingTokenEntry = tokenMap.get(key);
            if (existingTokenEntry) {
                if (!existingTokenEntry.token.wallets?.some(wallet => wallet.id === account.id)) {
                    existingTokenEntry.token.amount += token.amount;
                    existingTokenEntry.token.wallets?.push({
                        tag: account.tag, id: account.id, wallet: account.wallet, amount: token.amount
                    });
                }
            } else {
                tokenMap.set(key, {
                    token: {...token, wallets: [{tag: account.tag, id: account.id, wallet: account.wallet, amount: token.amount}]}
                });
            }
        });
    });
    return Array.from(tokenMap.values()).map(entry => entry.token);
}

export function mergeProtocols(accounts: Account[]): Protocol[] {
    const protocolMap = new Map<string, Protocol>();

    accounts.forEach(account => {

        // console.log(account.protocols)
        (account.protocols ?? []).forEach(protocol => {
            const { portfolio_item_list, ...protocolWithoutItems } = protocol;
            let existingProtocol = protocolMap.get(protocol.id);

            if (existingProtocol) {
                existingProtocol.wallets = existingProtocol.wallets ?? [];
                const walletIndex = existingProtocol.wallets.findIndex(w => w.id === account.id);

                if (walletIndex === -1) {
                    existingProtocol.wallets.push({
                        tag: account.tag,
                        id: account.id,
                        wallet: account.wallet,
                        portfolio_items: portfolio_item_list || []
                    });
                } else {
                    existingProtocol.wallets[walletIndex].portfolio_items = [
                        ...(existingProtocol.wallets[walletIndex].portfolio_items ?? []),
                        ...portfolio_item_list || []
                    ];
                }
            } else {
                protocolMap.set(protocol.id, {
                    ...protocolWithoutItems,
                    wallets: [{
                        tag: account.tag,
                        id: account.id,
                        wallet: account.wallet,
                        portfolio_items: portfolio_item_list || []
                    }]
                });
            }
        });
    });



    return Array.from(protocolMap.values());
}

