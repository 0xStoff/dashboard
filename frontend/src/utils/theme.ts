import {createTheme} from "@mui/material";

export const theme = createTheme({
    palette: {
        mode: 'dark',
    }, components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    // backgroundColor: `rgba(18, 18, 18, 0.9)`,
                },
            },
        },
    }, typography: {
        fontFamily: ['Open Sans', 'sans-serif'].join(','),
    },
});