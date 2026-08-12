import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

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
import { appConfig } from "./config/appConfig.js";
import robinhoodPerformanceRoutes from "./api/robinhoodPerformance.js";
import dashboardSnapshotRoutes from "./api/dashboardSnapshot.js";
import poolRadarRoutes from "./api/poolRadar.js";
import { startPoolRadarIndexer } from "./services/poolRadarService.js";
import { runMigrations } from "./db/migrate.js";
import { setupAssociations } from "./models/associations.js";
import { markInterruptedRefreshJobs } from "./services/refreshJobService.js";

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
    cors({
        origin: appConfig.corsOrigins,
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api", authenticateToken, chainsRoutes);
app.use("/api", authenticateToken, walletRoutes);
app.use("/api", authenticateToken, tokensRoutes);
app.use("/api", authenticateToken, protocolsRoutes);
app.use("/api", authenticateToken, transactionsRoutes);
app.use("/api", authenticateToken, netWorthRoutes);
app.use("/api", authenticateToken, robinhoodPerformanceRoutes);
app.use("/api", authenticateToken, dashboardSnapshotRoutes);
app.use("/api", authenticateToken, poolRadarRoutes);
app.use("/api/settings", authenticateToken, settingsRoutes);
app.use("/logos", express.static(path.join(__dirname, "logos")));

const initDb = async () => {
    setupAssociations();
    await sequelize.sync();
    await runMigrations();
    await markInterruptedRefreshJobs();
};

initDb()
    .then(() => {
        console.log("Database synced");
        startPoolRadarIndexer();

        server.listen(appConfig.port, appConfig.host, () => {
            console.log(`Server running on ${appConfig.host}:${appConfig.port}`);
        });
    })
    .catch((error) => {
        console.error("Failed to sync database:", error);
    });
