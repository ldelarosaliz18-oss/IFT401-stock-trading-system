const crypto = require("crypto");
const Session = require("../models/Session");

const SESSION_COOKIE = "stocktrade_session";

function cookieToken(req) {
    const value = req.headers.cookie
        ?.split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1);
    if (!value) return null;
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

async function authenticate(req, res, next) {
    try {
        const token = cookieToken(req);
        if (!token) return res.status(401).json({ error: "Please sign in to continue." });

        const session = await Session.findOne({
            token_hash: crypto.createHash("sha256").update(token).digest("hex"),
            expires_at: { $gt: new Date() }
        }).populate("user_id");

        if (!session || !session.user_id) {
            return res.status(401).json({ error: "Your session has expired. Please sign in again." });
        }

        req.user = session.user_id;
        req.sessionRecord = session;
        next();
    } catch (error) {
        next(error);
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.admin_acc !== true) {
        return res.status(403).json({ error: "Access denied. Administrator privileges required." });
    }
    next();
}

module.exports = { authenticate, requireAdmin };
