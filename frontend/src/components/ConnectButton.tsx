import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { IconButton, Tooltip } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

const ConnectButton = ({ setIsAuthenticated }: { setIsAuthenticated: (auth: boolean) => void }) => {
    const [account, setAccount] = useState<string | null>(null);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/auth/check`, {
                credentials: "include",
            });

            const data = await response.json();

            if (data.success) {
                setAccount(data.address);
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error("Error checking authentication:", error);
        }
    };

    const connectWallet = async () => {
        if (!window.ethereum) {
            alert("Please install MetaMask or Rabby Wallet.");
            return;
        }

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setAccount(address);

            await authenticateUser(address);
        } catch (error) {
            console.error("Error connecting wallet:", error);
        }
    };

    const authenticateUser = async (address: string) => {
        try {
            // Request the nonce first
            const nonceResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/auth/message?wallet=${address}`, {
                credentials: "include",
            });

            if (!nonceResponse.ok) throw new Error("Failed to fetch nonce");

            const { message } = await nonceResponse.json();

            // Sign the message
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const signature = await signer.signMessage(message);

            const loginResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ address, signature }),
            });

            const data = await loginResponse.json();

            if (data.success) {
                setIsAuthenticated(true);
                window.location.reload()
            } else {
                alert(data.error || "Unauthorized wallet.");
                setIsAuthenticated(false);
            } }
        catch (error) {
            console.error("Authentication error:", error);
        }
    };
    const logout = async () => {
        try {
            await fetch(`${process.env.REACT_APP_API_BASE_URL}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });

            setAccount(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    return (
        <Tooltip title={account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}>
            <IconButton color="primary" onClick={account ? logout : connectWallet}>
                <AccountBalanceWalletIcon />
            </IconButton>
        </Tooltip>
    );
};

export default ConnectButton;