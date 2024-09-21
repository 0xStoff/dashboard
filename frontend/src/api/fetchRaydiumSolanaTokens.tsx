import {Connection, ParsedAccountData, PublicKey} from '@solana/web3.js';
import {Raydium} from "@raydium-io/raydium-sdk-v2";
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {fetchTokenPrice} from "./fetchTokenPriceCoingecko";
import {SolToken} from "../interfaces/solana";
import {Account} from "../interfaces/account";

// Fetch token balances and metadata
const fetchRaydiumData = async (): Promise<SolToken[]> => {
    try {
        const connection = new Connection('https://solana-rpc.publicnode.com/');
        const owner = new PublicKey('BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq');

        // Get token accounts owned by the user
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID // SPL token program
        });

        // Fetch the Raydium Token List
        const raydium = await Raydium.load({
            connection, owner: owner, disableLoadToken: false
        });

        const balance = await connection.getBalance(owner);

        const solPrice = await fetchTokenPrice('solana') || { usd: 0 }

        let tokenData: SolToken[] = [{
            amount: balance / 10**9,
            name: 'Solana', // Example name
            logoURI: 'https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png', // Example logo URL
            address: 'BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq',
            symbol: 'SOL',
            decimals: 9,
            usd: solPrice.usd
        }];

        for (const accountInfo of tokenAccounts.value) {
            const parsedAccountInfo = (accountInfo.account.data as ParsedAccountData).parsed.info;
            const tokenAddress = parsedAccountInfo.mint; // Token mint address
            const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);

            if (tokenInfo) {
                const tokenPrice = await fetchTokenPrice(tokenInfo.extensions.coingeckoId || '');
                if (tokenPrice) {
                    tokenData.push({...tokenInfo, amount: parsedAccountInfo.tokenAmount.uiAmount, ...tokenPrice});
                }
            }
        }

        return tokenData;
    } catch (error) {
        console.error('Error fetching token data:', error);
        return [];
    }
};

// Solana Token interface
export interface SolanaToken {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    logo_url: string;
    price: number | null;
    amount: number;
    wallets: Array<{
        tag: string;
        id: number;
        wallet: string;
        amount: number;
    }>;
}

// Function to fetch Solana tokens and return metadata
export const fetchSolanaData = async (): Promise<null | {
    solTotalValue: number;
    sol: {
        wallet: string;
        chains: {
            total_usd_value: number;
            chain_list: {
                symbol: string;
                address: string;
                logo_url: string;
                decimals: number;
                name: string;
                id: string;
                usd_value: number
            }[]
        };
        tokens: {
            symbol: string;
            is_core: boolean;
            chain: string;
            amount: number;
            logo_url: string;
            price: number | null;
            decimals: number;
            name: string;
            wallets: { amount: number; wallet: string; tag: string; id: number }[];
            id: string
        }[];
        id: number;
        tag: string;
        protocols: any[]
    };
    solMetadata: {
        symbol: string;
        address: string;
        logo_url: string;
        decimals: number;
        name: string;
        id: string;
        usd_value: number
    };
    solTokens: {
        symbol: string;
        is_core: boolean;
        chain: string;
        amount: number;
        logo_url: string;
        price: number | null;
        decimals: number;
        name: string;
        wallets: { amount: number; wallet: string; tag: string; id: number }[];
        id: string
    }[]
}> => {
    try {
        const solanaTokens = await fetchRaydiumData();
        const solTotalValue = solanaTokens.reduce((sum, token) => sum + (token.amount * (token.usd || 0)), 0);

        const solMetadata = {
            id: 'sol',
            name: 'Solana',
            logo_url: "https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png",
            usd_value: solTotalValue,
            address: 'BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq',
            symbol: 'SOL',
            decimals: 9
        };

        const solTokens = solanaTokens.map(t => ({
            id: t.address,
            chain: "sol",
            name: t.name,
            symbol: t.symbol,
            decimals: t.decimals,
            logo_url: t.logoURI,
            price: t.usd,
            amount: t.amount,
            is_core: true,
            wallets: [{ tag: "Sol", id: 15, wallet: t.address, amount: t.amount }],
        }));

        const sol = {
            chains: { total_usd_value: solTotalValue, chain_list: [solMetadata] },
            id: 15,
            protocols: [],
            tag: "Sol",
            tokens: solTokens, // Ensure Sol tokens are added
            wallet: "BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq",
        };

        return { solTotalValue, solMetadata, solTokens, sol };
    } catch (error) {
        console.error("Failed to fetch Solana data:", error);
        return null;
    }
};
