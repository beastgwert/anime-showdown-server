const db = require("./db/queries");
const bodyParser = require('body-parser');
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require('cookie-parser');

const corsOptions = {
    origin: ["http://localhost:5173", "https://anime-showdown.vercel.app"],
    credentials: true, // Allow cookies to be sent
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

app.get("/api/userExists", async (req, res) => {
    const playerExists = await db.isPlayer(req.query.email);
    // console.log("received request: ", playerExists);
    res.json(playerExists);
});

app.get("/api", async (req, res) => {
    const playerInfo = await db.getPlayerData(req.query.email);
    const cardInfo = await db.getCards(req.query.email);
    const stagesInfo = await db.getStagesComplete(req.query.email);
    const levelPoints = await db.getLevelPoints(req.query.email);
    const cardLevels = await db.getCardLevels(req.query.email);

    console.log("Card Info: ", cardInfo);
    console.log("Player Info: ", playerInfo);
    res.json({
        playerInfo: playerInfo,
        cardInfo: cardInfo,
        stagesInfo: stagesInfo,
        levelPoints: levelPoints,
        cardLevels: cardLevels
    });
});

app.post("/api", async (req, res) => {
    console.log("my body: ", req.body);
    await db.insertPlayer(req.body.email, req.body.username);
    await db.insertCards(req.body.email, req.body.loadoutCards, req.body.inventoryCards, req.body.cardLevels);
    await db.insertStagesComplete(req.body.email, req.body.stagesComplete);
    res.end();
});

app.post("/api/update/cards", async (req, res) => {
    await db.deleteCards(req.body.email);
    await db.insertCards(req.body.email, req.body.loadoutCards, req.body.inventoryCards, req.body.cardLevels);
    res.end();
});

app.post("/api/update/stages", async (req, res) => {
    await db.deleteStagesComplete(req.body.email);
    await db.insertStagesComplete(req.body.email, req.body.stagesComplete);
    res.end();
});

app.post("/api/update/levelPoints", async (req, res) => {
    await db.updateLevelPoints(req.body.email, req.body.levelPoints);
    res.end();
});

app.post("/api/auth/login", async (req, res) => {
    const { credential } = req.body;
    
    // Set httpOnly cookie with the JWT token
    res.cookie('auth_token', credential, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ success: true });
});

app.get("/api/auth/check", (req, res) => {
    const token = req.cookies.auth_token;
    res.json({ authenticated: !!token, token: token || null });
});

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Express app listening on port ${PORT}`));