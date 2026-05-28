# Render Deployment — Environment Variables

Set all of the following in the Render dashboard under **Environment → Environment Variables**.

---

## Required Variables

| Variable | Description |
|---|---|
| `PORT` | Port the Express server listens on. Render sets this automatically; set to `3000` as fallback. |
| `NODE_ENV` | Set to `production`. Enables PostgreSQL and disables SQLite. |
| `DATABASE_URL` | PostgreSQL connection string from Render's managed database. Format: `postgresql://user:password@host:5432/dbname` |
| `JWT_SECRET` | Long random string used to sign JWTs. Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token expiry, e.g. `7d` |
| `POLYMESH_NODE_URL` | Polymesh node WebSocket URL. Testnet: `wss://testnet-rpc.polymesh.live` |
| `POLYMESH_KEYSTORE_PASSWORD` | Password used to decrypt the keystore JSON |
| `POLYMESH_VENUE_ID` | Settlement venue ID created by `node scripts/create-venue.js` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_live_...` or `sk_test_...`) |
| `SENDGRID_API_KEY` | SendGrid API key for transactional email |
| `SENDGRID_FROM_EMAIL` | Verified sender address, e.g. `noreply@dotvests.com` |
| `FRONTEND_URL` | Frontend origin for CORS, e.g. `https://dotvests.com` |

---

## Keystore File on Render

Render does not support uploading arbitrary files. The Polymesh keystore is a JSON file on disk locally, but **on Render it must be stored as an environment variable and written to disk at startup**.

### Step 1 — Add the keystore as an env var

Copy the full contents of your keystore JSON file (e.g. `keystore.json`) and paste it as the value of a new environment variable:

```
POLYMESH_KEYSTORE_JSON={"encoded":"...","encoding":{...},"address":"...","meta":{...}}
```

### Step 2 — Write it to disk at startup

In `config/polymesh.js`, replace the file-read block with this:

```js
let keystoreJson;
if (process.env.POLYMESH_KEYSTORE_JSON) {
  // Render: keystore supplied as env var, no file on disk
  keystoreJson = JSON.parse(process.env.POLYMESH_KEYSTORE_JSON);
} else {
  const keystorePath = path.resolve(process.env.POLYMESH_KEYSTORE_PATH);
  keystoreJson = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
}
```

Then remove `POLYMESH_KEYSTORE_PATH` from the Render env vars (or leave it blank).

### Step 3 — Update .env.example

Add `POLYMESH_KEYSTORE_JSON=` as an optional variable alongside `POLYMESH_KEYSTORE_PATH=`.

---

## Checklist Before First Deploy

- [ ] PostgreSQL database created in Render and `DATABASE_URL` copied
- [ ] `NODE_ENV=production` set
- [ ] `JWT_SECRET` set to a strong random value (not the example value)
- [ ] `POLYMESH_KEYSTORE_JSON` set (paste full keystore JSON)
- [ ] `POLYMESH_KEYSTORE_PASSWORD` set
- [ ] `POLYMESH_VENUE_ID` set (run `node scripts/create-venue.js` locally first)
- [ ] `POLYMESH_NODE_URL` set to testnet or mainnet URL
- [ ] `PAYSTACK_SECRET_KEY` set
- [ ] Build command: `npm install`
- [ ] Start command: `node index.js`
