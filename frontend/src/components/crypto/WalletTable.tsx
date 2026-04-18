import React, {useMemo, useState} from "react";
import {
    Avatar,
    Box,
    Card,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
    Menu,
    MenuItem,
    IconButton
} from "@mui/material";
import {ArrowDropUp, ArrowDropDown} from "@mui/icons-material";
import {Token} from "../../interfaces";
import {useTheme} from "@mui/material/styles";
import {formatNumber, toFixedString} from "../../utils/number-utils";
import {ChipWithTooltip} from "../utils/ChipWithTooltip";

const styles = {
    container: {flex: 1}, card: {borderRadius: 10, overflowX: "auto", position: "relative"},

    tableRow: (isActive: boolean) => ({
        cursor: "pointer",
        opacity: isActive ? 1 : 0.5,
        "&:last-child td, &:last-child th": {border: 0}
    }), tableCell: {border: 0}, avatarWrapper: {
        display: "flex", alignItems: "center", position: "relative", width: "fit-content"
    }, chainLogo: {
        width: 20,
        height: 20,
        position: "absolute",
        bottom: 0,
        right: 0,
        // border: "1px solid",
        borderColor: "background.paper"
    }, sortButton: {
        position: "absolute", top: 10, right: 10
    }
};


// sx={styles.tableRow(selectedChainId === "all" || selectedChainId === chain.chain_id)}
//
//
// const styles = {
//   container: {
//     flex: "0 0 auto", width: { md: 200 }, maxWidth: { md: 200 }
//   }, card: {
//     borderRadius: 10
//   }, tableRow: (isActive: boolean) => ({
//     cursor: "pointer",
//     opacity: isActive ? 1 : 0.5,
//     "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.08)" },
//     "&:last-child td, &:last-child th": { border: 0 }
//   }), tableCell: { border: 0 }
// };

const WalletTable: React.FC<{
    tokens: Token[],
    chainList: any[],
    selectedToken: string | null ,
    setSelectedToken: (value: (prevSelected) => null | string) => void
}> = ({tokens, chainList, selectedToken, setSelectedToken}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [sortConfig, setSortConfig] = useState({key: "holdings", order: "desc"});
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    const totalUSD = useMemo(() => tokens.reduce((acc, item) => acc + item.amount * item.price, 0), [tokens]);


    const getChainLogo = (chainId: string) => chainList.find((c) => c.chain_id === chainId)?.logo_path || "";

    const sortedTokens = useMemo(() => {
        return [...tokens].sort((a, b) => {
            const valueA = sortConfig.key === "holdings" ? a.amount * a.price : (a.price_24h_change || 0);
            const valueB = sortConfig.key === "holdings" ? b.amount * b.price : (b.price_24h_change || 0);
            return sortConfig.order === "asc" ? valueA - valueB : valueB - valueA;
        });
    }, [tokens, sortConfig]);


    const handleSortChange = (key: "holdings" | "change") => {
        setSortConfig((prev) => ({
            key, order: prev.key === key ? (prev.order === "asc" ? "desc" : "asc") : "desc"
        }));
        setMenuAnchor(null);
    };

    const handleTokenClick = (symbol: string) => {
        setSelectedToken((prevSelected) => (prevSelected === symbol ? null : symbol));
    };

    if (!tokens.length) return <Typography>no tokens</Typography>;



    return (<Box sx={styles.container}>
            <Card sx={styles.card}>
                <IconButton sx={styles.sortButton} onClick={(e) => setMenuAnchor(e.currentTarget)}>
                    {sortConfig.order === "asc" ? <ArrowDropUp/> : <ArrowDropDown/>}
                </IconButton>

                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                    <MenuItem onClick={() => handleSortChange("holdings")}>Sort by Holdings</MenuItem>
                    <MenuItem onClick={() => handleSortChange("change")}>Sort by 24h Change</MenuItem>
                </Menu>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{border: 0, padding: 3}} colSpan={isMobile ? 3 : 6}>
                                <Typography variant="h5" fontWeight="bold">Wallet</Typography>
                                <Typography variant="body2" fontWeight="bold">$ {toFixedString(totalUSD)}</Typography>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                </Table>

                <Box sx={{height: "auto", maxHeight: 600, overflowX: "auto"}}>
                    <Table>
                        <TableBody>
                            {sortedTokens.map((item, index) => (
                                <TableRow onClick={() => handleTokenClick(item.symbol)} key={index}
                                          hover
                                          sx={styles.tableRow( selectedToken === item.symbol || selectedToken === null)}>
                                    <TableCell sx={styles.tableCell}>
                                        <Box sx={styles.avatarWrapper}>
                                            <Avatar
                                                alt={item.name}
                                                src={process.env.REACT_APP_LOGO_BASE_URL + item.logo_path || ""}
                                                sx={{
                                                    width: isMobile ? 30 : 35,
                                                    height: isMobile ? 30 : 35,
                                                    marginRight: 1
                                                }}
                                            />
                                            {getChainLogo(item.chain_id) && (<Avatar
                                                    alt={item.chain_id}
                                                    src={process.env.REACT_APP_LOGO_BASE_URL + getChainLogo(item.chain_id)}
                                                    sx={{
                                                        ...styles.chainLogo,
                                                        width: isMobile ? 15 : 20,
                                                        height: isMobile ? 15 : 20
                                                    }}
                                                />)}
                                        </Box>
                                    </TableCell>

                                    {!isMobile && <TableCell sx={styles.tableCell} align="left">
                                        <Typography fontWeight="bold" marginLeft={2} variant="body2" noWrap>
                                            {item.symbol}
                                        </Typography>
                                    </TableCell>}

                                    <TableCell sx={styles.tableCell} align="left">
                                        {item.price_24h_change && (<Typography
                                                fontWeight="bold"
                                                marginLeft={2}
                                                variant="body2"
                                                noWrap
                                                sx={{color: item.price_24h_change >= 0 ? "success.main" : "error.main"}}
                                            >
                                                {toFixedString(item.price_24h_change)} %
                                            </Typography>)}
                                    </TableCell>
                                    {!isMobile && <TableCell sx={styles.tableCell} align="right">
                                        {item.wallets?.map((wallet) => (
                                            <ChipWithTooltip key={wallet.id} item={item} wallet={wallet}/>))}
                                    </TableCell>}

                                    {!isMobile && <TableCell sx={styles.tableCell}>
                                        {formatNumber(item.amount, 'amount')}
                                    </TableCell>}
                                    {!isMobile && <TableCell sx={{...styles.tableCell, whiteSpace: "nowrap"}}>
                                        $ {formatNumber(item.price, 'price')}
                                    </TableCell>}
                                    <TableCell sx={{...styles.tableCell, fontWeight: "bold", whiteSpace: "nowrap"}}
                                               align="right">
                                        $ {toFixedString(item.amount * item.price)}
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                </Box>
            </Card>
        </Box>);
};

export default React.memo(WalletTable);