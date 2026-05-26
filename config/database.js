/**
 * Database Configuration
 * Supports both SQLite (development) and PostgreSQL (production)
 *
 * Automatically detects environment and uses appropriate database
 * Code interface remains consistent across both databases
 */

const path = require('path');

// Determine which database to use
const usePostgres = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;
const useSQLite = !usePostgres;

let db;

if (useSQLite) {
  // ========== SQLITE (Development) ==========
  const Database = require('better-sqlite3');
  db = new Database(path.join(__dirname, '../db/dotvests.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('📦 Using SQLite database (development mode)');

  // Initialize schema (existing code)
  initializeSQLiteSchema(db);

} else if (process.env.DATABASE_URL) {
  // ========== POSTGRESQL (Production) ==========
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Create a wrapper to make PostgreSQL API match SQLite
  db = createPostgresWrapper(pool);

  console.log('🐘 Using PostgreSQL database (production mode)');

  // Initialize schema
  initializePostgresSchema(db);

} else {
  // Fallback to SQLite if no database URL
  const Database = require('better-sqlite3');
  db = new Database(path.join(__dirname, '../db/dotvests.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('📦 Using SQLite database (no DATABASE_URL provided)');
  initializeSQLiteSchema(db);
}

module.exports = db;

// ============ SQLITE INITIALIZATION ============
function initializeSQLiteSchema(db) {
  // Add missing columns to users table
  try { db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN reset_token_expiry INTEGER`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN profile_image TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN date_of_birth TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN address TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN document_type TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN document_number TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN smile_job_id TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN liveness_passed INTEGER DEFAULT 0`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN kyc_submitted_at DATETIME`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN polymesh_did TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN polymesh_portfolio_id TEXT`); } catch(e) {}

  // Add missing columns to wallets table
  try { db.exec(`ALTER TABLE wallets ADD COLUMN account_number TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN bank_name TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN investment_balance REAL DEFAULT 0.00`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN paystack_customer_code TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN dva_account_number TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN dva_bank_name TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN dva_bank_code TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN wallet_created INTEGER DEFAULT 0`); } catch(e) {}
  try { db.exec(`ALTER TABLE wallets ADD COLUMN breet_address TEXT`); } catch(e) {}

  // Add missing columns to stocks table
  try { db.exec(`ALTER TABLE stocks ADD COLUMN high_52w REAL`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN low_52w REAL`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN market_cap TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN industry TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN pe_ratio REAL`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN eps REAL`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN dividend_yield REAL`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN volume TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN average_volume TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN beta REAL`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN shares_outstanding INTEGER`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN exchange TEXT DEFAULT 'NGX'`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN risk_level TEXT DEFAULT 'medium'`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN min_investment REAL DEFAULT 50000`); } catch(e) {}
  try { db.exec(`ALTER TABLE stocks ADD COLUMN expected_apy REAL`); } catch(e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'unknown'
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      pin TEXT,
      bvn TEXT,
      nin TEXT,
      kyc_status TEXT DEFAULT 'unverified',
      account_status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      balance REAL DEFAULT 0.00,
      currency TEXT DEFAULT 'NGN',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      reference TEXT UNIQUE,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ticker TEXT UNIQUE NOT NULL,
      sector TEXT,
      price REAL NOT NULL,
      previous_price REAL,
      logo TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      order_type TEXT DEFAULT 'market',
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      avg_buy_price REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS escrow_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      stock_id INTEGER NOT NULL,
      stock_ticker TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'pending_trustee',
      trustee_wallet TEXT,
      trustee_reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_id) REFERENCES stocks(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instruction_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      asset_id TEXT NOT NULL,
      ticker TEXT NOT NULL,
      amount REAL NOT NULL,
      naira_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try { db.exec('CREATE INDEX IF NOT EXISTS idx_price_history_stock_time ON price_history(stock_id, timestamp)'); } catch(e) {}

  console.log('✅ SQLite schema initialized');
}

// ============ POSTGRESQL INITIALIZATION ============
async function initializePostgresSchema(db) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        pin VARCHAR(10),
        bvn VARCHAR(11),
        nin VARCHAR(11),
        kyc_status VARCHAR(50) DEFAULT 'unverified',
        account_status VARCHAR(50) DEFAULT 'active',
        role VARCHAR(50) DEFAULT 'user',
        reset_token TEXT,
        reset_token_expiry INTEGER,
        profile_image TEXT,
        date_of_birth DATE,
        address TEXT,
        document_type VARCHAR(50),
        document_number VARCHAR(100),
        smile_job_id VARCHAR(255),
        liveness_passed INTEGER DEFAULT 0,
        kyc_submitted_at TIMESTAMP,
        polymesh_did TEXT,
        polymesh_portfolio_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        balance DECIMAL(15, 2) DEFAULT 0.00,
        investment_balance DECIMAL(15, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'NGN',
        account_number VARCHAR(50),
        bank_name VARCHAR(100),
        paystack_customer_code VARCHAR(255),
        dva_account_number VARCHAR(50),
        dva_bank_name VARCHAR(100),
        dva_bank_code VARCHAR(10),
        wallet_created INTEGER DEFAULT 0,
        breet_address VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        reference VARCHAR(100) UNIQUE,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ticker VARCHAR(10) UNIQUE NOT NULL,
        sector VARCHAR(100),
        price DECIMAL(15, 2) NOT NULL,
        previous_price DECIMAL(15, 2),
        logo TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        high_52w DECIMAL(15, 2),
        low_52w DECIMAL(15, 2),
        market_cap VARCHAR(100),
        industry VARCHAR(100),
        pe_ratio DECIMAL(10, 2),
        eps DECIMAL(10, 4),
        dividend_yield DECIMAL(10, 4),
        volume VARCHAR(50),
        average_volume VARCHAR(50),
        beta DECIMAL(10, 4),
        shares_outstanding BIGINT,
        exchange VARCHAR(10) DEFAULT 'NGX',
        risk_level VARCHAR(50) DEFAULT 'medium',
        min_investment DECIMAL(15, 2) DEFAULT 50000,
        expected_apy DECIMAL(10, 4),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        stock_id INTEGER NOT NULL REFERENCES stocks(id),
        type VARCHAR(50) NOT NULL,
        order_type VARCHAR(50) DEFAULT 'market',
        quantity INTEGER NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        total DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS portfolio (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        stock_id INTEGER NOT NULL REFERENCES stocks(id),
        quantity INTEGER NOT NULL,
        avg_buy_price DECIMAL(15, 2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS escrow_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        stock_id INTEGER NOT NULL REFERENCES stocks(id),
        stock_ticker VARCHAR(10) NOT NULL,
        stock_name VARCHAR(255) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        quantity INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending_trustee',
        trustee_wallet VARCHAR(255),
        trustee_reference VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        source VARCHAR(100) DEFAULT 'unknown'
      );

      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'unread',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS watchlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        stock_id INTEGER NOT NULL REFERENCES stocks(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        stock_id INTEGER NOT NULL REFERENCES stocks(id),
        open DECIMAL(15, 4) NOT NULL,
        high DECIMAL(15, 4) NOT NULL,
        low DECIMAL(15, 4) NOT NULL,
        close DECIMAL(15, 4) NOT NULL,
        volume INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        instruction_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        asset_id TEXT NOT NULL,
        ticker VARCHAR(20) NOT NULL,
        amount DECIMAL(20, 6) NOT NULL,
        naira_amount DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_price_history_stock_time ON price_history(stock_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON portfolio(user_id);
    `);

    console.log('✅ PostgreSQL schema initialized');
  } catch (error) {
    console.error('⚠️ PostgreSQL schema initialization error (may already exist):', error.message);
  }
}

// ============ POSTGRESQL WRAPPER ============
/**
 * Wraps pg.Pool to provide SQLite-like API
 * This allows using the same code for both databases
 */
function createPostgresWrapper(pool) {
  return {
    // Synchronous-like interface for compatibility
    prepare: (sql) => ({
      run: (...params) => runQuery(pool, sql, params),
      get: (...params) => getQuery(pool, sql, params),
      all: (...params) => allQuery(pool, sql, params)
    }),

    // Direct query execution
    exec: (sql) => execQuery(pool, sql),

    // Transaction support
    transaction: (fn) => transactionWrapper(pool, fn),

    // Close connection
    close: () => pool.end()
  };
}

// Helper functions for PostgreSQL wrapper
async function runQuery(pool, sql, params) {
  const result = await pool.query(sql, params);
  return { lastInsertRowid: result.rows[0]?.id || null };
}

async function getQuery(pool, sql, params) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function allQuery(pool, sql, params) {
  const result = await pool.query(sql, params);
  return result.rows || [];
}

async function execQuery(pool, sql) {
  const statements = sql.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      await pool.query(stmt);
    }
  }
}

async function transactionWrapper(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
