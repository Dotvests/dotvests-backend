# Database Setup Guide

Complete guide for setting up SQLite (local development) and PostgreSQL (production on Render).

---

## Overview

**DotVests uses a flexible database setup:**
- **Local Development:** SQLite (file-based, zero setup)
- **Production (Render):** PostgreSQL (managed database)

The backend automatically detects the environment and uses the appropriate database. **No code changes needed!**

---

## Local Development (SQLite)

### Setup

SQLite works out of the box:

```bash
npm install
npm start
```

That's it! Database creates automatically at `db/dotvests.db` on first run.

**No configuration needed.** The database initializes all tables and columns automatically.

### File Location

```
/dotvests-backend/
└── db/
    └── dotvests.db    ← SQLite database file
```

### Backup Your Local Database

```bash
# Copy the database file
cp db/dotvests.db db/dotvests.db.backup
```

### Reset Local Database

```bash
# Delete the database file
rm db/dotvests.db

# Restart the server to recreate
npm start
```

---

## Production (PostgreSQL on Render)

### Prerequisites

1. **Render account** (render.com)
2. **PostgreSQL database** created on Render
3. **Database connection string** (DATABASE_URL)

### Step 1: Create PostgreSQL Database on Render

1. Log in to Render dashboard
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `dotvests-db` (or your choice)
   - **Database:** `dotvests` (default)
   - **User:** `dotvests_user` (auto-generated or custom)
   - **Region:** Same as your backend (for latency)
4. Click **"Create Database"**
5. Copy the connection string (looks like):
   ```
   postgresql://dotvests_user:password@dpg-xxx.render.com/dotvests
   ```

### Step 2: Add to Render Environment

1. In Render dashboard, go to your **Web Service** (backend)
2. Click **"Environment"**
3. Add environment variable:
   - **Key:** `DATABASE_URL`
   - **Value:** Paste the connection string from Step 1
4. Add environment variable:
   - **Key:** `NODE_ENV`
   - **Value:** `production`
5. Click **"Save"**

### Step 3: Deploy

Push your code to the branch connected to Render:

```bash
git add .
git commit -m "feat: Add PostgreSQL support for production"
git push origin main
```

Render will:
1. ✅ Detect the new `DATABASE_URL` 
2. ✅ Use PostgreSQL automatically
3. ✅ Initialize schema on first boot
4. ✅ Start accepting requests

---

## Migration: SQLite → PostgreSQL

If you have existing data in SQLite and want to migrate to PostgreSQL:

### Step 1: Install Dependencies

```bash
npm install
```

This installs the `pg` package needed for PostgreSQL access.

### Step 2: Export Data from SQLite

```bash
npm run migrate:export
```

This creates a `migration-data-[timestamp].json` file with all your data.

### Step 3: Set Up PostgreSQL

Follow **Production Setup** above to create a PostgreSQL database on Render.

### Step 4: Add DATABASE_URL Locally

Update `.env` file:

```env
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
```

### Step 5: Import Data

```bash
npm run migrate:import
```

This imports all data from the JSON file to PostgreSQL.

### Step 6: Verify Migration

```bash
npm run migrate:verify
```

Output shows row counts for each table. All should match!

```
✅ users: 5 rows (match)
✅ wallets: 5 rows (match)
✅ transactions: 23 rows (match)
...
✅ All tables match! Migration successful.
```

### Step 7: Deploy

```bash
git add .
git commit -m "feat: Migrate to PostgreSQL for production"
git push origin main
```

---

## Database Detection Logic

The backend automatically chooses the database:

```javascript
if (NODE_ENV === 'production' && DATABASE_URL exists) {
  Use PostgreSQL
} else {
  Use SQLite
}
```

### Environment Variables

| Variable | Value | Database |
|----------|-------|----------|
| `NODE_ENV` | `development` | SQLite |
| `NODE_ENV` | `production` + `DATABASE_URL` set | PostgreSQL |
| `NODE_ENV` | `production` + `DATABASE_URL` not set | SQLite (fallback) |

---

## Troubleshooting

### "Database not found" Error

**Local (SQLite):**
- Delete `db/dotvests.db` and restart server
- Database auto-creates with correct schema

**Production (PostgreSQL):**
- Check `DATABASE_URL` is set in Render environment
- Verify PostgreSQL database exists on Render
- Check connection string format is correct

### "Connection refused" Error

**Possible causes:**
1. PostgreSQL database isn't running
2. Connection string is wrong
3. Firewall blocking access

**Solutions:**
- Verify `DATABASE_URL` in Render environment
- Test connection: `psql [connection-string]`
- Check Render database status in dashboard

### "Table doesn't exist" Error

**After migration:**
- Run `npm run migrate:verify` to check
- If migration didn't complete, run again

**On fresh deployment:**
- Backend auto-creates schema on first start
- Check application logs in Render for errors
- May take 30 seconds for schema creation

### "Permission denied" Error

**Possible causes:**
1. Wrong username/password in connection string
2. PostgreSQL user doesn't have permissions
3. Connection string format is incorrect

**Format should be:**
```
postgresql://username:password@host:port/database
```

### Sync Issues After Switching Databases

If you switch between SQLite and PostgreSQL:

1. **Local to Production:**
   ```bash
   npm run migrate:export
   # Deploy code
   npm run migrate:import
   npm run migrate:verify
   ```

2. **Clear Caches:**
   - Restart backend service
   - Clear browser cache/cookies
   - Restart any frontend servers

---

## API Compatibility

The code works identically with both databases:

