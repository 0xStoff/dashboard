import {fileURLToPath} from "url";
import path from "path";
import fs from "fs";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_DIR = path.join(__dirname, '../logos');

if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR);
}

export const downloadLogo = async (logoUrl, id) => {
    if (!logoUrl || !id) return null;

    const safeId = String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${safeId}.png`;
    const logoPath = path.join(LOGO_DIR, filename);

    if (fs.existsSync(logoPath) && fs.statSync(logoPath).size > 0) {
        return filename;
    }

    try {
        const parsedUrl = new URL(logoUrl);
        if (parsedUrl.protocol !== 'https:') {
            throw new Error('Logo URL must use HTTPS');
        }

        const response = await axios.get(logoUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: 2 * 1024 * 1024,
            headers: {Accept: 'image/*'},
        });

        const contentType = response.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
            throw new Error(`Unexpected content type: ${contentType}`);
        }

        const temporaryPath = `${logoPath}.tmp`;
        await fs.promises.writeFile(temporaryPath, response.data);
        await fs.promises.rename(temporaryPath, logoPath);
        return filename;
    } catch (error) {
        console.error(`Error downloading logo for ${id}: ${error.message}`);
        return null;
    }
};
