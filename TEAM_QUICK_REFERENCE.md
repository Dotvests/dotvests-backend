# Team Quick Reference - Two-Wallet & KYC System

Quick guides for Backend, Frontend, and Admin teams.

---

## Backend Team

### Your Responsibilities
✅ KYC webhook handling (Smile callbacks)
✅ Two-wallet balance management
✅ Escrow transaction tracking
✅ Atomic transaction safety
✅ API endpoints for wallet/orders/escrow

### Key Files
- `routes/kyc.js` — KYC webhook + status endpoint
- `routes/wallet.js` — Wallet creation, balance, deposits
- `routes/orders.js` — Buy/sell orders with escrow
- `routes/escrow.js` — Escrow management (admin approve refunds)
- `config/db.js` — Database schema

### Endpoints Reference

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|--------------|
| `/api/kyc/status` | GET | User | Get user's KYC status |
| `/api/kyc/webhook` | POST | None | Smile sends verification result |
| `/api/wallet/create` | POST | User | Create Paystack DVA (requires verified KYC) |
| `/api/wallet` | GET | User | Get liquid + investment balance |
| `/api/wallet/dva` | GET | User | Get DVA account details |
| `/api/orders/place` | POST | User | Buy/sell shares (requires created wallet) |
| `/api/escrow/my-investments` | GET | User | View escrow records with gains/losses |
| `/api/escrow/:id/request-refund` | POST | User | Request refund |
| `/api/escrow/:id/refund-approve` | PATCH | Admin | Approve refund (atomic transaction) |
| `/api/transactions/history` | GET | User | Get all transactions (deposits, investments, sales, etc.) |
| `/api/transactions/summary` | GET | User | Get transaction stats and totals |
| `/api/transactions/:id` | GET | User | Get single transaction details |

### Testing Commands

```bash
# Set variables
export TOKEN="your_jwt_token"
export BASE="http://localhost:3000/api"

# Check KYC status
curl -H "Authorization: Bearer $TOKEN" $BASE/kyc/status

# Create wallet (requires kyc_status=verified)
curl -X POST -H "Authorization: Bearer $TOKEN" $BASE/wallet/create

# Get balance (both liquid + investment)
curl -H "Authorization: Bearer $TOKEN" $BASE/wallet

# Place buy order
curl -X POST -H "Authorization: Bearer $TOKEN" -d '{"stock_id":1,"type":"buy","quantity":10}' $BASE/orders/place

# View investments
curl -H "Authorization: Bearer $TOKEN" $BASE/escrow/my-investments

# Request refund
curl -X POST -H "Authorization: Bearer $TOKEN" -d '{"reason":"changed mind"}' $BASE/escrow/1/request-refund

# Admin: Approve refund
curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" $BASE/escrow/1/refund-approve
```

### Key Rules
- 🚫 **Never hold user funds** — They sit at Paystack or in escrow
- 🔒 **Always use db.transaction()** — Prevents race conditions
- ✅ **KYC must be verified** — Before wallet creation
- ✅ **Wallet must be created** — Before trading (DVA required)
- 📝 **Validate Smile signature** — On webhook (HMAC-SHA256)

### Common Scenarios

**User wants to buy shares:**
1. Check kyc_status = 'verified' ✅
2. Check wallet_created = 1 ✅
3. Check balance >= amount ✅
4. Wrap in db.transaction():
   - Deduct from balance
   - Add to investment_balance
   - Update portfolio
   - Create order + escrow
5. After commit: Blockchain mint (best-effort)

**User wants refund:**
1. User calls POST `/escrow/:id/request-refund`
2. Status changes to 'refund_pending'
3. Admin sees it in dashboard
4. Admin calls PATCH `/escrow/:id/refund-approve`
5. Wrap in db.transaction():
   - Credit balance
   - Deduct investment_balance
   - Remove from portfolio
   - Mark escrow 'refunded'
6. User notified automatically

---

## Frontend Team

### Your Responsibilities
✅ Smile Identity SDK integration
✅ Liveness detection (via Smile)
✅ Document capture (via Smile)
✅ KYC form & polling
✅ Wallet creation UX
✅ Buy/sell order forms
✅ Portfolio & escrow views

### Key Resources
- [SMILE_SDK_FRONTEND_INTEGRATION.md](SMILE_SDK_FRONTEND_INTEGRATION.md) — Complete Smile SDK guide
- [FRONTEND_INTEGRATION_TWO_WALLET.md](FRONTEND_INTEGRATION_TWO_WALLET.md) — Full wallet/escrow UX guide

### Smile SDK Flow
```
1. User clicks "Start KYC"
   ↓
2. Show Smile SDK WebView
   - User does liveness check
   - User scans document
   - Smile gives real-time feedback
   ↓
3. Smile SDK returns job_id
   ↓
4. POST to /api/kyc/submit { smile_job_id }
   ↓
5. Poll GET /api/kyc/status every 10s
   ↓
6. When kyc_status = 'verified'
   - Show success message
   - Enable wallet creation button
```

### Endpoints You'll Call

