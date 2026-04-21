import dotenv from "dotenv";

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
    "https://dashboard.stoeff.xyz",
    "http://stoffpi.local:8080",
    "http://localhost:8080",
    "http://localhost:5173",
    "http://stoffpi.local:5173",
    "http://192.168.178.37:5173",
];

const parseCorsOrigins = (value) => {
    if (!value) {
        return DEFAULT_CORS_ORIGINS;
    }

    return value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
};

export const appConfig = {
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || "0.0.0.0",
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    staticDataFilePath: process.env.STATIC_DATA_FILE_PATH || "backend/config/static-data.private.json",
};
