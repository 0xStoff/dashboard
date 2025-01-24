import React, {useEffect, useState} from 'react';
import {Web3} from 'web3';
import {Multicall} from 'ethereum-multicall';
import axios from "axios";

const tokenABI = require('./data/erc20.abi.json');

function EthTokens() {
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(false);  // New loading state
    const walletAddress = "0x770353615119f0f701118d3a4eaf1fe57fa00f84";

    useEffect(() => {
        // Load cached balances on component mount
        const cachedBalances = localStorage.getItem('ethBalances');
        if (cachedBalances) {
            setBalances(JSON.parse(cachedBalances));
        }
    }, []);

    const fetchTokens = async () => {
        try {
            const response = await axios.get('http://localhost:3000/api/coins/ethereum');
            return response.data.filter(token => token.contract_address && token.contract_address.length === 42);
        } catch (error) {
            console.error("Failed to fetch Ethereum contracts from DB:", error);
            return [];
        }
    };

    const getTokenBalances = async (rpcUrl, multicallAddress, tokenContracts) => {
        const web3 = new Web3(rpcUrl);
        const multicall = new Multicall({
            web3Instance: web3, tryAggregate: true, multicallCustomContractAddress: multicallAddress,
        });

        const calls = tokenContracts.map(contractAddress => ({
            reference: contractAddress,
            contractAddress: contractAddress,
            abi: tokenABI,
            calls: [{reference: 'balanceOf', methodName: 'balanceOf', methodParameters: [walletAddress]}],
        }));

        const results = await multicall.call(calls);
        const tokenBalances = {};

        tokenContracts.forEach((contract) => {
            const returnContext = results.results[contract]?.callsReturnContext?.[0];
            if (returnContext && returnContext.success) {
                tokenBalances[contract] = web3.utils.fromWei(returnContext.returnValues[0].hex, 'ether');
            } else {
                tokenBalances[contract] = '0';
            }
        });

        return tokenBalances;
    };

    const refetchAllContractsAndBalances = async () => {
        setLoading(true);  // Set loading to true
        try {
            const tokenContracts = await fetchTokens();
            const contractAddresses = tokenContracts.map(token => token.contract_address);

            const ethBalances = await getTokenBalances(
                `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_API_KEY}`,
                '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
                contractAddresses
            );

            // Filter out tokens with balance > 0 before caching and updating the state
            const tokensWithBalances = tokenContracts
                .map(token => ({
                    ...token,
                    balance: ethBalances[token.contract_address] || '0'
                }))
                .filter(token => parseFloat(token.balance) > 0);  // Only keep tokens with a balance > 0

            localStorage.setItem('ethBalances', JSON.stringify(tokensWithBalances)); // Cache tokens with balance > 0
            setBalances(tokensWithBalances);
        } catch (error) {
            console.error("Failed to fetch token balances:", error);
        } finally {
            setLoading(false);  // Set loading to false
        }
    };

    const refreshBalancesOnly = async () => {
        setLoading(true);  // Set loading to true
        try {
            const cachedBalances = JSON.parse(localStorage.getItem('ethBalances') || '[]');
            const contractAddresses = cachedBalances.map(token => token.contract_address);

            const ethBalances = await getTokenBalances(
                `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_API_KEY}`,
                '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
                contractAddresses
            );

            const updatedBalances = cachedBalances
                .map(token => ({
                    ...token,
                    balance: ethBalances[token.contract_address] || '0'
                }))
                .filter(token => parseFloat(token.balance) > 0);  // Only keep tokens with a balance > 0

            localStorage.setItem('ethBalances', JSON.stringify(updatedBalances)); // Update cache with balance > 0
            setBalances(updatedBalances);
        } catch (error) {
            console.error("Failed to refresh token balances:", error);
        } finally {
            setLoading(false);  // Set loading to false
        }
    };

    return (
        <div>
            <h1>Token Balances Ethereum</h1>
            {loading ? (
                <p>Loading...</p>  // Display loading state
            ) : (
                <ul>
                    {balances.length > 0 && balances.map((token) => (
                        <li key={token.contract_address}>
                            {token.name} ({token.symbol}): {token.balance} tokens
                        </li>
                    ))}
                </ul>
            )}
            <button onClick={refetchAllContractsAndBalances}>Refetch All Contracts & Balances</button>
            <button onClick={refreshBalancesOnly}>Refresh Balances Only</button>
        </div>
    );
}

export default EthTokens;