const db = require("./db/queries");
const bodyParser = require('body-parser');
const express = require("express");
const app = express();
const cors = require("cors");
const corsOptions = {
    origin: ["http://localhost:5173"],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

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

    console.log("Card Info: ", cardInfo);
    console.log("Player Info: ", playerInfo);
    res.json({
        playerInfo: playerInfo,
        cardInfo: cardInfo,
        stagesInfo: stagesInfo,
        levelPoints: levelPoints
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Express app listening on port ${PORT}`));