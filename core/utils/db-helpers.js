// Utility functions to work with SQLite database
const db = require('../config/database');

/**
 * Execute a query that returns multiple rows
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Array>} - Resolves with array of results
 */
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

/**
 * Execute a query that returns a single row
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Object|null>} - Resolves with the first result or null
 */
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
};

/**
 * Execute a query that performs an action (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Object>} - Resolves with lastID and changes properties
 */
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

/**
 * Execute multiple statements in a transaction
 * @param {Function} callback - Function that receives transaction object and performs operations
 * @returns {Promise<void>} - Resolves when transaction is complete
 */
const dbTransaction = (callback) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          callback(db);
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        } catch (err) {
          db.run('ROLLBACK', () => {
            reject(err);
          });
        }
      });
    });
  });
};

module.exports = {
  dbAll,
  dbGet,
  dbRun,
  dbTransaction,
  db
};