```javascript
// Same code works for SQLite or PostgreSQL
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
const rows = db.prepare('SELECT * FROM orders').all();

db.transaction(() => {
  db.prepare('UPDATE wallets SET balance = ?').run(newBalance);
  db.prepare('INSERT INTO transactions ...').run(...);
})();
```

No changes needed in route files or models!

---

## Performance Considerations

### SQLite (Local)

- ✅ Fast for development (no network latency)
- ✅ Simple setup (no external service)
- ❌ Not suitable for production (ephemeral file system)
- ❌ Single-process only (doesn't scale)

### PostgreSQL (Production)

- ✅ Suitable for production (persistent storage)
- ✅ Scales to multiple processes/replicas
- ✅ Better for concurrent connections
- ✅ Backup & recovery features
- ⚠️ Slower than SQLite (network latency, ~50-100ms)
- ⚠️ Cost (Render's free tier has limits)

---

## Best Practices

### Local Development

1. **Keep SQLite for development**
   ```bash
   rm DATABASE_URL from .env
   rm NODE_ENV=production
   ```

2. **Backup before major changes**
   ```bash
   cp db/dotvests.db db/dotvests.db.backup
   ```

3. **Use reset script for clean slate**
   ```bash
   rm db/dotvests.db
   npm start
   ```

### Production

1. **Enable backups on Render**
   - Render offers automated backups
   - Configure in database dashboard

2. **Monitor database size**
   - Render has storage limits
   - Check dashboard regularly

3. **Use connection pooling**
   - PostgreSQL handles this automatically
   - Render manages connection limits

4. **Regular data validation**
   ```bash
   npm run migrate:verify
   ```

---

## Schema Management

### Add New Column to Existing Table

**Both databases auto-migrate:**

In `config/database.js`, add to `initializeSQLiteSchema()`:
```javascript
try { db.exec(`ALTER TABLE users ADD COLUMN new_field TEXT`); } catch(e) {}
```

And to `initializePostgresSchema()`:
```javascript
CREATE TABLE IF NOT EXISTS users (
  ...
  new_field TEXT,
  ...
);
```

Next deployment/restart applies changes.

### Create New Table

Add to both schema initialization functions:

**SQLite:**
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ...
  );
`);
```

**PostgreSQL:**
```javascript
CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  ...
);
```

---

## Migration Scripts

### Export Local Data

```bash
npm run migrate:export
# Creates: migration-data-[timestamp].json
```

### Import to PostgreSQL

```bash
npm run migrate:import
# Uses latest migration-data-*.json file
```

### Verify Migration Success

```bash
npm run migrate:verify
# Compares row counts in SQLite vs PostgreSQL
```

### Combined (Quick Workflow)

```bash
npm run migrate              # Shows help
npm run migrate:export       # Export
npm run migrate:import       # Import (requires DATABASE_URL)
npm run migrate:verify       # Verify
```

---

## Connection String Format

### Local SQLite
```
No connection string needed (auto-created at db/dotvests.db)
```

### PostgreSQL

**Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Example from Render:**
```
postgresql://dotvests_user:abc123xyz@dpg-cgn2f7r47cd0ufve1qf0-a.oregon-postgres.render.com/dotvests
```

**Components:**
- `user` — Database user (e.g., `dotvests_user`)
- `password` — Database password
- `host` — Database host (e.g., `dpg-xxx.render.com`)
- `port` — Usually `5432` for PostgreSQL
- `database` — Database name (e.g., `dotvests`)

---

## Render Specific

### Create PostgreSQL Database

1. **New → PostgreSQL** in Render dashboard
2. Configure name, region
3. Copy connection string
4. Add to Web Service environment as `DATABASE_URL`

### Connect Backend to Database

1. Go to Web Service settings
2. **Environment** tab
3. Add `DATABASE_URL` variable
4. Redeploy (automatic if auto-deploy enabled)

### Monitor Database

1. In Postgres dashboard
2. Click your database instance
3. View:
   - Storage usage
   - Connection count
   - Query stats (if available)

### Backup Database

Render automatically backs up PostgreSQL. To restore:

1. Contact Render support or
2. Use PostgreSQL `pg_dump` & `pg_restore` tools locally

---

## Testing Connection

### Local SQLite

```bash
npm start
# Should see: "✅ Using SQLite database (development mode)"
```

### PostgreSQL

```bash
# Add DATABASE_URL to .env
DATABASE_URL=postgresql://...
NODE_ENV=production

npm start
# Should see: "🐘 Using PostgreSQL database (production mode)"
```

### Test with psql (PostgreSQL CLI)

```bash
# Install psql (PostgreSQL client)
brew install postgresql  # macOS
apt install postgresql-client  # Linux
choco install postgresql  # Windows

# Test connection
psql [DATABASE_URL]

# In psql prompt:
\dt  # List tables
SELECT COUNT(*) FROM users;  # Query data
\q   # Quit
```

---

## Summary

| Aspect | SQLite | PostgreSQL |
|--------|--------|------------|
| **Setup** | Auto (0 steps) | Create on Render (2 steps) |
| **Local Dev** | ✅ Perfect | ❌ Not recommended |
| **Production** | ❌ Not suitable | ✅ Perfect |
| **Cost** | Free | Free (with limits) |
| **Scaling** | Single process | Multiple replicas |
| **Backups** | Manual | Automatic |
| **Schema Changes** | Via migrations | Via SQL or ORM |

---

## Need Help?

- **SQLite errors:** Check `db/dotvests.db` exists
- **PostgreSQL errors:** Check `DATABASE_URL` in environment
- **Migration issues:** Run `npm run migrate:verify` to debug
- **Render issues:** Check Render dashboard database status
- **Schema problems:** Review `config/database.js` schema definitions

