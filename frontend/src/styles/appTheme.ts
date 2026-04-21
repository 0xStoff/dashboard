import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
    palette: {
        mode: "dark",
    },
    typography: {
        fontFamily: ["Open Sans", "sans-serif"].join(","),
    },
});
