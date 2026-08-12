import React from "react";
import { Avatar, Box } from "@mui/material";
import { buildLogoUrl } from "../../config/env";

interface ProtocolLogoStackProps {
    isMobile: boolean;
    tokenNames: string;
    urls: string[];
}

const MAX_LOGOS = 4;

const ProtocolLogoStack: React.FC<ProtocolLogoStackProps> = ({ isMobile, tokenNames, urls }) => {
    const tokenLabels = tokenNames.split(" + ").map((name) => name.trim()).filter(Boolean);
    const visibleTokens = tokenLabels.slice(0, MAX_LOGOS);
    const extraCount = Math.max(0, tokenLabels.length - MAX_LOGOS);
    const size = isMobile ? 28 : 36;
    const initials = (name: string) =>
        name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

    return (
        <Box sx={{ display: "flex", alignItems: "center", minWidth: size }}>
            {visibleTokens.map((tokenName, index) => {
                const filename = urls[index] || "";
                const source = /^(?:https?:|data:)/i.test(filename) ? filename : buildLogoUrl(filename);
                return (
                <Avatar
                    key={`${tokenName}-${index}`}
                    alt={tokenName}
                    src={source || undefined}
                    sx={{
                        width: size,
                        height: size,
                        ml: index === 0 ? 0 : -1,
                        border: "2px solid",
                        borderColor: "background.paper",
                        bgcolor: "grey.900",
                    }}
                >
                    {initials(tokenName)}
                </Avatar>
                );
            })}
            {extraCount > 0 && (
                <Avatar
                    sx={{
                        width: size,
                        height: size,
                        ml: -1,
                        border: "2px solid",
                        borderColor: "background.paper",
                        bgcolor: "grey.800",
                        fontSize: isMobile ? 11 : 12,
                        fontWeight: 700,
                    }}
                >
                    +{extraCount}
                </Avatar>
            )}
        </Box>
    );
};

export default ProtocolLogoStack;
