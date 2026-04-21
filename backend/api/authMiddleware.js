import jwt from "jsonwebtoken";

const authenticateToken = (req, res, next) => {
    if (req.path === "/message") {
        return next();
    }

    const sessionToken = req.cookies?.sessionToken;

    if (!sessionToken) {
        return res.status(401).json({ error: "No session token provided" });
    }

    try {
        req.user = jwt.verify(sessionToken, process.env.JWT_SECRET);
        return next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired session" });
    }
};

export default authenticateToken;
