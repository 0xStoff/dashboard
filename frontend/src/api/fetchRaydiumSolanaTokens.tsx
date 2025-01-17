import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js';
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { fetchTokenPrice } from "./fetchTokenPriceCoingecko";
import { SolToken } from "../interfaces/solana";

// Fetch token balances and metadata with caching
const fetchRaydiumData = async (wallet): Promise<SolToken[]> => {
    try {
        const cachedSolanaTokens = localStorage.getItem('solanaTokens');
        if (cachedSolanaTokens) {
            return JSON.parse(cachedSolanaTokens);
        }

        const connection = new Connection('https://solana-rpc.publicnode.com/');
        const owner = new PublicKey(wallet);

        // Get token accounts owned by the user
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID
        });

        // Fetch the Raydium TokenModel List
        const raydium = await Raydium.load({
            connection, owner: owner, disableLoadToken: false
        });

        const balance = await connection.getBalance(owner);
        const solPrice = await fetchTokenPrice('solana') || { usd: 0 }

        let tokenData: SolToken[] = [{
            amount: balance / 10**9,
            name: 'Solana',
            logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=040',
            address: wallet,
            symbol: 'SOL',
            decimals: 9,
            usd: solPrice.usd,
            price_24h_change: solPrice.price_24h_change
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
                        ...tokenPrice
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
export const fetchSolanaData = async (solanaWallets): Promise<null | {
    solMetadata: any;
    solTotalValue: number;
    sol: any;
}> => {
    try {
        const solanaTokens = await fetchRaydiumData(solanaWallets[0].wallet);
        const solTotalValue = solanaTokens.reduce((sum, token) => sum + (token.amount * (token.usd || 0)), 0);


        const solMetadata = {
            id: 'sol',
            name: 'Solana',
            logo_url: "https://cryptologos.cc/logos/solana-sol-logo.png?v=040",
            usd_value: solTotalValue || 0,
            address: solanaWallets[0].wallet,
            symbol: 'SOL',
            decimals: 9
        };

        const solTokens = solanaTokens.map(({ address, name, symbol, decimals, logoURI, usd, amount, price_24h_change }) => ({
            id: address,
            chain: "sol",
            name,
            symbol,
            decimals,
            logo_url: logoURI,
            price: usd,
            price_24h_change,
            amount,
            is_core: true,
            wallets: [{ tag: "Sol", id: 15, wallet: address, amount }],
        }));

        const sol = {
            chains: { total_usd_value: solTotalValue, chain_list: [solMetadata] },
            id: 15,
            protocols: [],
            tag: "Sol",
            tokens: solTokens,
            wallet: solanaWallets[0].wallet,
        };

        return { solTotalValue, solMetadata, sol };
    } catch (error) {
        console.error("Failed to fetch Solana data:", error);
        return null;
    }
};