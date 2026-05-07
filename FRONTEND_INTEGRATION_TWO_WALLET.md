# DotVests Two-Wallet & Escrow System - Frontend Integration Guide

This guide explains how to integrate the two-wallet system (liquid cash + investments) with escrow tracking on the frontend.

---

## Architecture Overview

**Two Wallets:**
1. **Liquid Balance** (`balance`) — Cash held at Paystack in a Dedicated Virtual Account (DVA)
2. **Investment Balance** (`investment_balance`) — Funds tied up in stock investments, held in escrow

**Flow:**
```
User registers
  → Completes KYC via Smile Identity
  → Creates wallet (Paystack DVA created)
  → Deposits cash to DVA account number
  → Cash appears in liquid balance
  → Buys shares → liquid balance decreases, investment balance increases
  → Trustee confirms holding shares in escrow
  → Can sell anytime → proceeds go back to liquid balance
```

---

## Step 1: KYC Verification (via Smile Identity SDK)

**Note:** KYC verification happens on the frontend using Smile Identity SDK. See [SMILE_SDK_FRONTEND_INTEGRATION.md](SMILE_SDK_FRONTEND_INTEGRATION.md) for complete frontend implementation guide.

### Frontend Flow:
1. User clicks "Start KYC Verification"
2. Frontend opens Smile SDK WebView/Modal
3. User completes:
   - Liveness check (selfie video)
   - Document scan (ID document)
   - Biometric matching
4. Smile SDK returns `job_id`
5. Frontend sends `job_id` to backend

### Endpoint: POST /api/kyc/submit

**Request Body:**
```json
{
  "smile_job_id": "job_605e3a2b4de6c30022d5c11b"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "KYC submitted successfully",
  "status": "pending",
  "smile_job_id": "job_605e3a2b4de6c30022d5c11b",
  "kyc_submitted_at": "2026-05-07T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "KYC already verified for this account"
}
```

### Check KYC Status

**Endpoint:** GET /api/kyc/status

**Response:**
```json
{
  "success": true,
  "data": {
    "kyc_status": "pending",
    "smile_job_id": "job_605e3a2b4de6c30022d5c11b",
    "submitted_at": "2026-05-07T10:30:00Z"
  }
}
```

**Status Values:**
- `unverified` — User hasn't submitted KYC
- `pending` — KYC submitted, awaiting Smile verification (1-2 minutes usually)
- `verified` — KYC approved by Smile, can proceed to wallet creation
- `rejected` — KYC failed, cannot trade

### Smile Webhook (Automatic)

When Smile completes verification, it automatically sends a webhook to:
```
POST /api/kyc/webhook
```

Backend receives this and updates `kyc_status` to `verified` or `rejected`. Frontend should poll `/api/kyc/status` (every 10 seconds) to detect when verification is complete.

---

## Step 2: Create Wallet (Paystack DVA)

### Endpoint: POST /api/wallet/create

**Request Body:** (empty)

**Response (Success):**
```json
{
  "success": true,
  "message": "Wallet created successfully",
  "data": {
    "account_number": "1234567890",
    "bank_name": "Wema Bank",
    "bank_code": "035",
    "account_type": "individual"
  }
}
```

**What happens:**
1. Backend creates Paystack customer record
2. Backend creates Dedicated Virtual Account (DVA)
3. User receives unique account number for deposits
4. `wallet_created` flag set to 1

**Display on Frontend:**
Show user their dedicated account number and bank name so they can transfer money to it.

```
Your DotVests Wallet
──────────────────
Account Number: 1234567890
Bank: Wema Bank
Bank Code: 035

⬇️ Transfer money here to fund your wallet
```

---

## Step 3: Get Wallet Balance

### Endpoint: GET /api/wallet

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "balance": 50000.00,
    "investment_balance": 20000.00,
    "currency": "NGN",
    "dva_account_number": "1234567890",
    "wallet_created": 1,
    "total_balance": 70000.00,
    "updated_at": "2026-05-07T12:00:00Z"
  }
}
```

**Display on Frontend:**
```
💰 Wallet Summary
────────────────
Liquid Balance:      ₦50,000.00
Investment Balance:  ₦20,000.00
────────────────
Total Balance:       ₦70,000.00
```

---

## Step 4: Buy Shares (Create Investment)

### Endpoint: POST /api/orders/place

**Request Body:**
```json
{
  "stock_id": 1,
  "type": "buy",
  "quantity": 10
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "BUY order executed successfully",
  "order": {
    "id": 1,
    "stock": "SEPLF",
    "type": "buy",
    "quantity": 10,
    "price": 2000,
    "total": 20000,
    "escrow_id": 1,
    "blockchain": {
      "success": true,
      "txHash": "0x123..."
    }
  }
}
```

**What happens:**
1. ✅ KYC must be verified
2. ✅ Wallet must be created
3. Liquid balance checked for sufficient funds
4. Transaction is **atomic** (all-or-nothing):
   - Liquid balance **decreases** by ₦20,000
   - Investment balance **increases** by ₦20,000
   - Portfolio updated with 10 units of SEPLF
   - Order record created
   - **Escrow record created** with status `pending_trustee`
5. User receives notification: "You invested ₦20,000 in 10 units of SEPLF. Awaiting escrow confirmation."
6. Blockchain tokens minted (best-effort, doesn't rollback order)

**State Change:**
```
Before:
  Liquid: ₦50,000
  Investment: ₦0

