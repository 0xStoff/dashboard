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


    return new Promise((resolve) => {
      resolve(`${id}.png`)
    });
    //
    // const logoPath = path.join(LOGO_DIR, `${id}.png`);
    //
    // const writer = fs.createWriteStream(logoPath);
    //
    // try {
    //     const response = await axios({
    //         url: logoUrl,
    //         method: 'GET',
    //         responseType: 'stream',
    //     });
    //
    //     response.data.pipe(writer);
    //
    //     return new Promise((resolve, reject) => {
    //         writer.on('finish', () => resolve(`${id}.png`));
    //         writer.on('error', reject);
    //     });
    // } catch (error) {
    //     console.error(`Error downloading logo for chain ${id}: ${error.message}`);
    //     return path.join(LOGO_DIR, 'default.png');
    // }
};
