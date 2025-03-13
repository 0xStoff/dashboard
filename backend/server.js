import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

import nonEvmRoutes from "./api/chains.js";
import chainsRoutes from "./api/chains.js";
import walletRoutes from "./api/wallets.js";
import settingsRoutes from "./api/settings.js";
import protocolsRoutes from "./api/protocols.js";
import netWorthRoutes from "./api/netWorth.js";
import tokensRoutes from "./api/tokens.js";
import transactionsRoutes from "./api/transactions.js";
import authRoutes from "./api/auth.js";
import authenticateToken from "./api/authMiddleware.js";

import sequelize from "./sequelize.js";
import WalletModel from "./models/WalletModel.js";
import TokenModel from "./models/TokenModel.js";
import WalletTokenModel from "./models/WalletTokenModel.js";
import ProtocolModel from "./models/ProtocolModel.js";
import WalletProtocolModel from "./models/WalletProtocolModel.js";

dotenv.config();

const app = express();
const port = 3000;
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 Ensure CORS allows cookies
app.use(cors({
  origin: "http://localhost:8080", // Adjust for frontend
  credentials: true // 🔴 Must be `true` to allow cookies
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(cookieParser()); // 🔴 Ensures cookies can be read

// 🔹 Store active session (TEMPORARY, use Redis or DB in production)
global.activeSession = null;

// 🔹 Authentication Routes
app.use("/api/auth", authRoutes);

// 🔹 Protected API Routes (Require Authentication)
app.use("/api", authenticateToken, chainsRoutes);
app.use("/api", authenticateToken, walletRoutes);
app.use("/api", authenticateToken, nonEvmRoutes);
app.use("/api", authenticateToken, tokensRoutes);
app.use("/api", authenticateToken, protocolsRoutes);
app.use("/api", authenticateToken, transactionsRoutes);
app.use("/api", authenticateToken, netWorthRoutes);
app.use("/api/settings", authenticateToken, settingsRoutes);

app.use("/logos", express.static(path.join(__dirname, "logos")));


// 🔹 Database Setup
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
  console.log("✅ Database synced");

  server.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
  });

}).catch(error => {
  console.error("❌ Failed to sync database:", error);
});