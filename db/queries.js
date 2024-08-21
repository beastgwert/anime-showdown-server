const pool = require('./pool');


async function isPlayer(email){
    const playerExists = await pool.query('SELECT * FROM players WHERE email = ($1)', [email]);
    console.log("my player info: ", playerExists);
    return playerExists.rowCount > 0;
}

async function getPlayerData(email){
    const playerInfo = await pool.query('SELECT * FROM players WHERE email = ($1)', [email]);
    return playerInfo.rows[0];
}

async function getCards(email){
    const loadoutInfo = await pool.query('SELECT anime_character FROM loadoutCards WHERE email = ($1)', [email]);
    const inventoryInfo = await pool.query('SELECT anime_character FROM inventoryCards WHERE email = ($1)', [email]);
    const loadoutArray = loadoutInfo.rows.map(obj => obj.anime_character);
    const inventoryArray = inventoryInfo.rows.map(obj => obj.anime_character);
    return {
        loadout: loadoutArray,
        inventory: inventoryArray
    }
}

async function getStagesComplete(email){
    const stagesInfo = await pool.query('SELECT stage FROM stagesComplete WHERE email = ($1)', [email]);
    const stagesArray = stagesInfo.rows.map(obj => obj.stage);
    return stagesArray;
}

async function getLevelPoints(email){
    const levelPoints = await pool.query('SELECT level_points FROM players WHERE email = ($1)', [email]);
    const pointsArray = levelPoints.rows.map(obj => obj.level_points);
    return pointsArray;
}

async function insertPlayer(email, username){
    await pool.query("INSERT INTO players (email, username, level_points) VALUES ($1, $2, 0)", [email, username]);
}

async function insertCards(email, loadoutCards, inventoryCards, cardLevels){
    console.log("loadout cards: ", loadoutCards);
    for(const card of loadoutCards){
        await pool.query("INSERT INTO loadoutCards (email, anime_character, level) VALUES ($1, $2, $3)",
              [email, card, cardLevels[card]]);
    }
    for(const card of inventoryCards){
        await pool.query("INSERT INTO inventoryCards (email, anime_character, level) VALUES ($1, $2, $3)",
              [email, card, cardLevels[card]]);
    }
    console.log(await getCards(email));
}

async function insertStagesComplete(email, stagesComplete){
    console.log('stages complete: ', stagesComplete);
    for(const stage of stagesComplete){
        await pool.query("INSERT INTO stagesComplete (email, stage) VALUES ($1, $2)",
              [email, stage]);
    }
}

async function deleteCards(email){
    await pool.query("DELETE FROM loadoutCards WHERE email = ($1)", [email]);
    await pool.query("DELETE FROM inventoryCards WHERE email = ($1)", [email]);
}

async function deleteStagesComplete(email){
    await pool.query("DELETE FROM stagesComplete WHERE email = ($1)", [email]);
}

async function updateLevelPoints(email, levelPoints){
    await pool.query("UPDATE players SET level_points = ($2) WHERE email = ($1)", [email, parseInt(levelPoints)])
}

module.exports = {
    isPlayer,
    getPlayerData,
    getCards,
    getStagesComplete,
    getLevelPoints,
    insertPlayer,
    insertCards,
    insertStagesComplete,
    deleteCards,
    deleteStagesComplete,
    updateLevelPoints,
}