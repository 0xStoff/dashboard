import React, { useEffect, useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import WalletOutlined from "@mui/icons-material/WalletOutlined";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    Slider,
    Stack,
    Switch,
    Tab,
    Tabs,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import ManageWallets from "./ManageWallets";
import { DashboardSettings, useDashboardSettings } from "../../context/DashboardSettingsContext";

interface SettingsDialogProps {
    openSettings: boolean;
    setOpenSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

const visibilityMarks = [
    { value: 0, label: "$0" },
    { value: 25, label: "$25" },
    { value: 50, label: "$50" },
    { value: 100, label: "$100" },
];

const SettingSection: React.FC<{
    title: string;
    description: string;
    children: React.ReactNode;
}> = ({ title, description, children }) => (
    <Box sx={{ py: 2.25, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(220px, .8fr)" }, gap: { xs: 1.5, sm: 3 }, alignItems: "center" }}>
        <Box>
            <Typography fontWeight={760}>{title}</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.35}>{description}</Typography>
        </Box>
        <Box>{children}</Box>
    </Box>
);

const VisibilitySlider: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
    <Box sx={{ px: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
            {label}
        </Typography>
        <Slider
            value={value}
            onChange={(_event, nextValue) => onChange(Number(nextValue))}
            min={0}
            max={100}
            step={1}
            marks={visibilityMarks}
            valueLabelDisplay="auto"
            valueLabelFormat={(nextValue) => `$${nextValue}`}
            aria-label={`${label} visibility threshold`}
        />
    </Box>
);

function SettingsDialog({ openSettings, setOpenSettings }: SettingsDialogProps) {
    const { settings, updateSettings, reload } = useDashboardSettings();
    const [tab, setTab] = useState(0);
    const [draft, setDraft] = useState<DashboardSettings>(settings);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!openSettings) return;
        void reload();
        setError(false);
    }, [openSettings, reload]);

    useEffect(() => {
        if (openSettings) setDraft(settings);
    }, [openSettings, settings]);

    const close = () => setOpenSettings(false);

    const save = async () => {
        setSaving(true);
        setError(false);
        try {
            await updateSettings(draft);
            close();
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={openSettings} onClose={close} maxWidth="md" fullWidth PaperProps={{ sx: { overflow: "hidden" } }}>
            <DialogTitle sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                    <Typography variant="h5">Settings</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.3}>Personalize the view without changing portfolio calculations.</Typography>
                </Box>
                <IconButton aria-label="Close settings" onClick={close}><CloseRounded /></IconButton>
            </DialogTitle>
            <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ px: { xs: 2, sm: 3 }, borderBottom: "1px solid", borderColor: "divider" }}>
                <Tab icon={<TuneRounded />} iconPosition="start" label="General" />
                <Tab icon={<WalletOutlined />} iconPosition="start" label="Wallets" />
            </Tabs>
            <DialogContent sx={{ px: { xs: 2.5, sm: 3.5 }, py: 1, minHeight: 420 }}>
                {error && <Alert severity="error" sx={{ mt: 2 }}>Settings could not be saved. Your previous preferences are still active.</Alert>}
                {tab === 0 ? (
                <Box>
                        <Alert severity="info" icon={false} sx={{ mt: 2, mb: 0.5 }}>
                            Visibility thresholds are visual only. Totals, history, and performance stay complete.
                        </Alert>
                        <SettingSection title="Small balance visibility" description="Tune the minimum USD value separately for assets, protocols, and networks.">
                            <Stack spacing={2}>
                                <VisibilitySlider
                                    label="Assets"
                                    value={draft.hideSmallAssetBalances}
                                    onChange={(value) => setDraft((current) => ({ ...current, hideSmallAssetBalances: value }))}
                                />
                                <VisibilitySlider
                                    label="Protocols"
                                    value={draft.hideSmallProtocolBalances}
                                    onChange={(value) => setDraft((current) => ({ ...current, hideSmallProtocolBalances: value }))}
                                />
                                <VisibilitySlider
                                    label="Networks"
                                    value={draft.hideSmallNetworkBalances}
                                    onChange={(value) => setDraft((current) => ({ ...current, hideSmallNetworkBalances: value }))}
                                />
                            </Stack>
                        </SettingSection>
                        <Divider />
                        <SettingSection title="Default currency" description="Used everywhere, including values, charts, and tooltips.">
                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
                                value={draft.defaultCurrency}
                                onChange={(_event, value) => value && setDraft((current) => ({ ...current, defaultCurrency: value }))}
                            >
                                <ToggleButton value="$">USD</ToggleButton>
                                <ToggleButton value="CHF">CHF</ToggleButton>
                            </ToggleButtonGroup>
                        </SettingSection>
                        <Divider />
                        <SettingSection title="Wallet chips" description="Maximum wallet labels shown before the remaining-wallet tooltip.">
                            <Box sx={{ px: 1 }}>
                                <Slider
                                    value={draft.walletChipCount}
                                    onChange={(_event, value) => setDraft((current) => ({ ...current, walletChipCount: Number(value) }))}
                                    min={1}
                                    max={6}
                                    step={1}
                                    marks
                                    valueLabelDisplay="auto"
                                    aria-label="Visible wallet chips"
                                />
                            </Box>
                        </SettingSection>
                        <Divider />
                        <SettingSection title="Compact rows" description="Reduce vertical spacing in Assets and Protocols to fit more on screen.">
                            <FormControlLabel
                                control={<Switch checked={draft.compactRows} onChange={(event) => setDraft((current) => ({ ...current, compactRows: event.target.checked }))} />}
                                label={draft.compactRows ? "Compact" : "Comfortable"}
                            />
                        </SettingSection>
                    </Box>
                ) : (
                    <Box sx={{ pt: 2 }}><ManageWallets /></Box>
                )}
            </DialogContent>
            {tab === 0 && (
                <DialogActions sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.25, borderTop: "1px solid", borderColor: "divider" }}>
                    <Button onClick={close} color="inherit">Cancel</Button>
                    <Button onClick={save} variant="contained" disabled={saving}>{saving ? "Saving..." : "Save preferences"}</Button>
                </DialogActions>
            )}
        </Dialog>
    );
}

export default SettingsDialog;
