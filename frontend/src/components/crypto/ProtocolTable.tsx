import React from "react";
import { Card, CardContent, Container, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Protocol, Token } from "../../interfaces";
import { toFixedString } from "../../utils/number-utils";
import ProtocolPositionRow from "./ProtocolPositionRow";

const styles = {
    card: (isActive: boolean) => ({
        opacity: isActive ? 1 : 0.5,
        marginY: 5,
        borderRadius: 10,
        overflowX: "auto",
        cursor: "pointer",
    }),
    cardContent: (isMobile: boolean) => ({ padding: isMobile ? 2 : 3 }),
};

const createProtocolSelectionToken = (protocol: Protocol): Token => ({
    chain_id: protocol.positions[0]?.chain || "protocol",
    name: protocol.name,
    symbol: protocol.name,
    decimals: 0,
    logo_path: "",
    price: 0,
    price_24h_change: null,
    amount: 0,
    wallets: [],
    total_usd_value: protocol.totalUSD,
});

const ProtocolTable: React.FC<{
    protocols: Protocol[];
    selectedToken: Token | null;
    setSelectedToken: React.Dispatch<React.SetStateAction<Token | null>>;
}> = ({ protocols, selectedToken, setSelectedToken }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const handleTokenClick = (protocol: Protocol) => {
        setSelectedToken((prevSelected) =>
            prevSelected?.symbol === protocol.name ? null : createProtocolSelectionToken(protocol)
        );
    };

    if (!protocols.length) {
        return null;
    }

    return (
        <Container>
            {protocols
                .filter((protocol) => protocol.totalUSD > 10)
                .map((protocol) => (
                    <Card
                        onClick={() => handleTokenClick(protocol)}
                        sx={styles.card(selectedToken?.symbol === protocol.name || selectedToken === null)}
                        key={protocol.name}
                    >
                        <CardContent sx={styles.cardContent(isMobile)}>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                                {protocol.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                $ {toFixedString(protocol.positions.reduce((sum, position) => sum + position.usdValue, 0))}
                            </Typography>

                            {protocol.positions.map((position, index) => (
                                <ProtocolPositionRow
                                    key={`${protocol.name}-${position.type}-${index}`}
                                    isMobile={isMobile}
                                    position={position}
                                />
                            ))}
                        </CardContent>
                    </Card>
                ))}
        </Container>
    );
};

export default ProtocolTable;
