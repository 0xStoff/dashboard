import { writeSuiDataToDB } from "./token_data/sui_data.js";

try {
  const result = await writeSuiDataToDB();
  console.log(JSON.stringify({ ok: true, result }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error?.message, stack: error?.stack }, null, 2));
  process.exit(1);
}
