const { Pool } = require('pg');

module.exports = new Pool({
    // connectionString: `postgresql://${process.env.USER}:${process.env.DATABASE_PASSWORD}@localhost:5432/anime_showdown`
    connectionString:  DATABASE_PUBLIC_URL
});