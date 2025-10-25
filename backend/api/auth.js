import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import UserModel from "../models/UserModel.js";
import jwt from "jsonwebtoken"; // Import your user model

dotenv.config();
const router = express.Router();

router.use(cookieParser());


router.get("/check", (req, res) => {
    const sessionToken = req.cookies?.sessionToken;

    if (!sessionToken) {
        return res.json({ success: false, error: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
        return res.json({ success: true, address: decoded.user.main_wallet });
    } catch (error) {
        res.clearCookie("sessionToken");
        return res.json({ success: false, error: "Session expired or invalid" });
    }
});

router.get("/message", async (req, res) => {
    const { wallet } = req.query;

    if (!wallet) {
        return res.status(400).json({ error: "Wallet address is required" });
    }

    let user = await UserModel.findOne({ where: { main_wallet: wallet } });

    if (!user) {
        user = await UserModel.create({ main_wallet: wallet, nonce: ethers.id(Date.now().toString()) });
    } else {
        user.nonce = ethers.id(Date.now().toString());
        await user.save();
    }

    res.json({ message: `Authenticate: ${user.nonce}` });
});

router.post("/login", async (req, res) => {
    const { address, signature } = req.body;

    if (!address || !signature) {
        return res.status(400).json({ error: "Missing address or signature" });
    }

    const user = await UserModel.findOne({ where: { main_wallet: address } });

    if (!user) {
        return res.status(401).json({ error: "User not found" });
    }

    const expectedMessage = `Authenticate: ${user.nonce}`;

    try {
        const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: "Signature verification failed" });
        }

        const token = jwt.sign(
            { user: user },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.cookie("sessionToken", token, {
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        return res.json({ success: true, address });
    } catch (error) {
        console.error("🚨 Signature verification error:", error);
        return res.status(500).json({ error: "Signature verification failed" });
    }
});

router.post("/logout", (req, res) => {
    res.clearCookie("sessionToken");
    return res.json({ success: true, message: "Logged out" });
});

export default router;