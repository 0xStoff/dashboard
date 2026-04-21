import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { appConfig } from "./appConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_STATIC_DATA = {
    aptos: null,
    sui: null,
    cosmosAddressOverrides: {},
    staticChains: [],
};

const resolveConfigPath = (configPath) => {
    if (path.isAbsolute(configPath)) {
        return configPath;
    }

    return path.resolve(__dirname, "..", "..", configPath);
};

const loadStaticData = () => {
    const resolvedPath = resolveConfigPath(appConfig.staticDataFilePath);

    if (!fs.existsSync(resolvedPath)) {
        return DEFAULT_STATIC_DATA;
    }

    try {
        const raw = fs.readFileSync(resolvedPath, "utf8");
        const parsed = JSON.parse(raw);

        return {
            aptos: parsed.aptos || null,
            sui: parsed.sui || null,
            cosmosAddressOverrides:
                parsed.cosmosAddressOverrides && typeof parsed.cosmosAddressOverrides === "object"
                    ? parsed.cosmosAddressOverrides
                    : {},
            staticChains: Array.isArray(parsed.staticChains) ? parsed.staticChains : [],
        };
    } catch (error) {
        console.error(`Failed to read static data from ${resolvedPath}:`, error);
        return DEFAULT_STATIC_DATA;
    }
};

export const staticDataConfig = loadStaticData();
