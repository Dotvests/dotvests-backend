# Two-Wallet Architecture - Technical Overview

## Problem Statement

**Previous System:** Single wallet balance that held both liquid cash and investments. DotVests would temporarily hold user funds.

**Issue:** This is a regulatory and operational liability. Funds must never be held by DotVests.

**Solution:** Dual-wallet system where:
1. **Liquid balance** sits at Paystack (not DotVests)
2. **Investment balance** sits in escrow with trustee (not DotVests)
3. DotVests only **tracks** these balances in database

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      DotVests Frontend                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP/REST
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   DotVests Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database (SQLite)                                   │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ wallets:                                       │ │   │
│  │  │  - id, user_id                                │ │   │
│  │  │  - balance (liquid)                           │ │   │
│  │  │  - investment_balance (invested)              │ │   │
│  │  │  - paystack_customer_code                     │ │   │
│  │  │  - dva_account_number                         │ │   │
│  │  │  - wallet_created flag                        │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ escrow_transactions:                           │ │   │
│  │  │  - id, user_id, stock_id                      │ │   │
│  │  │  - amount, quantity                           │ │   │
│  │  │  - status (pending_trustee → confirmed →      │ │   │
│  │  │            refund_pending → refunded/sold)    │ │   │
│  │  │  - trustee_wallet, trustee_reference (future) │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ portfolio, orders, transactions, etc.         │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Transaction Management                              │   │
│  │  - All operations wrapped in db.transaction()       │   │
│  │  - Atomic: all-or-nothing guarantee                │   │
│  │  - No partial updates (race condition safe)         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
   ┌─────────┐        ┌──────────┐      ┌─────────┐
   │ Paystack │        │   Smile  │      │ZetaChain│
   │ (DVA)    │        │(KYC)     │      │Blockchain
   │          │        │          │      │(mint/burn)
   │Holds     │        │Verifies  │      │          │
   │liquid    │        │identity  │      │Tracks    │
   │balance   │        │documents │      │tokens    │
   └─────────┘        └──────────┘      └─────────┘
                           │
                           ↓
                    ┌─────────────┐
                    │ Trustee     │
                    │ (Future)    │
                    │ Holds shares│
                    │ in escrow   │
                    └─────────────┘
```

---

## Key Concepts

### 1. **Two Wallets**

| Property | Liquid Balance | Investment Balance |
|----------|----------------|--------------------|
| **Column** | `balance` | `investment_balance` |
| **Held By** | Paystack (DVA) | Trustee (escrow) |
| **Purpose** | Available to invest/withdraw | Tied up in shares |
| **User Can** | Spend/withdraw anytime | Only sell shares |
| **Example** | ₦30,000 | ₦20,000 (in 10 SEPLF shares) |

### 2. **KYC Requirement**

User **must** pass KYC before creating a wallet:

```
kyc_status: 'unverified' → 'pending' → 'verified' → wallet creation allowed
```

Via **Smile Identity** integration:
- Accepts: BVN, NIN, document, liveness, address
- Returns: `smile_job_id` for tracking
- Webhook notifies backend when verification completes

### 3. **Atomic Transactions**

All financial operations wrapped in `db.transaction()`:

```javascript
db.transaction(() => {
  // All these succeed together, or all rollback
  db.prepare('UPDATE wallets ...').run();
  db.prepare('INSERT INTO orders ...').run();
  db.prepare('INSERT INTO escrow_transactions ...').run();
  db.prepare('INSERT INTO transactions ...').run();
  db.prepare('INSERT INTO notifications ...').run();
})();
```

**Why:** Prevents race conditions, ensures consistency, no partial updates.

### 4. **Escrow Status Lifecycle**

```
BUY ORDER
  ↓
[pending_trustee] ← Awaiting trustee integration
  ↓
  ├─ User requests refund → [refund_pending] → Admin approves → [refunded]
  │
  └─ User sells shares → [sold]
```

**Status Values:**
- `pending_trustee` — Investment made, waiting for trustee confirmation
- `confirmed` — Trustee has acknowledged holding the shares
- `refund_pending` — User requested refund, awaiting trustee approval
- `refunded` — Trustee approved, funds returned to liquid balance
- `sold` — User sold the shares

---

## Wallet Lifecycle

### Step 1: User Registers

```sql
INSERT INTO wallets (user_id, balance, investment_balance, wallet_created)
VALUES (1, 0, 0, 0);
```

**State:** No wallet, balance = 0, no DVA

### Step 2: KYC Verified

```sql
UPDATE users SET kyc_status = 'verified' WHERE id = 1;
```

**State:** Ready to create wallet

### Step 3: Create Wallet (Paystack DVA)

```sql
UPDATE wallets
SET paystack_customer_code = 'cus_xxx',
    dva_account_number = '1234567890',
    dva_bank_name = 'Wema Bank',
    dva_bank_code = '035',
    wallet_created = 1
