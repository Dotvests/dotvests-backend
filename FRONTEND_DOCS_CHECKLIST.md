# Frontend Documentation Checklist

Complete list of all documentation files the frontend team should read for implementation.

---

## 📋 Must-Read Documentation (In Order)

### 1. KYC Implementation
**File:** [SMILE_SDK_FRONTEND_INTEGRATION.md](SMILE_SDK_FRONTEND_INTEGRATION.md)
- Smile SDK integration
- Liveness detection + document capture
- How to get `job_id` from Smile
- Code examples (React, React Native, iOS, Android)
- Polling for verification result

**What to build:** KYC Screen with Smile SDK

---

### 2. Wallet & Investment System
**File:** [FRONTEND_INTEGRATION_TWO_WALLET.md](FRONTEND_INTEGRATION_TWO_WALLET.md)
- Complete wallet creation flow
- DVA account for deposits
- Two-wallet concept (liquid vs investment balance)
- Buying & selling shares
- Viewing escrow investments with gains/losses
- Requesting refunds
- UI recommendations

**What to build:** Wallet screen, Investment screen

---

### 3. Transaction History
**File:** [TRANSACTION_HISTORY_API.md](TRANSACTION_HISTORY_API.md)
- Unified transaction endpoint
- All transaction types (deposits, investments, sales, withdrawals, refunds)
- Filtering by type, date range
- Pagination
- Summary/stats endpoint
- React component example + HTML/CSS example

**What to build:** Transaction History page

---

### 4. Quick Reference
**File:** [TEAM_QUICK_REFERENCE.md](TEAM_QUICK_REFERENCE.md) → **Frontend Team** section
- Quick endpoint reference
- Common API calls
- UI screens checklist
- Environment variables
- Dependencies
- Common errors & debugging

**What to use:** Keep as bookmark for daily reference

---

## 📚 Reference Documentation

### 5. Architecture Overview (Optional)
**File:** [TWO_WALLET_ARCHITECTURE.md](TWO_WALLET_ARCHITECTURE.md)
- Deep technical dive
- Why two wallets exist
- Escrow status lifecycle
- Wallet lifecycle diagram
- Why things work the way they do

**When to read:** If you need to understand the "why" behind design decisions

---

### 6. Testing Guide (For QA)
**File:** [TESTING_TWO_WALLET_SYSTEM.md](TESTING_TWO_WALLET_SYSTEM.md)
- Test scenarios with curl commands
- How to verify each feature
- Common issues & fixes
- Database queries for debugging

**When to read:** Before testing, or when debugging issues

---

## 🎯 Frontend Implementation Roadmap

### Phase 1: KYC (Week 1)
**Required docs:** SMILE_SDK_FRONTEND_INTEGRATION.md + TEAM_QUICK_REFERENCE.md
```
✓ Integrate Smile SDK package
✓ Build KYC screen
✓ Handle Smile job_id response
✓ POST to /api/kyc/submit
✓ Poll /api/kyc/status
✓ Show verification result
```

**Checklist:**
- [ ] Smile SDK integrated
- [ ] Liveness detection works
- [ ] Document capture works
- [ ] job_id sent to backend
- [ ] Polling shows "verified"
- [ ] Verified users see wallet button

---

### Phase 2: Wallet & Escrow (Week 2)
**Required docs:** FRONTEND_INTEGRATION_TWO_WALLET.md + TEAM_QUICK_REFERENCE.md
```
✓ Create wallet (Paystack DVA)
✓ Display DVA account for deposits
✓ Show balance (liquid + investment)
✓ Buy shares (escrow created)
✓ View escrow investments
✓ Sell shares
✓ Request refunds
```

**Checklist:**
- [ ] Wallet creation screen
- [ ] DVA displayed with copy button
- [ ] Balance shown (both liquid & investment)
- [ ] Buy order form
- [ ] Investments list with gains/losses
- [ ] Sell button functional
- [ ] Refund request form

---

### Phase 3: Transaction History (Week 3)
**Required docs:** TRANSACTION_HISTORY_API.md + TEAM_QUICK_REFERENCE.md
```
✓ Unified transaction page
✓ All transaction types visible
✓ Filter by type
✓ Filter by date range
✓ Pagination
✓ Show summary/stats
✓ Icons & colors per type
```

