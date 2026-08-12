import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    AddRounded,
    ContentCopyRounded,
    DeleteOutlineRounded,
    EditRounded,
    SearchRounded,
    WalletOutlined,
} from "@mui/icons-material";
import { Wallet, WalletFormValues } from "../../interfaces";
import apiClient from "../../utils/api-client";
import { useWallets } from "../../context/WalletsContext";
import { formatNumber } from "../../utils/number-utils";

const CHAIN_OPTIONS = ["evm", "cosmos", "sol", "sui", "aptos"] as const;
const CHAIN_LABELS: Record<string, string> = {
    evm: "EVM",
    cosmos: "Cosmos",
    sol: "Solana",
    sui: "Sui",
    aptos: "Aptos",
};

type FeedbackState = {
    severity: "success" | "error" | "info";
    message: string;
} | null;

const createEmptyWalletForm = (): WalletFormValues => ({
    tag: "",
    wallet: "",
    chain: "",
    show_chip: true,
    group_name: "",
    refresh_policy: "auto",
});

const toEditableWallet = (wallet: Wallet): WalletFormValues => ({
    tag: wallet.tag,
    wallet: wallet.wallet,
    chain: wallet.chain,
    show_chip: wallet.show_chip ?? true,
    group_name: wallet.group_name || "",
    refresh_policy: wallet.refresh_policy || "auto",
});

function shortenAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function normalizeAddress(address: string) {
    return address.trim().toLowerCase();
}

