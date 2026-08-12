import {fileURLToPath} from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_DIR = path.join(__dirname, '../logos');

if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR);
}

export const downloadLogo = async (_logoUrl, id) => {
    if (!id) return null;

    const safeId = String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${safeId}.png`;
    const logoPath = path.join(LOGO_DIR, filename);

    if (fs.existsSync(logoPath) && fs.statSync(logoPath).size > 0) {
        return filename;
    }

    return null;
};
