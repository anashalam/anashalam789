const { Pool } = require('pg');
require('dotenv').config();

// Railway par DATABASE_URL hamesha priority honi chahiye
const connectionConfig = process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Railway ke liye ye line ZAROORI hai
        }
      }
    : {
        // Sirf local development ke liye
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'music_db',
        password: process.env.DB_PASSWORD || 'rehmat123345',
        port: process.env.DB_PORT || 5432,
      };

const pool = new Pool(connectionConfig);

// Test connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Database connection error:', err.stack);
    }
    console.log('✅ Database connected successfully!');
    release();
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};