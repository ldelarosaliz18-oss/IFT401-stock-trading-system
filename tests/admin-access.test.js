const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const express = require("express");
const path = require("path");
const Session = require("../models/Session");
const api = require("../routes/api");
const { authenticate, requireAdmin } = require("../middleware/auth");

test("stock management page and privileged API routes require admin", async () => {
    const originalFindOne = Session.findOne;
    const token = "test-cookie-token";
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    let activeUser = null;
    Session.findOne = (query) => {
        assert.equal(query.token_hash, hash);
        return { populate: async () => ({ user_id: activeUser, expires_at: new Date(Date.now() + 10000) }) };
    };

    const app = express();
    app.use(express.json());
    app.use("/api", api);
    app.get("/stock-management.html", authenticate, requireAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, "..", "private", "stock-management.html"));
    });
    app.use(express.static(path.join(__dirname, "..", "site")));
    const server = app.listen(0);
    try {
        await new Promise((resolve) => server.once("listening", resolve));
        const url = `http://127.0.0.1:${server.address().port}`;
        const call = (route, method = "GET", withCookie = true) => fetch(url + route, {
            method,
            headers: withCookie ? { Cookie: `stocktrade_session=${token}` } : {}
        });

        assert.equal((await call("/stock-management.html", "GET", false)).status, 401);
        activeUser = { _id: "test-id", admin_acc: false };
        assert.equal((await call("/stock-management.html")).status, 403);
        for (const [route, method] of [
            ["/api/market/stocks", "POST"],
            ["/api/market/stocks/123", "PUT"],
            ["/api/market/stocks/123", "DELETE"],
            ["/api/market/schedule", "PUT"],
            ["/api/market/clock", "PUT"]
        ]) {
            assert.equal((await call(route, method)).status, 403, `${method} ${route}`);
        }
        assert.equal((await call("/private/stock-management.html")).status, 404);
        activeUser = { _id: "test-id", admin_acc: true };
        const response = await call("/stock-management.html");
        assert.equal(response.status, 200);
        assert.match(await response.text(), /Stock Creator/);
    } finally {
        Session.findOne = originalFindOne;
        await new Promise((resolve) => server.close(resolve));
    }
});
