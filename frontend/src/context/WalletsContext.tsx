import React, { createContext, useContext, useEffect, useState } from "react";
import { useFetchWallets } from "../hooks/useFetchWallets";

const WalletsContext = createContext(null);

export const WalletsProvider = ({ children }) => {
    const { wallets, setWallets, fetchWallets, loading } = useFetchWallets();

    return (
        <WalletsContext.Provider value={{ wallets, setWallets, fetchWallets, loading }}>
            {children}
        </WalletsContext.Provider>
    );
};

export const useWallets = () => useContext(WalletsContext);