import React from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { WalletsProvider } from "../context/WalletsContext";
import { appTheme } from "../styles/appTheme";
import { DashboardSettingsProvider } from "../context/DashboardSettingsContext";

interface AppProvidersProps {
    children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <WalletsProvider>
            <DashboardSettingsProvider>
                <ThemeProvider theme={appTheme}>
                    <CssBaseline />
                    {children}
                </ThemeProvider>
            </DashboardSettingsProvider>
        </WalletsProvider>
    );
};

export default AppProviders;