**Checklist:**
- [ ] Transaction list displays
- [ ] Filters work (type, date)
- [ ] Pagination works
- [ ] Icons display correctly
- [ ] Colors match transaction type
- [ ] Summary stats show
- [ ] Mobile responsive

---

### Phase 4: Admin Dashboard (Week 4)
**Required docs:** TEAM_QUICK_REFERENCE.md (Admin section)
```
✓ View pending refund requests
✓ Approve/reject refunds
✓ View escrow status
✓ Monitor investments
```

**Checklist:**
- [ ] Pending refunds list
- [ ] Approve button functional
- [ ] Escrow view complete
- [ ] Admin-only access

---

## 🔧 Environment Setup

### Frontend .env Variables
```env
REACT_APP_SMILE_PARTNER_ID=your_smile_partner_id
REACT_APP_API_BASE=http://localhost:3000
REACT_APP_JWT_KEY=your_jwt_storage_key
```

### Dependencies to Install
```json
{
  "@smileidentity/web-core": "^X.Y.Z",
  "axios": "^1.0.0",
  "react": "^18.0.0",
  "react-router-dom": "^6.0.0"
}
```

---

## 📱 Screen Checklist

### KYC Screen
- [ ] Status badge (Unverified → Pending → Verified)
- [ ] Smile SDK WebView/modal
- [ ] Liveness check indicator
- [ ] Document scan indicator
- [ ] Real-time feedback from Smile
- [ ] Success message
- [ ] Error handling & retry

**Reference:** SMILE_SDK_FRONTEND_INTEGRATION.md

---

### Wallet Screen
- [ ] Liquid balance display (₦30,000)
- [ ] Investment balance display (₦20,000)
- [ ] Total balance (₦50,000)
- [ ] DVA account number (with copy button)
- [ ] Bank name (Wema Bank)
- [ ] Deposit instructions
- [ ] Transaction history link

**Reference:** FRONTEND_INTEGRATION_TWO_WALLET.md

---

### Investment Screen
- [ ] List of escrow investments
- [ ] Stock ticker & name (SEPLF)
- [ ] Units owned (10)
- [ ] Entry price (₦2,000)
- [ ] Current price (₦2,050)
- [ ] Current value (₦20,500)
- [ ] Unrealised gain (₦500, +2.5%)
- [ ] Status badge (pending_trustee, confirmed, refunded, sold)
- [ ] Sell button (if confirmed)
- [ ] Request Refund button
- [ ] View details link

**Reference:** FRONTEND_INTEGRATION_TWO_WALLET.md

---

### Transaction History Screen
- [ ] Filter by type dropdown (All, Deposits, Investments, Sales, Withdrawals, Refunds)
- [ ] Date range filter (From, To)
- [ ] Transaction list (reverse chronological)
  - [ ] Icon per type (💰, 📈, 📉, 💸, ↩️)
  - [ ] Description
  - [ ] Date
  - [ ] Amount
  - [ ] Status badge
  - [ ] Color coding
