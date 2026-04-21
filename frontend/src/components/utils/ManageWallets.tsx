import React, { useMemo, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    List,
    ListItem,
    MenuItem,
    Select,
    SelectChangeEvent,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { Add, ContentCopy, Delete, Edit } from "@mui/icons-material";
import { Wallet, WalletFormValues } from "../../interfaces";
import apiClient from "../../utils/api-client";
import { useWallets } from "../../context/WalletsContext";

const CHAIN_OPTIONS = ["evm", "cosmos", "sol", "sui", "aptos"] as const;

const createEmptyWalletForm = (): WalletFormValues => ({
    tag: "",
    wallet: "",
    chain: "",
    show_chip: true,
});

const toEditableWallet = (wallet: Wallet): Wallet & { show_chip: boolean } => ({
    ...wallet,
    show_chip: wallet.show_chip ?? true,
});

function shortenAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function ManageWallets() {
    const { wallets, loading: walletsLoading, fetchWallets, setWallets } = useWallets();
    const [newWallet, setNewWallet] = useState<WalletFormValues>(createEmptyWalletForm());
    const [editingWallet, setEditingWallet] = useState<(Wallet & { show_chip: boolean }) | null>(null);

    const sortedWallets = useMemo(
        () => [...wallets].sort((left, right) => left.tag.localeCompare(right.tag)),
        [wallets]
    );

    const updateNewWalletField = <K extends keyof WalletFormValues>(field: K, value: WalletFormValues[K]) => {
        setNewWallet((current) => ({ ...current, [field]: value }));
    };

    const updateEditingWalletField = <K extends keyof (Wallet & { show_chip: boolean })>(
        field: K,
        value: (Wallet & { show_chip: boolean })[K]
    ) => {
        setEditingWallet((current) => (current ? { ...current, [field]: value } : current));
    };

    const handleChainChange =
        (onChange: (value: string) => void) => (event: SelectChangeEvent<string>) => {
            onChange(event.target.value);
        };

    const handleAddWallet = async () => {
        if (!newWallet.tag.trim() || !newWallet.wallet.trim() || !newWallet.chain) {
            return;
        }

        try {
            await apiClient.post("/wallets", {
                tag: newWallet.tag.trim(),
                wallet: newWallet.wallet.trim(),
                chain: newWallet.chain,
                show_chip: newWallet.show_chip,
            });
            setNewWallet(createEmptyWalletForm());
            await fetchWallets();
        } catch (error) {
            console.error("Error adding wallet:", error);
        }
    };

    const handleEditWallet = async () => {
        if (!editingWallet || !editingWallet.tag.trim() || !editingWallet.wallet.trim() || !editingWallet.chain) {
            return;
        }

        try {
            await apiClient.put(`/wallets/${editingWallet.id}`, {
                tag: editingWallet.tag.trim(),
                wallet: editingWallet.wallet.trim(),
                chain: editingWallet.chain,
                show_chip: editingWallet.show_chip,
            });
            setEditingWallet(null);
            await fetchWallets();
        } catch (error) {
            console.error("Error updating wallet:", error);
        }
    };

    const handleDeleteWallet = async (id: number) => {
        try {
            await apiClient.delete(`/wallets/${id}`);
            await fetchWallets();
        } catch (error) {
            console.error("Error deleting wallet:", error);
        }
    };

    const handleCopyAddress = async (address: string) => {
        try {
            await navigator.clipboard.writeText(address);
        } catch (error) {
            console.error("Error copying wallet address:", error);
        }
    };

    const handleToggleShowChip = async (id: number, currentValue: boolean) => {
        const nextValue = !currentValue;

        try {
            setWallets((prevWallets) =>
                prevWallets.map((wallet) =>
                    wallet.id === id ? { ...wallet, show_chip: nextValue } : wallet
                )
            );

            await apiClient.put(`/wallets/${id}`, { show_chip: nextValue });
            await fetchWallets();
        } catch (error) {
            console.error("Error updating show_chip:", error);
            await fetchWallets();
        }
    };

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Manage Wallets
            </Typography>

            {walletsLoading ? (
                <CircularProgress />
            ) : (
                <List sx={{ maxHeight: 500, overflowY: "auto" }}>
                    {sortedWallets.map((wallet) => (
                        <ListItem
                            key={wallet.id}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                paddingY: 1,
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexGrow: 1 }}>
                                <Typography sx={{ minWidth: 80, fontWeight: 600 }}>{wallet.tag}</Typography>
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
                                <Tooltip title="Copy address">
                                    <IconButton size="small" onClick={() => handleCopyAddress(wallet.wallet)}>
                                        <ContentCopy fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Typography sx={{ color: "gray", fontSize: 14 }}>{wallet.chain}</Typography>

                                <Switch
                                    checked={wallet.show_chip ?? true}
                                    onChange={() => handleToggleShowChip(wallet.id, wallet.show_chip ?? true)}
                                    inputProps={{ "aria-label": "Toggle show chip" }}
                                />
                            </Box>

                            <Box>
                                <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => setEditingWallet(toEditableWallet(wallet))}>
                                        <Edit fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => handleDeleteWallet(wallet.id)}>
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </ListItem>
                    ))}
                </List>
            )}

            {editingWallet ? (
                <Box display="flex" flexDirection="column" gap={2} mt={2}>
                    <TextField
                        label="Wallet Tag"
                        value={editingWallet.tag}
                        onChange={(event) => updateEditingWalletField("tag", event.target.value)}
                    />
                    <TextField
                        label="Wallet Address"
                        value={editingWallet.wallet}
                        onChange={(event) => updateEditingWalletField("wallet", event.target.value)}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Chain</InputLabel>
                        <Select
                            value={editingWallet.chain}
                            label="Chain"
                            onChange={handleChainChange((value) => updateEditingWalletField("chain", value))}
                        >
                            {CHAIN_OPTIONS.map((chain) => (
                                <MenuItem key={chain} value={chain}>
                                    {chain}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={editingWallet.show_chip}
                                onChange={(event) => updateEditingWalletField("show_chip", event.target.checked)}
                            />
                        }
                        label="Show as Chip"
                    />
                    <Button onClick={handleEditWallet} variant="contained">
                        Save
                    </Button>
                </Box>
            ) : (
                <Box display="flex" flexDirection="column" gap={2} mt={2}>
                    <TextField
                        label="Wallet Tag"
                        value={newWallet.tag}
                        onChange={(event) => updateNewWalletField("tag", event.target.value)}
                    />
                    <TextField
                        label="Wallet Address"
                        value={newWallet.wallet}
                        onChange={(event) => updateNewWalletField("wallet", event.target.value)}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Chain</InputLabel>
                        <Select
                            value={newWallet.chain}
                            label="Chain"
                            onChange={handleChainChange((value) => updateNewWalletField("chain", value))}
                        >
                            {CHAIN_OPTIONS.map((chain) => (
                                <MenuItem key={chain} value={chain}>
                                    {chain}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={newWallet.show_chip}
                                onChange={(event) => updateNewWalletField("show_chip", event.target.checked)}
                            />
                        }
                        label="Show as Chip"
                    />
                    <Button onClick={handleAddWallet} startIcon={<Add />} variant="contained">
                        Add Wallet
                    </Button>
                </Box>
            )}
        </Box>
    );
}

export default ManageWallets;