WHERE user_id = 1;
```

**State:** DVA created, user can deposit

### Step 4: Deposit via DVA

**Flow:**
1. User transfers ₦50,000 to their DVA account number
2. Paystack detects deposit → sends `charge.success` webhook
3. DotVests webhook handler credits `balance`

```sql
UPDATE wallets SET balance = 50000 WHERE user_id = 1;
```

**State:** Liquid balance = ₦50,000

### Step 5: Buy Shares

**Request:**
```json
POST /api/orders/place
{
  "stock_id": 1,
  "type": "buy",
  "quantity": 10
}
```

**Atomic Transaction:**
```javascript
db.transaction(() => {
  // 1. Deduct from balance, add to investment_balance
  UPDATE wallets
  SET balance = 30000,
      investment_balance = 20000
  WHERE user_id = 1;

  // 2. Record investment transaction
  INSERT INTO transactions (..., type='investment', ...)

  // 3. Add to portfolio
  INSERT INTO portfolio (user_id, stock_id, quantity, avg_buy_price)
  VALUES (1, 1, 10, 2000);

  // 4. Create order record
  INSERT INTO orders (user_id, stock_id, type, quantity, price, total, ...)

  // 5. Create escrow record
  INSERT INTO escrow_transactions (user_id, stock_id, amount, quantity, status='pending_trustee')
  VALUES (1, 1, 20000, 10, 'pending_trustee');

  // 6. Notify user
  INSERT INTO notifications (...)
})();
```

**After commit:**
- Attempt blockchain mint (best-effort, doesn't rollback order)

**State:**
- Liquid balance = ₦30,000
- Investment balance = ₦20,000
- Escrow record created (pending_trustee)

### Step 6: Admin Confirms Escrow

```sql
UPDATE escrow_transactions SET status = 'confirmed' WHERE id = 1;
```

**State:** Trustee is now holding the shares

### Step 7a: User Sells Shares

**Request:**
```json
POST /api/orders/place
{
  "stock_id": 1,
  "type": "sell",
  "quantity": 10
}
```

**Atomic Transaction:**
```javascript
db.transaction(() => {
  // 1. Credit balance, deduct investment_balance
  UPDATE wallets
  SET balance = 50000,
      investment_balance = 0
  WHERE user_id = 1;

  // 2. Record sell transaction
  INSERT INTO transactions (..., type='sell', ...)

  // 3. Remove from portfolio
  DELETE FROM portfolio WHERE user_id = 1 AND stock_id = 1;

  // 4. Create order record
  INSERT INTO orders (...)

  // 5. Mark escrow as sold
  UPDATE escrow_transactions SET status = 'sold' WHERE id = 1;
})();
```

**After commit:**
- Blockchain burn tokens (best-effort)

**State:**
- Liquid balance = ₦50,000
- Investment balance = ₦0
- Escrow marked 'sold'

### Step 7b: User Requests Refund (Alternative)

```sql
UPDATE escrow_transactions SET status = 'refund_pending', notes = '...' WHERE id = 1;
```

**State:** Refund request awaiting admin approval

### Step 8: Admin Approves Refund

**Request:**
```
PATCH /api/escrow/:id/refund-approve
```

**Atomic Transaction:**
```javascript
db.transaction(() => {
  // 1. Restore liquid balance
  UPDATE wallets
  SET balance = 50000,
      investment_balance = 0
  WHERE user_id = 1;

  // 2. Record refund transaction
  INSERT INTO transactions (..., type='refund', ...)

  // 3. Remove from portfolio
  DELETE FROM portfolio WHERE user_id = 1 AND stock_id = 1;

  // 4. Mark escrow as refunded
  UPDATE escrow_transactions SET status = 'refunded' WHERE id = 1;

  // 5. Notify user
  INSERT INTO notifications (...)
})();
```

**State:**
- Liquid balance = ₦50,000
- Investment balance = ₦0
- Escrow marked 'refunded'

---

## API Endpoints Summary

### KYC

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/kyc/submit` | User | Submit KYC documents |
| GET | `/api/kyc/status` | User | Check KYC status |
| POST | `/api/kyc/webhook` | None | Smile callback |

### Wallet

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/wallet/create` | User | Create Paystack DVA |
| GET | `/api/wallet` | User | Get balance (both) |
| GET | `/api/wallet/dva` | User | Get DVA details |
| POST | `/api/wallet/deposit` | User | Test deposit |
| POST | `/api/wallet/withdraw` | User | Withdraw to bank |
| GET | `/api/wallet/transactions` | User | Transaction history |

### Orders

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/orders/place` | User | Buy/sell shares |
| GET | `/api/orders/my-orders` | User | Order history |
| GET | `/api/orders/:id` | User | Order details |

