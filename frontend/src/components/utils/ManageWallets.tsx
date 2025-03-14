import React, {useEffect, useState} from "react";
import {
    Box,
    Button,
    IconButton,
    List,
    ListItem,
    TextField,
    CircularProgress,
    Tooltip,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    Switch,
} from "@mui/material";
import {Add, Delete, Edit, ContentCopy} from "@mui/icons-material";
import axios from "axios";
import {useFetchWallets} from "../../hooks/useFetchWallets";
import apiClient from "../../utils/api-client";
import {useWallets} from "../../context/WalletsContext";

const CHAIN_OPTIONS = ["evm", "cosmos", "sol", "sui", "aptos"];

function shortenAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function ManageWallets() {
    const { wallets,  loading: walletsLoading, fetchWallets, setWallets } = useWallets();
    const [newWallet, setNewWallet] = useState({tag: "", wallet: "", chain: "", show_chip: true});
    const [editingWallet, setEditingWallet] = useState<{
        id: string;
        tag: string;
        wallet: string;
        chain: string;
        show_chip: boolean
    } | null>(null);


    const handleAddWallet = async () => {
        if (!newWallet.tag.trim() || !newWallet.wallet.trim() || !newWallet.chain) return;
        try {
            delete newWallet.show_chip;
            await apiClient.post(`/wallets`, newWallet);
            setNewWallet({tag: "", wallet: "", chain: "", show_chip: false});
            fetchWallets();
        } catch (error) {
            console.error("Error adding wallet:", error);
        }
    };

    const handleEditWallet = async () => {
        if (!editingWallet || !editingWallet.tag.trim() || !editingWallet.wallet.trim() || !editingWallet.chain) return;
        try {
            await apiClient.put(`/wallets/${editingWallet.id}`, editingWallet);
            setEditingWallet(null);
            fetchWallets();
        } catch (error) {
            console.error("Error updating wallet:", error);
        }
    };

    const handleDeleteWallet = async (id: string) => {
        try {
            await apiClient.delete(`/wallets/${id}`);
            fetchWallets();
        } catch (error) {
            console.error("Error deleting wallet:", error);
        }
    };

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address);
    };
    const handleToggleShowChip = async (id: string, currentValue: boolean) => {
        try {
            setWallets((prevWallets) =>
                prevWallets.map((wallet) =>
                    wallet.id === id ? { ...wallet, show_chip: !currentValue } : wallet
                )
            );

            await apiClient.put(`/wallets/${id}`, { show_chip: !currentValue });

            fetchWallets();
        } catch (error) {
            console.error("Error updating show_chip:", error);
        }
    };
    return (<Box>
            <Typography variant="h6" sx={{mb: 2}}>
                Manage Wallets
            </Typography>

            {walletsLoading ? (<CircularProgress/>) : (<List sx={{maxHeight: 500, overflowY: "auto"}}>
                    {wallets.map((wallet) => (<ListItem
                            key={wallet.id}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                paddingY: 1,
                            }}
                        >
                            <Box sx={{display: "flex", alignItems: "center", gap: 2, flexGrow: 1}}>
                                <Typography sx={{minWidth: 80, fontWeight: 600}}>{wallet.tag}</Typography>
                                <Tooltip title={wallet.wallet} arrow>
                                    <Typography
                                        sx={{
                                            fontFamily: "monospace",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            padding: "4px 8px",
                                            borderRadius: 1,
                                        }}
                                    >
                                        {shortenAddress(wallet.wallet)}
                                    </Typography>
                                </Tooltip>
                                <Tooltip title="Copy Address">
                                    <IconButton size="small" onClick={() => handleCopyAddress(wallet.wallet)}>
                                        <ContentCopy fontSize="small"/>
                                    </IconButton>
                                </Tooltip>
                                <Typography sx={{color: "gray", fontSize: 14}}>{wallet.chain}</Typography>

                                <Switch
                                    checked={wallet.show_chip}
                                    onChange={() => handleToggleShowChip(wallet.id, wallet.show_chip)}
                                    inputProps={{"aria-label": "Toggle show chip"}}
                                />
                            </Box>

                            <Box>
                                <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => setEditingWallet(wallet)}>
                                        <Edit fontSize="small"/>
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => handleDeleteWallet(wallet.id)}>
                                        <Delete fontSize="small"/>
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </ListItem>))}
                </List>)}

            {editingWallet ? (<Box display="flex" flexDirection="column" gap={2} mt={2}>
                    <TextField
                        label="Wallet Tag"
                        value={editingWallet.tag}
                        onChange={(e) => setEditingWallet({...editingWallet, tag: e.target.value})}
                    />
                    <TextField
                        label="Wallet Address"
                        value={editingWallet.wallet}
                        onChange={(e) => setEditingWallet({...editingWallet, wallet: e.target.value})}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Chain</InputLabel>
                        <Select
                            value={editingWallet.chain}
                            onChange={(e) => setEditingWallet({...editingWallet, chain: e.target.value})}
                        >
                            {CHAIN_OPTIONS.map((chain) => (<MenuItem key={chain} value={chain}>
                                    {chain}
                                </MenuItem>))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={<Checkbox
                            checked={editingWallet.show_chip}
                            onChange={(e) => setEditingWallet({...editingWallet, show_chip: e.target.checked})}
                        />}
                        label="Show as Chip"
                    />
                    <Button onClick={handleEditWallet} variant="contained">
                        Save
                    </Button>
                </Box>) : (<Box display="flex" flexDirection="column" gap={2} mt={2}>
                    <TextField
                        label="Wallet Tag"
                        value={newWallet.tag}
                        onChange={(e) => setNewWallet({...newWallet, tag: e.target.value})}
                    />
                    <TextField
                        label="Wallet Address"
                        value={newWallet.wallet}
                        onChange={(e) => setNewWallet({...newWallet, wallet: e.target.value})}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Chain</InputLabel>
                        <Select
                            value={newWallet.chain}
                            onChange={(e) => setNewWallet({...newWallet, chain: e.target.value})}
                        >
                            {CHAIN_OPTIONS.map((chain) => (<MenuItem key={chain} value={chain}>
                                    {chain}
                                </MenuItem>))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={<Checkbox
                            checked={newWallet.show_chip}
                            onChange={(e) => setNewWallet({...newWallet, show_chip: e.target.checked})}
                        />}
                        label="Show as Chip"
                    />
                    <Button onClick={handleAddWallet} startIcon={<Add/>} variant="contained">
                        Add Wallet
                    </Button>
                </Box>)}
        </Box>);
}

export default ManageWallets;