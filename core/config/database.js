// config/database.js - Database configuration
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'docker_monitor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

module.exports = pool;