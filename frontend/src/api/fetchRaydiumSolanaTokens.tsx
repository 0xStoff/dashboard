import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js';
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { fetchTokenPrice } from "./fetchTokenPriceCoingecko";
import { SolToken } from "../interfaces/solana";

// Fetch token balances and metadata with caching
const fetchRaydiumData = async (): Promise<SolToken[]> => {
    try {
        const cachedSolanaTokens = localStorage.getItem('solanaTokens');
        if (cachedSolanaTokens) {
            return JSON.parse(cachedSolanaTokens);
        }

        const connection = new Connection('https://solana-rpc.publicnode.com/');
        const owner = new PublicKey('BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq');

        // Get token accounts owned by the user
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID
        });

        // Fetch the Raydium Token List
        const raydium = await Raydium.load({
            connection, owner: owner, disableLoadToken: false
        });

        const balance = await connection.getBalance(owner);
        const solPrice = await fetchTokenPrice('solana') || { usd: 0 }

        let tokenData: SolToken[] = [{
            amount: balance / 10**9,
            name: 'Solana',
            logoURI: 'https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png',
            address: 'BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq',
            symbol: 'SOL',
            decimals: 9,
            usd: solPrice.usd
        }];

        for (const accountInfo of tokenAccounts.value) {
            const parsedAccountInfo = (accountInfo.account.data as ParsedAccountData).parsed.info;
            const tokenAddress = parsedAccountInfo.mint;
            const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);

            if (tokenInfo) {
                const tokenPrice = await fetchTokenPrice(tokenInfo.extensions.coingeckoId || '');
                if (tokenPrice) {
                    tokenData.push({
                        ...tokenInfo,
                        amount: parsedAccountInfo.tokenAmount.uiAmount,
                        usd: tokenPrice.usd
                    });
                }
            }
        }

        // Filter tokens with non-zero balances and save them in localStorage
        const nonZeroTokenData = tokenData.filter(token => token.amount > 0);
        localStorage.setItem('solanaTokens', JSON.stringify(nonZeroTokenData));

        return nonZeroTokenData;
    } catch (error) {
        console.error('Error fetching token data:', error);
        return [];
    }
};

// Function to fetch Solana tokens with metadata, utilizing caching
export const fetchSolanaData = async (): Promise<null | {
    solTotalValue: number;
    sol: any;
}> => {
    try {
        const solanaTokens = await fetchRaydiumData();
        const solTotalValue = solanaTokens.reduce((sum, token) => sum + (token.amount * (token.usd || 0)), 0);

        const solMetadata = {
            id: 'sol',
            name: 'Solana',
            logo_url: "https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png",
            usd_value: solTotalValue || 0,
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
            tokens: solTokens,
            wallet: "BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq",
        };

        return { solTotalValue, solMetadata, sol };
    } catch (error) {
        console.error("Failed to fetch Solana data:", error);
        return null;
    }
};