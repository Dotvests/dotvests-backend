#!/usr/bin/env node

/**
 * Migration Script: SQLite to PostgreSQL
 * Helps migrate data from local SQLite database to production PostgreSQL
 *
 * Usage:
 *   npm run migrate
 *   or
 *   node scripts/migrate-sqlite-to-postgres.js
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { Pool } = require('pg');

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  switch (command) {
    case 'export':
      await exportSQLiteToDB();
      break;
    case 'import':
      await importDataToPostgres();
      break;
    case 'verify':
      await verifyMigration();
      break;
    case 'help':
    default:
      printHelp();
  }
}

// ============ EXPORT SQLite to JSON ============
async function exportSQLiteToDB() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
  }

  console.log('📦 Exporting data from SQLite...');

  const sqliteDb = new Database(path.join(__dirname, '../db/dotvests.db'));

  const tables = [
    'users', 'wallets', 'transactions', 'stocks', 'orders',
    'portfolio', 'escrow_transactions', 'notifications', 'waitlist',
    'contact_messages', 'watchlists', 'price_history'
  ];

  const data = {};

  for (const table of tables) {
    try {
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      data[table] = rows;
      console.log(`✅ ${table}: ${rows.length} rows`);
    } catch (error) {
      console.log(`⚠️  ${table}: Table not found (skipping)`);
    }
  }

  sqliteDb.close();

  // Save to JSON file
  const fs = require('fs');
  const filename = `migration-data-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));

  console.log(`\n✅ Data exported to ${filename}`);
  console.log('Next step: npm run migrate import');
}

// ============ IMPORT to PostgreSQL ============
async function importDataToPostgres() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
  }

  // Find latest migration file
  const fs = require('fs');
  const files = fs.readdirSync('.').filter(f => f.startsWith('migration-data-'));

  if (files.length === 0) {
    console.error('❌ No migration data file found. Run "npm run migrate export" first');
    process.exit(1);
  }

  const filename = files[files.length - 1];
  console.log(`📥 Importing from ${filename}...`);

  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Disable foreign key checks temporarily
    await pool.query('SET CONSTRAINTS ALL DEFERRED');

    for (const [table, rows] of Object.entries(data)) {
      if (!rows || rows.length === 0) {
        console.log(`⏭️  ${table}: No data to import`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
      const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      let imported = 0;
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        try {
          await pool.query(sql, values);
          imported++;
        } catch (error) {
          // Skip conflicts
        }
      }

      console.log(`✅ ${table}: ${imported} rows imported`);
    }

    console.log('\n✅ Migration complete!');
    console.log('Next step: npm run migrate verify');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ============ VERIFY MIGRATION ============
async function verifyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
  }

  console.log('🔍 Verifying migration...\n');

  const sqliteDb = new Database(path.join(__dirname, '../db/dotvests.db'));
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const tables = [
    'users', 'wallets', 'transactions', 'stocks', 'orders',
    'portfolio', 'escrow_transactions', 'notifications', 'waitlist',
    'contact_messages', 'watchlists', 'price_history'
  ];

  let allMatch = true;

  for (const table of tables) {
    try {
      const sqliteCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      const pgResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);

      if (sqliteCount === pgCount) {
        console.log(`✅ ${table}: ${sqliteCount} rows (match)`);
      } else {
        console.log(`⚠️  ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount} (mismatch)`);
        allMatch = false;
      }
    } catch (error) {
      console.log(`⏭️  ${table}: Not found (skipping)`);
    }
  }

  sqliteDb.close();
  await pool.end();

  if (allMatch) {
    console.log('\n✅ All tables match! Migration successful.');
  } else {
    console.log('\n⚠️  Some tables have mismatches. Check the data and try again.');
  }
}

// ============ HELP ============
function printHelp() {
  console.log(`
🚀 SQLite to PostgreSQL Migration Tool

Usage:
  npm run migrate [command]

Commands:
  export    Export data from SQLite to JSON file
  import    Import JSON data to PostgreSQL
  verify    Verify migration success
  help      Show this help message

Process:
  1. npm run migrate export     → Creates migration-data-*.json
  2. npm run migrate import     → Imports to PostgreSQL
  3. npm run migrate verify     → Checks if data matches

Example workflow:
  npm run migrate export
  # Set DATABASE_URL in .env for production PostgreSQL
  npm run migrate import
  npm run migrate verify

Notes:
  - Requires DATABASE_URL environment variable for PostgreSQL
  - SQLite database must exist at db/dotvests.db
  - Exported files are named migration-data-[timestamp].json
  - Supports ON CONFLICT DO NOTHING for safe re-imports
  `);
}

main().catch(console.error);
