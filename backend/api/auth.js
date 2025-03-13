import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();
const router = express.Router();
const ALLOWED_WALLET = process.env.AUTHORIZED_WALLET?.toLowerCase();

router.use(cookieParser());

global.activeSession = null;
global.expectedMessages = {};

router.get("/message", (req, res) => {
    const message = `Authenticate at ${new Date().toISOString()}`;
    global.expectedMessages[req.ip] = message;
    res.json({ message });
});

router.get("/check", (req, res) => {
    const sessionToken = req.cookies?.sessionToken;

    if (!sessionToken || !global.activeSession || global.activeSession.sessionToken !== sessionToken) {
        return res.json({ success: false, error: "Not authenticated" });
    }

    if (Date.now() > global.activeSession.expiresAt) {
        global.activeSession = null;
        res.clearCookie("sessionToken");
        return res.json({ success: false, error: "Session expired" });
    }

    return res.json({ success: true, address: global.activeSession.address });
});

router.post("/login", async (req, res) => {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
        return res.status(400).json({ error: "Missing address, signature, or message" });
    }

    if (global.expectedMessages[req.ip] !== message) {
        return res.status(403).json({ error: "Invalid authentication message" });
    }

    try {
        const recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();

        if (recoveredAddress !== address.toLowerCase()) {
            return res.status(401).json({ error: "Signature verification failed" });
        }

        if (address.toLowerCase() !== ALLOWED_WALLET) {
            return res.status(403).json({ error: "Unauthorized wallet" });
        }

        const sessionToken = ethers.id(`${address}-${Date.now()}`);
        global.activeSession = { address, sessionToken, expiresAt: Date.now() + 3600000 };

        res.cookie("sessionToken", sessionToken, {
            httpOnly: true,
            secure: true, // ❗ Change to `true` in production (requires HTTPS)
            sameSite: "Lax",
            maxAge: 3600000, // 1 hour
        });

        return res.json({ success: true, address });
    } catch (error) {
        console.error("Error verifying signature:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/logout", (req, res) => {
    global.activeSession = null; // Clear session
    res.clearCookie("sessionToken");
    return res.json({ success: true, message: "Logged out" });
});

export default router;