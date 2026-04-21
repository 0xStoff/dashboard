import React from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { WalletsProvider } from "../context/WalletsContext";
import { appTheme } from "../styles/appTheme";

interface AppProvidersProps {
    children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <WalletsProvider>
            <ThemeProvider theme={appTheme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </WalletsProvider>
    );
};

export default AppProviders;
