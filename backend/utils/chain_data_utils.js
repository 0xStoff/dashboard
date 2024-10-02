import {fileURLToPath} from "url";
import path from "path";
import fs from "fs";
import axios from "axios";
import {pool} from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_DIR = path.join(__dirname, '../logos');

if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR);
}

const downloadLogo = async (logoUrl, chainId) => {
    const logoPath = path.join(LOGO_DIR, `${chainId}.png`);
    const writer = fs.createWriteStream(logoPath);

    try {
        const response = await axios({
            url: logoUrl,
            method: 'GET',
            responseType: 'stream',
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(logoPath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading logo for chain ${chainId}: ${error.message}`);
        return path.join(LOGO_DIR, 'default.png');
    }
};

const insertOrUpdateChain = async (table, columns, values) => {
    const query = `
        INSERT INTO ${table} (${columns.join(", ")})
        VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")})
        ON CONFLICT (chain_id)
        DO UPDATE SET ${columns.slice(1).map((col, i) => `${col} = $${i + 2}`).join(", ")}
    `;

    await pool.query(query, values);
};

const updateChainData = async (chains, tableName, columns) => {
    try {
        const updatePromises = chains.map(async (chain) => {
            let logoPath = null;
            try {
                logoPath = await downloadLogo(chain.logo_url, chain.id);
            } catch (error) {
                console.error(`Error downloading logo for chain ${chain.id}:`, error);
            }

            const values = tableName === 'evm_chains'
                ? [chain.id, chain.name, chain.native_token_id, chain.wrapped_token_id, logoPath]
                : [chain.id, chain.name, chain.symbol, chain.decimals, chain.endpoint, logoPath];

            await insertOrUpdateChain(tableName, columns, values);
        });

        await Promise.all(updatePromises);
        console.log(`${tableName} data updated successfully`);
    } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        throw new Error(`Failed to update ${tableName}`);
    }
};

export const updateChainsData = (chains) => updateChainData(chains, 'evm_chains', ['chain_id', 'name', 'native_token_id', 'wrapped_token_id', 'logo_path']);
export const updateNonEvmChainsData = (chains) => updateChainData(chains, 'non_evm_chains', ['chain_id', 'name', 'symbol', 'decimals', 'endpoint', 'logo_path']);