**KYC Flow:**
```javascript
// 1. After Smile SDK completes
POST /api/kyc/submit
{ "smile_job_id": "job_xxx" }

// 2. Poll for result
GET /api/kyc/status
// Returns: { kyc_status: "verified" | "pending" | "rejected" }
```

**Wallet Creation:**
```javascript
// Create DVA
POST /api/wallet/create
// Returns: { account_number, bank_name, bank_code }

// Get balance
GET /api/wallet
// Returns: { balance, investment_balance, total_balance }

// Get DVA details for display
GET /api/wallet/dva
// Returns: { account_number, bank_name, bank_code }
```

**Transaction History (All-in-One):**
```javascript
// Get all transactions (deposits, investments, sales, withdrawals, refunds)
GET /api/transactions/history?type=all&limit=50&offset=0
// Returns: [{ id, type, amount, description, status, icon, color, created_at }]

// Get transaction summary/stats
GET /api/transactions/summary
// Returns: { overall: { total_deposits, total_invested, ... }, by_type: [...] }

// Get single transaction details
GET /api/transactions/:id
// Returns: { ...transaction, related_data: { stock_ticker, quantity, status } }
```

**Orders:**
```javascript
// Buy shares
POST /api/orders/place
{ "stock_id": 1, "type": "buy", "quantity": 10 }
// Returns: { order_id, escrow_id, total, status }

// Sell shares
POST /api/orders/place
{ "stock_id": 1, "type": "sell", "quantity": 5 }
// Returns: { order_id, total, status }
```

**Escrow:**
```javascript
// View all investments with gains/losses
GET /api/escrow/my-investments
// Returns: [{ id, stock_ticker, amount, quantity, current_value, unrealised_gain, status }]

// Request refund
POST /api/escrow/:id/request-refund
{ "reason": "changed my mind" }
// Returns: { status: "refund_pending" }
```

### UI Screens to Build

1. **KYC Screen**
   - Show current status badge
   - Button to start Smile SDK
   - When complete: show success, enable next step

2. **Wallet Screen**
   - Show liquid balance (available)
   - Show investment balance (locked in shares)
   - Show DVA account for deposits
   - Show transaction history

3. **Investment Screen**
   - List escrow records
   - Show current value + unrealised gains
   - Show "Sell" button (if confirmed)
   - Show "Request Refund" button
   - Show escrow status badge

4. **Admin Dashboard**
   - List pending KYC approvals
   - List pending refund requests
   - "Approve Refund" button

### Key Rules
- 🚫 **Don't send images to backend** — Smile SDK handles it
- 🚫 **Don't call Smile API directly** — Only use frontend SDK
- ✅ **Poll /api/kyc/status** — Every 10 seconds while pending
- ✅ **Validate responses** — Check success flag
- 🔒 **Store JWT in secure storage** — Not localStorage

### Environment Variables
```env
REACT_APP_SMILE_PARTNER_ID=your_partner_id  # From Smile
REACT_APP_API_BASE=http://localhost:3000    # Backend URL
```

### Dependencies
```json
{
  "@smileidentity/web-core": "^X.Y.Z",
  "axios": "^1.0.0"
}
```

---

## Admin Team

### Your Responsibilities
✅ Approve/reject pending refunds
✅ Monitor escrow status
✅ View KYC submissions
✅ Handle escalations

### Admin Endpoints

**Get all pending refunds:**
```bash
# Need to create this — for now, query escrow table directly
sqlite3 db/dotvests.db "SELECT * FROM escrow_transactions WHERE status = 'refund_pending';"
```

**Approve refund:**
```bash
curl -X PATCH "http://localhost:3000/api/escrow/:id/refund-approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**View investment details:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/api/escrow/:id"
```

### Dashboard Recommendations

**Pending Refunds View:**
```
┌─────────────────────────────────────────┐
│ Pending Refund Requests (5)              │
├─────────────────────────────────────────┤
│ User      │ Amount   │ Stock    │ Action │
├─────────────────────────────────────────┤
│ John Doe  │ ₦20,000  │ SEPLF    │ ✅    │
│ Jane Smith│ ₦50,000  │ WAPCO    │ ✅    │
│ ...       │ ...      │ ...      │ ...   │
└─────────────────────────────────────────┘
```

**Escrow Status View:**
```
Filter by:
- Status: pending_trustee | confirmed | refund_pending | refunded | sold
- Date range
- User

Show:
- User name
- Stock ticker
- Amount invested
- Current value
- Unrealised gain/loss
- Status
- Action (if refund_pending: Approve/Reject)
```

### Common Tasks

**Approve a Refund:**
1. Go to Pending Refunds
2. Review reason
3. Check portfolio consistency
4. Click "Approve Refund"
5. System automatically:
   - Credits balance
   - Deducts investment_balance
   - Removes from portfolio
   - Sends user notification

**Check Investment Details:**
1. Go to Investments/Escrow
2. Click stock ticker
3. View:
   - Amount invested
   - Current price
   - Shares held
   - Unrealised gain/loss
   - Current escrow status
   - Timeline (when bought, when should confirm, etc.)