function ManageWallets() {
    const { wallets, loading: walletsLoading, fetchWallets, setWallets } = useWallets();
    const [form, setForm] = useState<WalletFormValues>(createEmptyWalletForm());
    const [editingWalletId, setEditingWalletId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [chainFilter, setChainFilter] = useState("all");
    const [groupFilter, setGroupFilter] = useState("all");
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackState>(null);

    const sortedWallets = useMemo(
        () => [...wallets].sort((left, right) =>
            (left.group_name || "Ungrouped").localeCompare(right.group_name || "Ungrouped") || left.tag.localeCompare(right.tag)
        ),
        [wallets]
    );

    const filteredWallets = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();
        return sortedWallets.filter((wallet) => {
            const matchesChain = chainFilter === "all" || wallet.chain === chainFilter;
            const matchesGroup = groupFilter === "all" || (wallet.group_name || "Ungrouped") === groupFilter;
            const matchesSearch =
                !normalizedSearch ||
                wallet.tag.toLowerCase().includes(normalizedSearch) ||
                wallet.wallet.toLowerCase().includes(normalizedSearch);
            return matchesChain && matchesGroup && matchesSearch;
        });
    }, [chainFilter, groupFilter, searchQuery, sortedWallets]);

    const groupOptions = useMemo(
        () => Array.from(new Set(wallets.map((wallet) => wallet.group_name || "Ungrouped"))).sort((left, right) => left.localeCompare(right)),
        [wallets]
    );

    const editingWallet = useMemo(
        () => wallets.find((wallet) => wallet.id === editingWalletId) ?? null,
        [editingWalletId, wallets]
    );

    const visibleChipCount = wallets.filter((wallet) => wallet.show_chip ?? true).length;
    const hiddenChipCount = wallets.length - visibleChipCount;
    const duplicateWallet = wallets.find((wallet) =>
        wallet.id !== editingWalletId &&
        wallet.chain === form.chain &&
        normalizeAddress(wallet.wallet) === normalizeAddress(form.wallet)
    );
    const canSubmit = Boolean(form.tag.trim() && form.wallet.trim() && form.chain) && !duplicateWallet;

    useEffect(() => {
        if (!editingWallet) return;
        setForm(toEditableWallet(editingWallet));
    }, [editingWallet]);

    const updateFormField = <K extends keyof WalletFormValues>(field: K, value: WalletFormValues[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleChainChange = (event: SelectChangeEvent<string>) => {
        updateFormField("chain", event.target.value);
    };

    const resetForm = () => {
        setEditingWalletId(null);
        setForm(createEmptyWalletForm());
    };

    const handleSaveWallet = async () => {
        if (!canSubmit) return;

        setSubmitting(true);
        setFeedback(null);
        try {
            const payload = {
                tag: form.tag.trim(),
                wallet: form.wallet.trim(),
                chain: form.chain,
                show_chip: form.show_chip,
                group_name: form.group_name,
                refresh_policy: form.refresh_policy,
            };
            if (editingWalletId) {
                await apiClient.put(`/wallets/${editingWalletId}`, payload);
                setFeedback({ severity: "success", message: "Wallet updated." });
            } else {
                await apiClient.post("/wallets", payload);
                setFeedback({ severity: "success", message: "Wallet added." });
            }
            resetForm();
            await fetchWallets();
        } catch (error) {
            console.error("Error saving wallet:", error);
            setFeedback({ severity: "error", message: "Wallet could not be saved." });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteWallet = async (wallet: Wallet) => {
        const confirmed = globalThis.confirm?.(`Delete wallet ${wallet.tag}?`);
        if (!confirmed) return;

        setFeedback(null);
        try {
            await apiClient.delete(`/wallets/${wallet.id}`);
            if (editingWalletId === wallet.id) resetForm();
            setFeedback({ severity: "success", message: `${wallet.tag} removed.` });
            await fetchWallets();
        } catch (error) {
            console.error("Error deleting wallet:", error);
            setFeedback({ severity: "error", message: "Wallet could not be deleted." });
        }
    };

    const handleCopyAddress = async (address: string) => {
        try {
            await navigator.clipboard.writeText(address);
            setFeedback({ severity: "info", message: "Wallet address copied." });
        } catch (error) {
            console.error("Error copying wallet address:", error);
            setFeedback({ severity: "error", message: "Clipboard copy failed." });
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
            setFeedback({ severity: "error", message: "Chip visibility could not be updated." });
            await fetchWallets();
        }
    };

    return (
        <Box>
            <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1.5}
                mb={2.5}
            >
                <Box>
                    <Typography variant="h6">Wallet control center</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Add, edit, refetch, and tune chip visibility without leaving the dashboard.
                    </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 330 }}>
                    Use the header refresh menu for progress and selected-wallet refreshes. Audit-only wallets never run in the routine paid-API pass.
                </Typography>
            </Stack>

            {feedback && <Alert severity={feedback.severity} sx={{ mb: 2 }}>{feedback.message}</Alert>}

            <Box
                sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.35fr) minmax(340px, .95fr)" },
                }}
            >
                <Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
                        <Card sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.02)" }}>
                            <CardContent>
                                <Typography
                                    variant="overline"
                                    color="text.secondary"
                                    sx={{ display: "block", lineHeight: 1.2, letterSpacing: ".08em", whiteSpace: "nowrap" }}
                                >
                                    Wallets
                                </Typography>
                                <Typography variant="h5" fontWeight={780}>{wallets.length}</Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.02)" }}>
                            <CardContent>
                                <Typography
                                    variant="overline"
                                    color="text.secondary"
                                    sx={{ display: "block", lineHeight: 1.2, letterSpacing: ".08em", whiteSpace: "nowrap" }}
                                >
                                    Visible chips
                                </Typography>
                                <Typography variant="h5" fontWeight={780}>{visibleChipCount}</Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.02)" }}>
                            <CardContent>
                                <Typography
                                    variant="overline"
                                    color="text.secondary"
                                    sx={{ display: "block", lineHeight: 1.2, letterSpacing: ".08em", whiteSpace: "nowrap" }}
                                >
                                    Hidden chips
                                </Typography>
                                <Typography variant="h5" fontWeight={780}>{hiddenChipCount}</Typography>
                            </CardContent>
                        </Card>
                    </Stack>

                    <Card sx={{ bgcolor: "rgba(255,255,255,0.02)" }}>
                        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search tag or address"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchRounded fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 180 } }}>
                                    <InputLabel>Chain</InputLabel>
                                    <Select
                                        value={chainFilter}
                                        label="Chain"
                                        onChange={(event) => setChainFilter(event.target.value)}
                                    >
                                        <MenuItem value="all">All chains</MenuItem>
                                        {CHAIN_OPTIONS.map((chain) => (
                                            <MenuItem key={chain} value={chain}>{CHAIN_LABELS[chain]}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 180 } }}>
                                    <InputLabel>Group</InputLabel>
                                    <Select value={groupFilter} label="Group" onChange={(event) => setGroupFilter(event.target.value)}>
                                        <MenuItem value="all">All groups</MenuItem>
                                        {groupOptions.map((group) => <MenuItem key={group} value={group}>{group}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Stack>

                            {walletsLoading ? (
                                <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
                                    <CircularProgress />
                                </Box>
                            ) : filteredWallets.length === 0 ? (
                                <Box sx={{ py: 6, textAlign: "center" }}>
                                    <WalletOutlined color="disabled" sx={{ fontSize: 36, mb: 1 }} />
                                    <Typography fontWeight={700}>No wallets match this view.</Typography>
                                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                                        Clear the search or add another wallet on the right.
                                    </Typography>
                                </Box>
                            ) : (
                                <Stack spacing={1.25}>
                                    {filteredWallets.map((wallet) => (
                                        <Card
                                            key={wallet.id}
                                            variant="outlined"
                                            sx={{
                                                bgcolor: editingWalletId === wallet.id ? "rgba(132, 105, 255, 0.08)" : "transparent",
                                                borderColor: editingWalletId === wallet.id ? "rgba(132, 105, 255, 0.35)" : "divider",
                                            }}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Stack
                                                    direction={{ xs: "column", lg: "row" }}
                                                    justifyContent="space-between"
                                                    spacing={1.5}
                                                >
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                            <Typography fontWeight={760}>{wallet.tag}</Typography>
                                                            <Chip size="small" label={CHAIN_LABELS[wallet.chain] || wallet.chain} />
                                                             {wallet.group_name && <Chip size="small" variant="outlined" label={wallet.group_name} />}
                                                             {wallet.refresh_policy && wallet.refresh_policy !== "auto" && (
                                                                 <Chip size="small" color="warning" variant="outlined" label={wallet.refresh_policy === "audit-only" ? "Audit-only refresh" : "Manual refresh"} />
                                                             )}
                                                            <Chip
                                                                size="small"
                                                                color={wallet.show_chip ?? true ? "success" : "default"}
                                                                label={wallet.show_chip ?? true ? "Chip visible" : "Chip hidden"}
                                                            />
                                                        </Stack>
                                                        <Tooltip title={wallet.wallet} arrow>
                                                            <Typography
                                                                mt={1}
                                                                sx={{
                                                                    fontFamily: "monospace",
                                                                    fontSize: 13,
                                                                    color: "text.secondary",
                                                                    wordBreak: "break-all",
                                                                }}
                                                            >
                                                                {wallet.wallet.length > 24 ? shortenAddress(wallet.wallet) : wallet.wallet}
                                                            </Typography>
                                                        </Tooltip>
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{ display: "block", mt: 0.55, opacity: 0.62 }}
                                                        >
                                                            ≈ ${formatNumber(Number(wallet.approximate_usd_value || 0), "axis")}
                                                            {Number(wallet.valuation?.estimated_usd_value || 0) > 0 ? " · includes estimate" : ""}
                                                        </Typography>
                                                    </Box>
                                                    <Stack
                                                        spacing={1.2}
                                                        alignItems={{ xs: "flex-start", lg: "flex-end" }}
                                                        sx={{ minWidth: { lg: 190 } }}
                                                    >
                                                        <FormControlLabel
                                                            sx={{ mr: 0 }}
                                                            control={
                                                                <Switch
                                                                    checked={wallet.show_chip ?? true}
                                                                    onChange={() => handleToggleShowChip(wallet.id, wallet.show_chip ?? true)}
                                                                />
                                                            }
                                                            label="Show chip"
                                                        />
                                                        <Stack direction="row" spacing={0.5}>
                                                            <Tooltip title="Copy address">
                                                                <IconButton onClick={() => handleCopyAddress(wallet.wallet)}>
                                                                    <ContentCopyRounded fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Edit wallet">
                                                                <IconButton onClick={() => setEditingWalletId(wallet.id)}>
                                                                    <EditRounded fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete wallet">
                                                                <IconButton onClick={() => handleDeleteWallet(wallet)}>
                                                                    <DeleteOutlineRounded fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </Stack>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                </Box>

                <Card sx={{ bgcolor: "rgba(255,255,255,0.02)", alignSelf: "start" }}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Box>
                                <Typography variant="h6">{editingWalletId ? "Edit wallet" : "Add wallet"}</Typography>
                                <Typography variant="body2" color="text.secondary" mt={0.4}>
                                    {editingWalletId ? "Update the selected wallet and save changes." : "Add a new wallet and choose whether it appears as a quick chip."}
                                </Typography>
                            </Box>
                            {editingWalletId ? (
                                <Button color="inherit" onClick={resetForm}>Cancel</Button>
                            ) : (
                                <Button startIcon={<AddRounded />} onClick={resetForm}>New</Button>
                            )}
                        </Stack>

                        <Divider sx={{ my: 2 }} />

                        <Stack spacing={2}>
                            <TextField
                                label="Wallet tag"
                                value={form.tag}
                                onChange={(event) => updateFormField("tag", event.target.value)}
                                placeholder="Red 25"
                            />
                            <TextField
                                label="Group"
                                value={form.group_name}
                                onChange={(event) => updateFormField("group_name", event.target.value)}
                                placeholder="Ledger, Browser wallet, AI agents..."
                                helperText="Optional — use the same name to organize wallets together."
                            />
                            <FormControl fullWidth>
                                <InputLabel>Refresh policy</InputLabel>
                                <Select
                                    value={form.refresh_policy || "auto"}
                                    label="Refresh policy"
                                    onChange={(event) => updateFormField("refresh_policy", event.target.value as WalletFormValues["refresh_policy"])}
                                >
                                    <MenuItem value="auto">Routine — included in Refetch all</MenuItem>
                                    <MenuItem value="manual">Manual — only when selected</MenuItem>
                                    <MenuItem value="audit-only">Audit-only — preserved history, only when selected</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label="Wallet address"
                                value={form.wallet}
                                onChange={(event) => updateFormField("wallet", event.target.value)}
                                placeholder="0x..., cosmos..., sui..., aptos..."
                                multiline
                                minRows={2}
                            />
                            <FormControl fullWidth>
                                <InputLabel>Chain</InputLabel>
                                <Select value={form.chain} label="Chain" onChange={handleChainChange}>
                                    {CHAIN_OPTIONS.map((chain) => (
                                        <MenuItem key={chain} value={chain}>{CHAIN_LABELS[chain]}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.show_chip}
                                        onChange={(event) => updateFormField("show_chip", event.target.checked)}
                                    />
                                }
                                label="Show this wallet as a chip in tables"
                            />

                            {duplicateWallet && (
                                <Alert severity="warning">
                                    This wallet already exists as {duplicateWallet.tag} on {CHAIN_LABELS[duplicateWallet.chain] || duplicateWallet.chain}.
                                </Alert>
                            )}

                            <Button
                                onClick={handleSaveWallet}
                                startIcon={editingWalletId ? <EditRounded /> : <AddRounded />}
                                variant="contained"
                                disabled={!canSubmit || submitting}
                            >
                                {submitting ? "Saving..." : editingWalletId ? "Save changes" : "Add wallet"}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}

export default ManageWallets;
