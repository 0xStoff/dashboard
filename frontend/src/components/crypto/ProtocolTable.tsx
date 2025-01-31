import React from "react";
import { Avatar, Card, CardContent, Chip, Container, Grid, Typography } from "@mui/material";
import { ColoredChip } from "../utils/ChipWithTooltip";
import { formatNumber, toFixedString } from "../../utils/number-utils";
import { Protocol } from "../../interfaces";


const ProtocolTable: React.FC<{
  protocols: Protocol[];
}> = ({ protocols }) => {

  if (!protocols.length) return null;


  return <Container>
    {protocols.map((protocol) => ((protocol.totalUSD > 10 && <Card sx={{ marginY: 5, borderRadius: 10 }} key={protocol.name}>
      <CardContent sx={{ padding: 3 }}>
        <Typography variant="h6" fontWeight="bold" color="text.primary">
          {protocol.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          $ {toFixedString(protocol.totalUSD)}
        </Typography>
        {protocol.positions.map((position, index) => (<Grid key={index} container marginTop={2}>
          <Grid sx={{ display: "flex" }} item xs={1}>
            {position.logoUrls.map((url, i) => (
              <Avatar key={i} alt={position.tokenNames} src={url} sx={{ marginRight: 1 }} />))}
          </Grid>
          <Grid item xs={3}>
            <Typography sx={{ marginLeft: 2 }}>{position.tokenNames}</Typography>
          </Grid>
          <Grid item xs={2}>
            <Typography>$ {formatNumber(position.price, 'price')}</Typography>
          </Grid>
          <Grid item xs={2}>
            <Chip label={position.type} variant="filled" />
            {position.wallets.map((wallet, i) => (<ColoredChip
              key={i}
              label={wallet.tag}
              variant="outlined"
              size="small"
              fillPercentage="100"
            />))}
          </Grid>
          <Grid item xs={2}>
            <Typography align="right">{formatNumber(position.amount, 'amount')}</Typography>
          </Grid>
          <Grid item xs={2}>
            <Typography align="right" fontWeight="bold">
              $ {toFixedString(position.usdValue)}
            </Typography>
          </Grid>
        </Grid>))}
      </CardContent>
    </Card>)))}
  </Container>;
};

export default ProtocolTable;

