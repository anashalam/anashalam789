const { Pool } = require('pg');

// Railway automatically DATABASE_URL provide karta hai
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Railway/Cloud databases ke liye zaroori hai
  }
});

module.exports = pool;