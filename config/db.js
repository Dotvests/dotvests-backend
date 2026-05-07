/**
 * Database connection (backward compatible export)
 * This file now imports from the new database.js which supports both SQLite and PostgreSQL
 */

const db = require('./database');

module.exports = db;