After:
  Liquid: ₦30,000
  Investment: ₦20,000
```

---

## Step 5: View My Investments (Escrow Details)

### Endpoint: GET /api/escrow/my-investments

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "stock_id": 1,
      "stock_ticker": "SEPLF",
      "stock_name": "Seplat Petroleum",
      "amount": 20000,
      "quantity": 10,
      "status": "pending_trustee",
      "current_price": 2050,
      "current_value": 20500,
      "unrealised_gain": 500,
      "created_at": "2026-05-07T10:00:00Z",
      "updated_at": "2026-05-07T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Display on Frontend:**
```
📊 Your Investments
──────────────────
Stock: Seplat Petroleum (SEPLF)
Quantity: 10 units
Entry Price: ₦2,000/unit
Current Price: ₦2,050/unit
─────────────────
Invested: ₦20,000
Current Value: ₦20,500
Gain/Loss: +₦500 (unrealised)

Status: Awaiting Trustee Confirmation ⏳
```

---

## Step 6: Sell Shares

### Endpoint: POST /api/orders/place

**Request Body:**
```json
{
  "stock_id": 1,
  "type": "sell",
  "quantity": 5
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "SELL order executed successfully",
  "order": {
    "id": 2,
    "stock": "SEPLF",
    "type": "sell",
    "quantity": 5,
    "price": 2050,
    "total": 10250,
    "blockchain": {
      "success": true,
      "txHash": "0x456..."
    }
  }
}
```

**What happens:**
1. Portfolio checked for sufficient units
2. Transaction is **atomic**:
   - Investment balance **decreases** by ₦10,250
   - Liquid balance **increases** by ₦10,250
   - Portfolio updated (5 units removed, 5 units remain)
   - Order record created
   - Corresponding escrow record marked as `sold`
3. User receives notification about the sale
4. Blockchain tokens burned (best-effort)

**State Change:**
```
Before (after the buy order):
  Liquid: ₦30,000
  Investment: ₦20,000

After selling 5 units at ₦2,050 each:
  Liquid: ₦40,250
  Investment: ₦9,750 (5 units still held)
```

---

## Step 7: Request Refund (User-Initiated)

### Endpoint: POST /api/escrow/:id/request-refund

**Request Body:**
```json
{
  "reason": "I no longer wish to hold this investment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund requested",
  "data": {
    "escrow_id": 1,
    "status": "refund_pending"
  }
}
```

**What happens:**
1. Escrow status changes to `refund_pending`
2. Admin/Trustee sees pending refund requests
3. User receives notification: "Your refund request has been submitted and is awaiting trustee approval."

---

## Step 8: Admin Approves Refund

### Endpoint: PATCH /api/escrow/:id/refund-approve

**Note:** Admin-only endpoint (requires `admin` role)

**Response:**
```json
{
  "success": true,
  "message": "Refund approved and processed",
  "data": {
    "escrow_id": 1,
    "status": "refunded",
    "amount_refunded": 20000,
    "updated_at": "2026-05-07T14:00:00Z"
  }
}
```

**What happens (atomic transaction):**
1. Escrow status marked as `refunded`
2. Liquid balance **increased** by investment amount
3. Investment balance **decreased** by investment amount
4. Portfolio entries removed
5. Transaction record created (type: `refund`)
6. User notified: "Your investment of ₦20,000 in SEPLF has been refunded to your wallet."

**State Change:**
```
Before refund:
  Liquid: ₦30,000
  Investment: ₦20,000

After refund:
  Liquid: ₦50,000
  Investment: ₦0
