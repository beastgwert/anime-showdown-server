const { Client } = require("pg");

const SQL = `
DROP TABLE IF EXISTS loadoutCards;
DROP TABLE IF EXISTS inventoryCards;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS stagesComplete;

CREATE TABLE IF NOT EXISTS players (
  email VARCHAR (255) PRIMARY KEY,
  username VARCHAR ( 255 ),
  level_points INT
);

CREATE TABLE IF NOT EXISTS loadoutCards(
  email VARCHAR (255),
  anime_character VARCHAR ( 255 ),
  level INT
);

CREATE TABLE IF NOT EXISTS inventoryCards(
  email VARCHAR (255),
  anime_character VARCHAR ( 255 ),
  level INT
);

CREATE TABLE IF NOT EXISTS stagesComplete(
  email VARCHAR (255),
  stage INT
);
`;

async function main() {
  console.log("seeding...");
  const client = new Client({
    connectionString: `postgresql://${process.env.USER}:${process.env.DATABASE_PASSWORD}@localhost:5432/anime_showdown`,
  });
  await client.connect();
  await client.query(SQL);
  await client.end();
  console.log("done");
}

main();