// db-setup.js
// Script to populate MySQL database with required schema

// Import dependencies
require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// SQL script to set up the database - use path.resolve to get absolute path
const sqlScriptPath = path.resolve(__dirname, 'docker_monitor.sql');
const sqlScriptFile = fs.readFileSync(sqlScriptPath, 'utf8');

// Retry configuration
const MAX_RETRIES = process.env.DB_MAX_RETRIES || 15;
const INITIAL_RETRY_DELAY = process.env.DB_RETRY_DELAY || 2000; // milliseconds

// Check if .env variables are available
function checkEnvironmentVariables() {
  const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Verify the database name from .env matches the one in the SQL script
  if (process.env.DB_NAME !== 'docker_monitor') {
    console.warn(`Warning: The database name in .env (${process.env.DB_NAME}) does not match the one in the SQL script (docker_monitor).`);
    console.warn('The SQL script will use docker_monitor regardless of the DB_NAME value.');
  }
}

// Sleep function for delay between retries
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeDatabase(retryCount = 0, delay = INITIAL_RETRY_DELAY) {
  let connection;
  
  try {
    // Verify all required environment variables are available
    checkEnvironmentVariables();
    
    console.log(`Connecting to MySQL at ${process.env.DB_HOST} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
    console.log(`SQL script will use database: docker_monitor`);
    
    // Create connection using environment variables
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true // Enable multiple statements
    });
    
    console.log('Connected to MySQL database server');
    
    // Now we need to make sure the docker_monitor database exists before running the script
    console.log('Ensuring database exists...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`docker_monitor\`;`);
    
    // Execute the entire SQL script
    console.log('Executing SQL script...');
    await connection.query(sqlScriptFile);
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error(`Error executing SQL script (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    
    if (connection) {
      await connection.end();
      console.log('Connection closed');
    }
    
    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES - 1) {
      const nextDelay = Math.min(delay * 1.5, 30000); // Exponential backoff with 30s cap
      console.log(`Retrying in ${delay/1000} seconds...`);
      await sleep(delay);
      return executeDatabase(retryCount + 1, nextDelay);
    } else {
      console.error('Maximum retry attempts reached. Exiting with error.');
      process.exit(1); // Exit with error code
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('Connection closed');
    }
  }
}

// Execute the function
console.log(`Starting database setup with up to ${MAX_RETRIES} attempts`);
executeDatabase();