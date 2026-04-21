import React from "react";
import { Avatar, Box } from "@mui/material";

interface ProtocolLogoStackProps {
    isMobile: boolean;
    tokenNames: string;
    urls: string[];
}

const MAX_LOGOS = 4;

const ProtocolLogoStack: React.FC<ProtocolLogoStackProps> = ({ isMobile, tokenNames, urls }) => {
    const visibleUrls = urls.slice(0, MAX_LOGOS);
    const extraCount = Math.max(0, urls.length - MAX_LOGOS);
    const size = isMobile ? 28 : 36;

    return (
        <Box sx={{ display: "flex", alignItems: "center", minWidth: size }}>
            {visibleUrls.map((url, index) => (
                <Avatar
                    key={`${url}-${index}`}
                    alt={tokenNames}
                    src={url}
                    sx={{
                        width: size,
                        height: size,
                        ml: index === 0 ? 0 : -1,
                        border: "2px solid",
                        borderColor: "background.paper",
                        bgcolor: "grey.900",
                    }}
                />
            ))}
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
