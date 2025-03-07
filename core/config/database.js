// config/database.js - Database configuration
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./sqlite.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to the SQLite database');
  }
});

// Function to initialize the database
const initialize = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // Create projects table
        db.run(`CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          path TEXT,
          description TEXT,
          repository_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP,
          idcontainer TEXT,
          image TEXT
        )`);

        // Create deployment_logs table
        db.run(`CREATE TABLE IF NOT EXISTS deployment_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          action TEXT,
          status TEXT,
          triggered_by TEXT,
          log_content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // Create webhooks table
        db.run(`CREATE TABLE IF NOT EXISTS webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          token TEXT UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_used TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // Create builds table
        db.run(`CREATE TABLE IF NOT EXISTS builds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          build_id TEXT NOT NULL,
          repository TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          logs TEXT
        )`);

        // Create build_logs table
        db.run(`CREATE TABLE IF NOT EXISTS build_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          build_id TEXT NOT NULL,
          log_entry TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Export the database connection and initialize function
module.exports = { db, initialize , dbAll, dbRun };

