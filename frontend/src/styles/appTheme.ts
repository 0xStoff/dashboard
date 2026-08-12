import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#8b7cff", light: "#b8afff", dark: "#6657df" },
        secondary: { main: "#5de4c7" },
        success: { main: "#5de4a8" },
        error: { main: "#ff7085" },
        background: { default: "#090b12", paper: "#12151f" },
        text: { primary: "#f4f5fb", secondary: "#969cad" },
        divider: "rgba(255,255,255,0.07)",
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundImage:
                        "radial-gradient(circle at 12% -8%, rgba(139,124,255,.14), transparent 30%), radial-gradient(circle at 92% 2%, rgba(93,228,199,.075), transparent 25%), linear-gradient(180deg, #090b12 0%, #0b0e16 100%)",
                    backgroundAttachment: "fixed",
                    minHeight: "100vh",
                    fontVariantNumeric: "tabular-nums",
                },
                "*": {
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(139,124,255,.35) transparent",
                },
                "::selection": { background: "rgba(139,124,255,.35)" },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: "rgba(18,21,31,.88)",
                    backgroundImage: "linear-gradient(145deg, rgba(255,255,255,.032), transparent 58%)",
                    border: "1px solid rgba(255,255,255,.07)",
                    boxShadow: "0 14px 42px rgba(0,0,0,.18)",
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: "none", border: "1px solid rgba(255,255,255,.07)" },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: { borderRadius: 12, textTransform: "none", fontWeight: 700 },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    transition: "background-color .2s, transform .2s",
                    "&:hover": { transform: "translateY(-1px)" },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 10, fontWeight: 650 },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: { borderColor: "rgba(255,255,255,.055)" },
                head: { color: "#969cad", fontWeight: 720, backgroundColor: "rgba(18,21,31,.96)" },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    "&.Mui-selected, &.Mui-selected:hover": {
                        backgroundColor: "rgba(139,124,255,.09)",
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: { borderRadius: 20, boxShadow: "0 30px 90px rgba(0,0,0,.55)" },
            },
        },
    },
    typography: {
        fontFamily: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"].join(","),
        h2: { fontWeight: 750, letterSpacing: "-0.055em" },
        h4: { fontWeight: 750, letterSpacing: "-0.035em" },
        h5: { fontWeight: 720, letterSpacing: "-0.025em" },
        button: { fontWeight: 700 },
    },
    shape: { borderRadius: 16 },
});
