import cookieParser from "cookie-parser";
import express from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import UserModel from "../models/UserModel.js";

const router = express.Router();
const SESSION_COOKIE_NAME = "sessionToken";

const isAuthorizedWallet = (address) => {
    const authorizedWallet = process.env.AUTHORIZED_WALLET?.trim();
    return !authorizedWallet || authorizedWallet.toLowerCase() === address.toLowerCase();
};

router.use(cookieParser());

const createSessionPayload = (user) => ({
    user: {
        id: user.id,
        main_wallet: user.main_wallet,
    },
});

const getSessionAddress = (sessionToken) => {
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
    return decoded?.user?.main_wallet || null;
};

router.get("/check", (req, res) => {
    const sessionToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionToken) {
        return res.json({ success: false, error: "Not authenticated" });
    }

    try {
        const address = getSessionAddress(sessionToken);
        return res.json({ success: true, address });
    } catch (error) {
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.json({ success: false, error: "Session expired or invalid" });
    }
});

router.get("/message", async (req, res) => {
    const wallet = typeof req.query.wallet === "string" ? req.query.wallet : "";

    if (!wallet) {
        return res.status(400).json({ error: "Wallet address is required" });
    }

    if (!isAuthorizedWallet(wallet)) {
        return res.status(403).json({ error: "This wallet is not authorized" });
    }

    const nonce = ethers.id(Date.now().toString());
    const [user] = await UserModel.findOrCreate({
        where: { main_wallet: wallet },
        defaults: { main_wallet: wallet, nonce },
    });

    if (user.nonce !== nonce) {
        user.nonce = nonce;
        await user.save();
    }

    return res.json({ message: `Authenticate: ${user.nonce}` });
});

router.post("/login", async (req, res) => {
    const { address, signature } = req.body;

    if (!address || !signature) {
        return res.status(400).json({ error: "Missing address or signature" });
    }

    if (!isAuthorizedWallet(address)) {
        return res.status(403).json({ error: "This wallet is not authorized" });
    }

    const user = await UserModel.findOne({ where: { main_wallet: address } });

    if (!user) {
        return res.status(401).json({ error: "User not found" });
    }

    try {
        const expectedMessage = `Authenticate: ${user.nonce}`;
        const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: "Signature verification failed" });
        }

        const token = jwt.sign(createSessionPayload(user), process.env.JWT_SECRET, {
            expiresIn: "24h",
        });

        const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
        res.cookie(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: isHttps,
            // The dashboard and API are sibling subdomains and therefore
            // same-site. Lax is more reliable in Safari's privacy modes than
            // SameSite=None while still protecting cross-site requests.
            sameSite: "Lax",
            path: "/",
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.json({ success: true, address });
    } catch (error) {
        console.error("Signature verification error:", error);
        return res.status(500).json({ error: "Signature verification failed" });
    }
});

router.post("/logout", (req, res) => {
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "Lax",
        path: "/",
    });
    return res.json({ success: true, message: "Logged out" });
});

export default router;
