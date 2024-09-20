import {Connection, ParsedAccountData, PublicKey} from '@solana/web3.js';
import {Raydium} from "@raydium-io/raydium-sdk-v2";
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {fetchTokenPrice} from "./fetchTokenPriceCoingecko";
import {SolToken} from "../interfaces/solana";

// Fetch token balances and metadata
export const fetchRaydiumData = async (): Promise<SolToken[]> => {
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

