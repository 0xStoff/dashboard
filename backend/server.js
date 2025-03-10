import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nonEvmRoutes from "./api/chains.js";
import chainsRoutes from "./api/chains.js";
import walletRoutes from "./api/wallets.js";
import settingsRoutes from "./api/settings.js";
import protocolsRoutes from "./api/protocols.js";
import netWorthRoutes from "./api/netWorth.js";
import tokensRoutes from "./api/tokens.js";
import sequelize from "./sequelize.js";
import WalletModel from "./models/WalletModel.js";
import TokenModel from "./models/TokenModel.js";
import WalletTokenModel from "./models/WalletTokenModel.js";
import transactionsRoutes from "./api/transactions.js";
import path from "path";
import { fileURLToPath } from "url";
import { fetchAndSaveEvmTokenDataForAllWallets } from "./token_data/evm_token_data.js";
import { fetchCosmosTokens } from "./token_data/cosmos_token_data.js";
import { writeAptosDataToDB, writeStaticDataToDB, writeSuiDataToDB } from "./token_data/sui_data.js";
import { fetchAndSaveSolTokenDataForAllWallets } from "./token_data/sol_token_data.js";
import ProtocolModel from "./models/ProtocolModel.js";
import WalletProtocolModel from "./models/WalletProtocolModel.js";
import { Server as SocketServer } from "socket.io";
import http from "http";
import SettingsModel from "./models/SettingsModel.js";


dotenv.config();

const app = express();
const port = 3000;

const server = http.createServer(app);
// const io = new SocketServer(server, {
//   cors: {
//     origin: "*", methods: ["GET", "POST"]
//   },
//   transports: ["websocket", "polling"],
// });


// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

app.use("/api", chainsRoutes);
app.use("/api", walletRoutes);
app.use("/api", nonEvmRoutes);
app.use("/api", tokensRoutes);
app.use("/api", protocolsRoutes);
app.use("/api", transactionsRoutes);
app.use("/api", netWorthRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/logos", express.static(path.join(__dirname, "logos")));

// const runAllTokenDataFunctions = async (socket) => {
//   try {
//     socket.emit("progress", { status: "Starting token data updates..." });
//
//     await Promise.all([(async () => {
//       socket.emit("progress", { status: "Fetching other token data..." });
//       await writeStaticDataToDB();
//       await writeAptosDataToDB();
//       await writeSuiDataToDB();
//       await fetchAndSaveSolTokenDataForAllWallets();
//       await fetchCosmosTokens();
//
//       socket.emit("progress", { status: "✅ Other token data fetched" });
//     })(), (async () => {
//       socket.emit("progress", { status: "Fetching EVM token data..." });
//       await fetchAndSaveEvmTokenDataForAllWallets();
//       socket.emit("progress", { status: "✅ EVM token data fetched" });
//     })()]);
//
//
//     socket.emit("progress", { status: "🎉 All Token Data Fetched Successfully!" });
//   } catch (error) {
//     socket.emit("progress", { status: "Error executing token data functions.", error: error.message });
//     console.error("Error executing token data functions:", error);
//   }
// };

// io.on("connection", (socket) => {
//   console.log("A client connected:", socket.id);
//
//   socket.on("runAllTokenDataFunctions", async () => {
//     await runAllTokenDataFunctions(socket);
//   });
//
//   socket.on("disconnect", () => {
//     console.log("A client disconnected:", socket.id);
//   });
// });


// Set up associations after all models are defined
const setupAssociations = () => {
  WalletModel.belongsToMany(TokenModel, { through: WalletTokenModel, foreignKey: "wallet_id" });
  TokenModel.belongsToMany(WalletModel, { through: WalletTokenModel, foreignKey: "token_id" });
  WalletModel.belongsToMany(ProtocolModel, { through: WalletProtocolModel, foreignKey: "wallet_id" });
  ProtocolModel.belongsToMany(WalletModel, { through: WalletProtocolModel, foreignKey: "protocol_id" });
};

const initDb = async () => {
  setupAssociations();
  await sequelize.sync();
};

initDb().then(() => {
  console.log("Database synced");

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);

  });


}).catch(error => {
  console.error("Failed to sync database:", error);
});

