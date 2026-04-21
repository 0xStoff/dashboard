const withFallback = (value: string | undefined, fallback = "") => value || fallback;

export const env = {
    apiBaseUrl: withFallback(process.env.REACT_APP_API_BASE_URL),
    logoBaseUrl: withFallback(process.env.REACT_APP_LOGO_BASE_URL),
};

export const buildLogoUrl = (logoPath?: string | null) =>
    logoPath ? `${env.logoBaseUrl}${logoPath}` : "";