**Monitor for Issues:**
- Check for stuck `pending_trustee` escrows (too old → may need manual intervention)
- Check for `refund_pending` requests (should approve/reject in SLA)
- Alert if blockchain mint/burn fails (but order already placed)

### Database Queries

**Pending refunds:**
```sql
SELECT id, user_id, stock_name, amount, quantity, notes
FROM escrow_transactions
WHERE status = 'refund_pending'
ORDER BY updated_at DESC;
```

**User's escrow timeline:**
```sql
SELECT id, stock_ticker, amount, quantity, status, created_at, updated_at
FROM escrow_transactions
WHERE user_id = 1
ORDER BY created_at DESC;
```

**Escrows by status:**
```sql
SELECT status, COUNT(*) as count
FROM escrow_transactions
GROUP BY status;
```

### Integration with Trustee (Future)

When trustee is sourced (June):
1. Instead of just storing escrow locally, call trustee API
2. Trustee returns wallet address to transfer to
3. Store `trustee_wallet`, `trustee_reference` in escrow record
4. Update status to `held` (trustee confirmed holding)
5. When refund approved: call trustee API to transfer back
6. Update status to `refunded` when trustee confirms

---

## Support & Debugging

### Backend Issues

**Wallet creation fails:**
1. Check kyc_status = 'verified'
2. Check PAYSTACK_SECRET_KEY is correct
3. Check Paystack API is accessible
4. Check error message in response

**Order fails:**
1. Check kyc_status = 'verified'
2. Check wallet_created = 1
3. Check balance >= amount
4. Check blockchain service is up (logs)

**Escrow not created:**
1. Check transaction rolled back (check DB)
2. Check order was inserted
3. Check stock_id is valid

### Frontend Issues

**Smile SDK not showing:**
1. Check SMILE_PARTNER_ID is set
2. Check SDK is imported correctly
3. Check network request to Smile API succeeds
4. Check browser console for errors

**KYC stuck at pending:**
1. Check webhook is configured in Smile dashboard
2. Check webhook URL points to correct backend
3. Check backend logs for webhook errors
4. Manually trigger webhook: `curl POST /api/kyc/webhook ...`

**Wallet creation button not showing:**
1. Check kyc_status in DB
2. Check polling is happening (check network tab)
3. Check webhook was received (check backend logs)
4. Check for JS errors in console

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "KYC verification required" | kyc_status != 'verified' | Complete KYC |
| "Wallet already created" | wallet_created = 1 | User already has wallet |
| "Insufficient balance" | balance < amount | User needs to deposit |
| "Insufficient holdings" | portfolio qty < sell qty | User doesn't have enough shares |
| "Invalid Smile signature" | Webhook tampered or key wrong | Check SMILE_API_KEY |

### Where to Check

**KYC Status:**
```bash
sqlite3 db/dotvests.db "SELECT id, kyc_status, smile_job_id FROM users WHERE id = 1;"
```

**Wallet Status:**
```bash
sqlite3 db/dotvests.db "SELECT user_id, balance, investment_balance, wallet_created FROM wallets WHERE user_id = 1;"
```

**Escrow Records:**
```bash
sqlite3 db/dotvests.db "SELECT id, user_id, stock_ticker, status FROM escrow_transactions WHERE user_id = 1;"
```

**Recent Errors (logs):**
```bash
tail -f logs/app.log | grep -i "error\|webhook\|smile\|escrow"
```

---

## Documentation Index

- **[SMILE_SDK_FRONTEND_INTEGRATION.md](SMILE_SDK_FRONTEND_INTEGRATION.md)** — Frontend team reads this
- **[FRONTEND_INTEGRATION_TWO_WALLET.md](FRONTEND_INTEGRATION_TWO_WALLET.md)** — Complete wallet/escrow flow
- **[TWO_WALLET_ARCHITECTURE.md](TWO_WALLET_ARCHITECTURE.md)** — Deep technical dive
- **[TESTING_TWO_WALLET_SYSTEM.md](TESTING_TWO_WALLET_SYSTEM.md)** — Test scenarios & curl commands
- **[SMILE_INTEGRATION_REFACTOR_SUMMARY.md](SMILE_INTEGRATION_REFACTOR_SUMMARY.md)** — Why we changed the approach

---

## Deployment Checklist

Before going to production:

**Backend:**
- [ ] PAYSTACK_SECRET_KEY configured
- [ ] SMILE_API_KEY configured
- [ ] Database migrations applied
- [ ] Webhook URLs configured (Smile)
- [ ] Blockchain config (PLATFORM_WALLET, etc.)

**Frontend:**
- [ ] SMILE_PARTNER_ID configured
- [ ] API_BASE points to production
- [ ] Smile SDK integrated
- [ ] KYC flow tested end-to-end
- [ ] Wallet creation tested

**Admin:**
- [ ] Admin dashboard built
- [ ] Refund approval workflow tested
- [ ] Notifications tested

**Operations:**
- [ ] Logging configured
- [ ] Error alerts set up
- [ ] Webhook monitoring enabled
- [ ] Database backups scheduled

