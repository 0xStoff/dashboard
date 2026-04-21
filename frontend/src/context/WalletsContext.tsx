import React, { createContext, useContext } from "react";
import { useFetchWallets } from "../hooks/useFetchWallets";
import { WalletContextValue } from "../interfaces";

const WalletsContext = createContext<WalletContextValue | null>(null);

export const WalletsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { wallets, setWallets, fetchWallets, loading } = useFetchWallets();

    return (
        <WalletsContext.Provider value={{ wallets, setWallets, fetchWallets, loading }}>
            {children}
        </WalletsContext.Provider>
    );
};

export const useWallets = () => {
    const context = useContext(WalletsContext);
    if (!context) {
        throw new Error("useWallets must be used inside WalletsProvider");
    }

    return context;
};
