import React from "react";
import { Avatar, Card, CardContent, Chip, Container, Grid, Typography, useMediaQuery } from "@mui/material";
import { ColoredChip } from "../utils/ChipWithTooltip";
import { formatNumber, toFixedString } from "../../utils/number-utils";
import { Protocol } from "../../interfaces";
import { useTheme } from "@mui/material/styles";

const ProtocolTable: React.FC<{ protocols: Protocol[] }> = ({ protocols }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (!protocols.length) return null;

  return (
    <Container>
      {protocols.map((protocol) => (
        protocol.totalUSD > 10 && (
          <Card sx={{ marginY: 5, borderRadius: 10, overflowX: "auto" }} key={protocol.name}>
            <CardContent sx={{ padding: isMobile ? 2 : 3 }}>
              <Typography variant="h6" fontWeight="bold" color="text.primary">
                {protocol.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                $ {toFixedString(protocol.positions.reduce((sum, position) => sum + position.usdValue, 0))}
              </Typography>
              {protocol.positions.map((position, index) => (
                <Grid key={index} container marginTop={2} alignItems="center">
                  <Grid sx={{ display: "flex" }} item xs={isMobile ? 4 : 2}>
                    {position.logoUrls.map((url, i) => (
                      <Avatar
                        key={i}
                        alt={position.tokenNames}
                        src={url}
                        sx={{ width: isMobile ? 25 : 35, height: isMobile ? 25 : 35, marginRight: 1 }}
                      />
                    ))}
                  </Grid>

                  {!isMobile &&
                    <Grid item xs={2}>
                      <Typography sx={{ marginLeft: 2 }}>{position.tokenNames}</Typography>
                    </Grid>}

                  {!isMobile &&
                    <Grid item xs={2}>
                      <Typography>$ {formatNumber(position.price, "price")}</Typography>
                    </Grid>}

                  <Grid item xs={isMobile ? 4 : 2}>
                    <Chip label={position.type} variant="filled" size={isMobile ? "small" : "medium"} />
                    {
                      position.wallets.map((wallet, i) => (
                        <ColoredChip
                          key={i}
                          label={wallet.tag}
                          variant="outlined"
                          size="small"
                          fillPercentage="100"
                        />
                      ))}
                  </Grid>

                  {!isMobile && (
                    <Grid item xs={2}>
                      <Typography align="right">{formatNumber(position.amount, "amount")}</Typography>
                    </Grid>
                  )}

                  <Grid item xs={isMobile ? 4 : 2}>
                    <Typography align="right" fontWeight="bold">
                      $ {toFixedString(position.usdValue)}
                    </Typography>
                  </Grid>
                </Grid>
              ))}
            </CardContent>
          </Card>
        )
      ))}
    </Container>
  );
};

export default ProtocolTable;