- [ ] Pagination (Previous, Page #, Next)
- [ ] Summary stats section
  - [ ] Total transactions
  - [ ] Total deposits
  - [ ] Total invested
  - [ ] Total from sales
  - [ ] Total withdrawn
  - [ ] Total refunded

**Reference:** TRANSACTION_HISTORY_API.md

---

### Admin Dashboard
- [ ] Pending refunds list
  - [ ] User name
  - [ ] Amount
  - [ ] Stock
  - [ ] Reason
- [ ] Approve button
- [ ] Reject option
- [ ] View full investment details
- [ ] Confirmation modal

**Reference:** TEAM_QUICK_REFERENCE.md (Admin section)

---

## 🚀 API Endpoints Summary

**3 Categories:**

### KYC (1 endpoint from frontend)
```
POST /api/kyc/submit { smile_job_id }
GET /api/kyc/status
```

### Wallet (4 endpoints)
```
POST /api/wallet/create
GET /api/wallet
GET /api/wallet/dva
POST /api/wallet/deposit (test only)
```

### Orders (1 endpoint)
```
POST /api/orders/place { stock_id, type, quantity }
```

### Escrow (3 endpoints)
```
GET /api/escrow/my-investments
POST /api/escrow/:id/request-refund
GET /api/escrow/:id (view details)
```

### Transactions (3 endpoints) ⭐ NEW
```
GET /api/transactions/history
GET /api/transactions/summary
GET /api/transactions/:id
```

**Total: 12 endpoints to integrate**

---

## 📖 Quick Reference by Task

### "How do I..."

**...show KYC status?**
→ Read: SMILE_SDK_FRONTEND_INTEGRATION.md

**...display wallet balance?**
→ Read: FRONTEND_INTEGRATION_TWO_WALLET.md, Step 3

**...handle buy order?**
→ Read: FRONTEND_INTEGRATION_TWO_WALLET.md, Step 4

**...build transaction history page?**
→ Read: TRANSACTION_HISTORY_API.md

**...integrate Smile SDK?**
→ Read: SMILE_SDK_FRONTEND_INTEGRATION.md, Step 2 (Installation & Implementation)

**...handle errors?**
→ Read: FRONTEND_INTEGRATION_TWO_WALLET.md, Error Handling section

**...get quick endpoint reference?**
→ Read: TEAM_QUICK_REFERENCE.md, Frontend section

**...test the app?**
→ Read: TESTING_TWO_WALLET_SYSTEM.md (for backend testing to create test data)

---

## 🎓 Reading Time

| Doc | Read Time | Priority |
|-----|-----------|----------|
| SMILE_SDK_FRONTEND_INTEGRATION.md | 20 min | 🔴 Must read |
| FRONTEND_INTEGRATION_TWO_WALLET.md | 25 min | 🔴 Must read |
| TRANSACTION_HISTORY_API.md | 15 min | 🔴 Must read |
| TEAM_QUICK_REFERENCE.md | 10 min | 🔴 Must read |
| TWO_WALLET_ARCHITECTURE.md | 20 min | 🟡 Reference |
| TESTING_TWO_WALLET_SYSTEM.md | 15 min | 🟡 Reference |

**Total essential reading time: ~70 minutes**

---

## ✅ Done Checklist

Once frontend is ready to start implementation:

**Backend Setup:**
- [ ] Backend running (`npm start`)
- [ ] Database migrated
- [ ] .env configured with Smile + Paystack keys
- [ ] All endpoints tested with curl

**Frontend Prep:**
- [ ] React project created
- [ ] Dependencies installed
- [ ] .env configured
- [ ] Smile SDK package added
- [ ] ESLint/Prettier configured

**Documentation:**
- [ ] Team has read SMILE_SDK_FRONTEND_INTEGRATION.md
- [ ] Team has read FRONTEND_INTEGRATION_TWO_WALLET.md
- [ ] Team has read TRANSACTION_HISTORY_API.md
- [ ] Team bookmarked TEAM_QUICK_REFERENCE.md

**Ready to code!** 🚀

---

## 📞 Support

**For KYC questions:**
→ Check SMILE_SDK_FRONTEND_INTEGRATION.md, then Smile docs at https://docs.usesmile.io

**For Wallet/Order questions:**
→ Check FRONTEND_INTEGRATION_TWO_WALLET.md

**For Transaction History:**
→ Check TRANSACTION_HISTORY_API.md

**For quick answers:**
→ Check TEAM_QUICK_REFERENCE.md → Frontend section

**For architecture questions:**
→ Check TWO_WALLET_ARCHITECTURE.md

---

## 📁 File Organization

```
/dotvests-backend/
├── SMILE_SDK_FRONTEND_INTEGRATION.md       ← Frontend KYC guide
├── FRONTEND_INTEGRATION_TWO_WALLET.md      ← Frontend wallet guide
├── TRANSACTION_HISTORY_API.md              ← Frontend transaction guide
├── TEAM_QUICK_REFERENCE.md                 ← Quick reference
├── TWO_WALLET_ARCHITECTURE.md              ← Technical deep dive
├── TESTING_TWO_WALLET_SYSTEM.md            ← Testing guide
├── FRONTEND_DOCS_CHECKLIST.md              ← This file
│
├── routes/
│   ├── kyc.js                              ← KYC endpoints
│   ├── wallet.js                           ← Wallet endpoints
│   ├── orders.js                           ← Order endpoints
│   ├── escrow.js                           ← Escrow endpoints
│   └── transactions.js                     ← Transaction endpoints ⭐ NEW
│
└── index.js                                ← Mounts all routes
```

---

