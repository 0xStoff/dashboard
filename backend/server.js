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
import UserModel from "./models/UserModel.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const port = 3000;
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
    origin: ["http://stoffpi.local:8080", "http://localhost:8080", 'http://localhost:5173', 'http://stoffpi.local:5173', 'http://192.168.178.37:5173'],
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(cookieParser()); // 🔴 Enables reading cookies for JWT auth

app.use("/api/auth", authRoutes);

app.use("/api", authenticateToken, chainsRoutes);
app.use("/api", authenticateToken, walletRoutes);
app.use("/api", authenticateToken, nonEvmRoutes);
app.use("/api", authenticateToken, tokensRoutes);
app.use("/api", authenticateToken, protocolsRoutes);
app.use("/api", authenticateToken, transactionsRoutes);
app.use("/api", authenticateToken, netWorthRoutes);
app.use("/api/settings", authenticateToken, settingsRoutes);

app.use("/logos", express.static(path.join(__dirname, "logos")));

// 🔹 Setup Database Associations
const setupAssociations = () => {
    UserModel.hasMany(WalletModel, { foreignKey: "user_id" });
    WalletModel.belongsTo(UserModel, { foreignKey: "user_id" });
    WalletModel.belongsToMany(TokenModel, { through: WalletTokenModel, foreignKey: "wallet_id" });
    TokenModel.belongsToMany(WalletModel, { through: WalletTokenModel, foreignKey: "token_id" });
    WalletModel.belongsToMany(ProtocolModel, { through: WalletProtocolModel, foreignKey: "wallet_id" });
    ProtocolModel.belongsToMany(WalletModel, { through: WalletProtocolModel, foreignKey: "protocol_id" });
    UserModel.hasMany(WalletTokenModel, { foreignKey: "user_id" });
    WalletTokenModel.belongsTo(UserModel, { foreignKey: "user_id" });
    UserModel.hasMany(WalletProtocolModel, { foreignKey: "user_id" });
    WalletProtocolModel.belongsTo(UserModel, { foreignKey: "user_id" });
};

const initDb = async () => {
    setupAssociations();
    await sequelize.sync();
};

initDb().then(() => {
    console.log("✅ Database synced");

    server.listen(port, "0.0.0.0", () => {
        console.log(`✅ Server running on port ${port}`);
    });

}).catch(error => {
    console.error("❌ Failed to sync database:", error);
});