### Escrow

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/escrow/my-investments` | User | View escrow records |
| GET | `/api/escrow/:id` | User | Escrow details |
| POST | `/api/escrow/:id/request-refund` | User | Request refund |
| PATCH | `/api/escrow/:id/confirm` | Admin | Confirm holding |
| PATCH | `/api/escrow/:id/refund-approve` | Admin | Approve refund |

---

## Database Schema Changes

### wallets (Extended)

```sql
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  balance REAL DEFAULT 0,          -- Liquid cash
  investment_balance REAL DEFAULT 0, -- Shares held
  currency TEXT DEFAULT 'NGN',
  paystack_customer_code TEXT,       -- For DVA
  dva_account_number TEXT,           -- DVA number
  dva_bank_name TEXT,                -- DVA bank
  dva_bank_code TEXT,                -- DVA code
  wallet_created INTEGER DEFAULT 0,  -- Flag: DVA created?
  created_at DATETIME,
  updated_at DATETIME
);
```

### escrow_transactions (New)

```sql
CREATE TABLE escrow_transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  stock_id INTEGER NOT NULL,
  stock_ticker TEXT,
  stock_name TEXT,
  amount REAL NOT NULL,           -- ₦ amount invested
  quantity INTEGER NOT NULL,      -- shares count
  status TEXT DEFAULT 'pending_trustee',  -- escrow status
  trustee_wallet TEXT,            -- Future: trustee address
  trustee_reference TEXT,         -- Future: trustee tx ref
  notes TEXT,                     -- e.g., refund reason
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (stock_id) REFERENCES stocks(id)
);
```

### users (Extended)

```sql
ALTER TABLE users ADD COLUMN document_type TEXT;      -- passport, national_id, etc.
ALTER TABLE users ADD COLUMN document_number TEXT;    -- Doc ID
ALTER TABLE users ADD COLUMN smile_job_id TEXT;       -- Smile verification ID
ALTER TABLE users ADD COLUMN liveness_passed INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN kyc_submitted_at DATETIME;
```

---

## Security Considerations

### 1. **Race Conditions**
- ✅ All wallet updates wrapped in `db.transaction()`
- ✅ No partial updates possible
- ✅ Concurrent requests safe

### 2. **Regulatory Compliance**
- ✅ KYC mandatory before wallet creation
- ✅ Funds never held by DotVests (Paystack/Trustee)
- ✅ Audit trail in transactions + escrow tables

### 3. **Webhook Security**
- ✅ Paystack webhook: HMAC signature validation
- ✅ Smile webhook: Signature validation (to implement)
- ✅ DVA webhook: Idempotent (only notifications)

### 4. **Admin Access**
- ✅ Escrow confirmation/refund: `adminOnly` middleware
- ✅ Cannot be triggered by regular users

---

## Future: Trustee Integration

When trustee is sourced (by June), add:

1. **Update escrow record:**
   ```sql
   UPDATE escrow_transactions
   SET trustee_wallet = '0x...',
       trustee_reference = 'trustee_tx_hash',
       status = 'held'
   WHERE id = 1;
   ```

2. **Trustee API:**
   - Call trustee API to move funds to their wallet
   - Store `trustee_reference` for tracking
   - Trustee confirms receipt (webhook)

3. **Refund Flow:**
   - User requests refund
   - Admin approves via backend
   - Backend calls trustee API to return funds
   - Funds credited back to liquid balance
   - Mark escrow as `refunded`

---

## Testing Checklist

- [ ] KYC submission → status = 'pending'
- [ ] Smile webhook → status = 'verified'
- [ ] Wallet creation before KYC → fails (403)
- [ ] Wallet creation after KYC → DVA created
- [ ] Paystack deposit webhook → balance credited
- [ ] Buy order → atomic: balance ↓, investment_balance ↑
- [ ] Escrow record → status = 'pending_trustee'
- [ ] Sell order → atomic: investment_balance ↓, balance ↑
- [ ] Escrow status → marked 'sold'
- [ ] Refund request → status = 'refund_pending'
- [ ] Admin refund approval → atomic restore + notification
- [ ] Portfolio consistency throughout
- [ ] No race conditions (load test)

---

## Migration Path

For existing users with balance in old single-wallet system:

```sql
UPDATE wallets
SET balance = balance,           -- existing balance stays
    investment_balance = 0,      -- new field defaults to 0
    wallet_created = 0           -- will need to recreate DVA
WHERE wallet_created IS NULL;
```

**Process:**
1. Existing liquid balance → new `balance` column
2. Set `investment_balance = 0`
3. Set `wallet_created = 0` (need to recreate DVA)
4. Users recreate wallet to get new DVA
5. Old wallet data preserved in `balance`

