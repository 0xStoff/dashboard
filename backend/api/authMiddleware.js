import dotenv from "dotenv";
dotenv.config();


const authenticateToken = (req, res, next) => {
    if (req.path === "/message") {
        return next(); // 🔴 Allow unauthenticated access to fetch the message
    }

    const sessionToken = req.cookies?.sessionToken; // 🔴 Ensure cookies are correctly read

    if (!sessionToken) {
        return res.status(401).json({ error: "No session token provided" });
    }

    console.log("🛠 Checking active session:", global.activeSession);

    if (!global.activeSession || global.activeSession.sessionToken !== sessionToken) {
        return res.status(403).json({ error: "Invalid or expired session" });
    }

    if (Date.now() > global.activeSession.expiresAt) {
        global.activeSession = null;
        return res.status(403).json({ error: "Session expired" });
    }

    req.user = { address: global.activeSession.address };
    next();
};

export default authenticateToken;