```

---

## Transaction History

### Endpoint: GET /api/wallet/transactions

**Query Parameters:**
- `type` — `all`, `investment`, `sell`, `deposit`, `withdrawal`, `refund`
- `limit` — Number of results (default: 20)
- `offset` — Pagination offset (default: 0)
- `start_date` — Filter from date (YYYY-MM-DD)
- `end_date` — Filter to date (YYYY-MM-DD)

**Example Request:**
```
GET /api/wallet/transactions?type=investment&limit=10&offset=0
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "total_count": 5,
  "transactions": [
    {
      "id": 1,
      "user_id": 1,
      "type": "investment",
      "amount": 20000,
      "description": "Invested ₦20,000 in SEPLF",
      "reference": "BUY-1715077200000-1",
      "status": "completed",
      "created_at": "2026-05-07T10:00:00Z"
    }
  ]
}
```

---

## Escrow Status Lifecycle

```
pending_trustee
    ↓
  (Trustee confirms holding, or user requests refund)
    ↓
confirmed OR refund_pending
    ↓
(If confirmed, user can sell or request refund later)
(If refund_pending, waiting for trustee approval)
    ↓
refunded (if refund approved) OR sold (if user sells)
```

---

## Error Handling

### Common Errors

**1. KYC Not Verified**
```json
{
  "success": false,
  "message": "KYC verification required before trading"
}
```
→ User must complete KYC via POST /api/kyc/submit

**2. Wallet Not Created**
```json
{
  "success": false,
  "message": "Please create a wallet first before trading"
}
```
→ User must create wallet via POST /api/wallet/create

**3. Insufficient Balance**
```json
{
  "success": false,
  "message": "Insufficient balance. You need ₦20,000 but have ₦15,000"
}
```
→ User must deposit more funds to DVA

**4. Insufficient Holdings**
```json
{
  "success": false,
  "message": "Insufficient holdings. You only have 5 units of SEPLF"
}
```
→ User can only sell units they own

---

## Frontend UI Recommendations

### 1. KYC Screen
- Show status badge (Unverified → Pending → Verified)
- Form for BVN, NIN, document upload, selfie
- Show Smile Identity instructions
- Poll GET /api/kyc/status for real-time updates

### 2. Wallet Screen
- Show liquid balance prominently (available to invest/withdraw)
- Show investment balance separately (locked in investments)
- Show DVA account number with copy button
- Show "Deposit" button linking to bank transfer instructions
- Transaction history below

### 3. Investment Screen
- List all escrow records from GET /api/escrow/my-investments
- Show current unrealised gains/losses
- Show escrow status (pending/confirmed/refunded)
- "Sell" button if confirmed
- "Request Refund" button
- Link to detailed escrow view

### 4. Order Placement
- After buy order succeeds, show escrow confirmation message
- After sell order succeeds, show proceeds credited to wallet
- Show blockchain tx hash if successful

### 5. Admin Refund Dashboard
- List all escrow records with status filters
- Show refund_pending escrow records prominently
- "Approve Refund" button for admin
- Confirmation modal before approving

---

## Webhooks (Automatic Updates)

The backend sends these events to the frontend via notifications (stored in DB):

1. **Wallet Created** — "Your DotVests wallet has been created..."
2. **DVA Ready** — "Your dedicated virtual account is ready to receive transfers..."
3. **Deposit Successful** — "₦50,000 has been added to your wallet"
4. **Investment Placed** — "You invested ₦20,000 in 10 units of SEPLF. Awaiting escrow confirmation."
5. **Investment Confirmed** — "Your investment has been confirmed and is held in escrow."
6. **Sell Order Executed** — "You sold 5 units of SEPLF at ₦2,050 each"
7. **Refund Request Submitted** — "Your refund request is awaiting trustee approval."
8. **Investment Refunded** — "Your investment of ₦20,000 has been refunded to your wallet."

**Endpoint:** GET /api/user (includes notifications array)

---

## Testing Checklist

- [ ] User registers and kyc_status = 'unverified'
- [ ] POST /api/kyc/submit sets kyc_status = 'pending'
- [ ] Simulate Smile webhook to set kyc_status = 'verified'
- [ ] POST /api/wallet/create fails before kyc_status = 'verified'
- [ ] POST /api/wallet/create succeeds after KYC verified, returns DVA details
- [ ] Simulate Paystack webhook for deposit to credit balance
- [ ] POST /api/orders/place (buy) fails before wallet created
- [ ] Buy order succeeds, balance decreases, investment_balance increases
- [ ] Escrow record created with status = 'pending_trustee'
- [ ] GET /api/escrow/my-investments shows created escrow
- [ ] Sell order succeeds, investment_balance decreases, balance increases
- [ ] Escrow marked as 'sold'
- [ ] Admin PATCH /api/escrow/:id/confirm updates status to 'confirmed'
- [ ] Admin PATCH /api/escrow/:id/refund-approve refunds funds correctly
- [ ] All notifications appear in user's notification list

