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


function normalizeIP(ip) {
    if (!ip) return "";
    if (ip === "::1") return "127.0.0.1"; // Convert IPv6 loopback to IPv4
    if (ip.startsWith("::ffff:")) return ip.substring(7); // Convert "::ffff:127.0.0.1" to "127.0.0.1"
    return ip;
}


router.get("/message", (req, res) => {
    const ip = normalizeIP(req.ip);
    const message = `Authenticate at ${new Date().toISOString()}`;
    global.expectedMessages[ip] = message; // Store with normalized IP
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
    const ip = normalizeIP(req.ip);

    console.log("Stored Messages:", global.expectedMessages);
    console.log("Incoming IP:", ip);
    console.log("Incoming Message:", message);

    if (!address || !signature || !message) {
        return res.status(400).json({ error: "Missing address, signature, or message" });
    }

    if (global.expectedMessages[ip] !== message) {
        return res.status(403).json({ error: "Invalid authentication message" });
    }

    try {
        const recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();

        if (recoveredAddress !== address.toLowerCase()) {
            return res.status(401).json({ error: "Signature verification failed" });
        }

        // Authentication success
        const sessionToken = ethers.id(`${address}-${Date.now()}`);
        global.activeSession = { address, sessionToken, expiresAt: Date.now() + 3600000 };

        res.cookie("sessionToken", sessionToken, {
            httpOnly: true,
            secure: true, // Ensure HTTPS is used
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