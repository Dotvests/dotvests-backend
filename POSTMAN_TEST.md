# Buy Flow — End-to-End curl Test

Base URL: `http://localhost:3000`

---

## Step 1 — Register a user

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test Investor",
    "email": "investor@test.com",
    "password": "Password123!"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": 1,
    "full_name": "Test Investor",
    "email": "investor@test.com",
    "role": "user"
  }
}
```

---

## Step 2 — Login and capture JWT

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "investor@test.com",
    "password": "Password123!"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "investor@test.com"
  }
}
```

Copy the `token` value. Use it as `<JWT>` in all subsequent requests.

---

## Step 3 — Create Polymesh DID for the investor

The signing account must have CDD provider privileges on the testnet.
`wallet_address` is the investor's Polymesh account address (sr25519 ss58).

```bash
curl -X POST http://localhost:3000/api/polymesh/identity/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "wallet_address": "<investor_ss58_address>"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "did": "0xabc123...",
  "portfolioId": "0"
}
```

---

## Step 4 — Check CDD eligibility (optional sanity check)

```bash
curl http://localhost:3000/api/polymesh/identity/0xabc123.../eligible
```

**Expected response:**
```json
{
  "success": true,
  "did": "0xabc123...",
  "eligible": true
}
```

---

## Step 5 — Fund the wallet (dev shortcut)

In development, top up the user's wallet balance directly in the SQLite DB or via whatever funding endpoint exists, so the buy step doesn't fail the balance check.

Minimum required: `quantity × price` = `100 × 1840` = **₦184,000**

---

## Step 6 — Buy PGV tokens

```bash
curl -X POST http://localhost:3000/api/orders/buy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "ticker": "PGV",
    "quantity": 100
  }'
```

**Request body:**
```json
{
  "ticker": "PGV",
  "quantity": 100
}
```

**Expected response:**
```json
{
  "success": true,
  "instructionId": "12345",
  "ticker": "PGV",
  "amount": 100,
  "nairaAmount": 184000,
  "status": "pending"
}
```

---

## Step 7 — Poll settlement status

```bash
curl http://localhost:3000/api/polymesh/settle/12345/status \
  -H "Authorization: Bearer <JWT>"
```

**Expected response:**
```json
{
  "success": true,
  "instructionId": "12345",
  "status": "pending",
  "chainStatus": "pending"
}
```

Once all parties affirm, `status` becomes `"settled"`.

---

## Token Prices Reference

| Ticker | Price (₦) | Asset ID |
|--------|-----------|----------|
| PGV    | 1,840     | f564dc78-42ac-80b4-b813-6f2cf1d970f0 |
| CHD    | 620       | cb03df06-8278-8162-bafe-83b7a66b9c83 |
| ERF    | 310       | e247bf9c-07e6-8cb5-8f0a-9b2db1206731 |
| CBT    | 980       | e0131644-119d-8d10-a084-dd6364af6c62 |
