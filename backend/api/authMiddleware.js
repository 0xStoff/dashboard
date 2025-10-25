import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET

const authenticateToken = (req, res, next) => {
    if (req.path === "/message") {
        return next();
    }

    const sessionToken = req.cookies?.sessionToken;

    if (!sessionToken) {
        return res.status(401).json({ error: "No session token provided" });
    }

    try {
        const decoded = jwt.verify(sessionToken, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired session" });
    }
};



export default authenticateToken;