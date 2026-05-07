# Two-Wallet System - Testing Guide

This guide provides curl commands and test scenarios to verify the two-wallet + escrow system works correctly.

---

## Prerequisites

1. Server running: `npm start`
2. User registered with account
3. JWT token from login ready

**Set variables:**
```bash
export BASE_URL="http://localhost:3000/api"
export USER_TOKEN="your_jwt_token_here"
export ADMIN_TOKEN="admin_jwt_token_here"
```

---

## Test 1: KYC Submission

### Submit KYC

```bash
curl -X POST "$BASE_URL/kyc/submit" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bvn": "11111111111",
    "nin": "00000000000",
    "document_type": "passport",
    "document_number": "DOC123456",
    "address": "123 Main Street, Lagos",
    "selfie_image": "base64_string_or_url"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "status": "pending",
  "smile_job_id": "job_xxx"
}
```

### Check KYC Status

```bash
curl -X GET "$BASE_URL/kyc/status" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "kyc_status": "pending"
}
```

### Simulate Smile Webhook (For Testing)

Since you don't have Smile API credentials yet, simulate the webhook locally:

```bash
curl -X POST "http://localhost:3000/api/kyc/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "test_signature",
    "timestamp": "2026-05-07T10:00:00Z",
    "job_id": "job_xxx",
    "success": true,
    "result": {
      "confidence": "high"
    }
  }'
```

**Note:** The webhook signature validation might fail in test mode. You'll need to update the kyc.js webhook to skip signature validation or accept a test parameter for development.

**Check status again:**
```bash
curl -X GET "$BASE_URL/kyc/status" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Test 2: Wallet Creation

### Create Wallet (Before KYC - Should Fail)

```bash
curl -X POST "$BASE_URL/wallet/create" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Error:**
```json
{
  "success": false,
  "message": "KYC verification required before wallet creation"
}
```

### Simulate KYC Verification

Update the user's kyc_status in the database directly (for testing):

```bash
# Using sqlite directly
sqlite3 db/dotvests.db "UPDATE users SET kyc_status = 'verified' WHERE id = 1;"
```

### Create Wallet (After KYC)

```bash
curl -X POST "$BASE_URL/wallet/create" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
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

**Check in database:**
```bash
sqlite3 db/dotvests.db "SELECT wallet_created, paystack_customer_code, dva_account_number FROM wallets WHERE user_id = 1;"
```

### Get Wallet Balance

```bash
curl -X GET "$BASE_URL/wallet" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "balance": 0,
    "investment_balance": 0,
    "total_balance": 0,
    "wallet_created": 1
  }
}
```

### Get DVA Details

```bash
curl -X GET "$BASE_URL/wallet/dva" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "account_number": "1234567890",
    "bank_name": "Wema Bank",
    "bank_code": "035"
  }
}
```

---

## Test 3: Deposit Funds

### Simulate Paystack Webhook for Deposit

```bash
curl -X POST "http://localhost:3000/api/payment/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Paystack-Signature: test_signature" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "DEP-1234567-1",
      "amount": 5000000,
      "metadata": {
        "user_id": 1
      }
    }
  }'
```

**Note:** The signature validation will fail. For testing, update index.js to allow test mode without signature validation.

**Check wallet balance:**
```bash
sqlite3 db/dotvests.db "SELECT balance, investment_balance FROM wallets WHERE user_id = 1;"
```

### Manually Deposit (Test Endpoint)

```bash
curl -X POST "$BASE_URL/wallet/deposit" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "₦50,000.00 deposited successfully",
  "new_balance": 50000
}
```

**Verify:**
```bash
curl -X GET "$BASE_URL/wallet" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Test 4: Buy Shares (Create Investment)

### Get Available Stocks

```bash
curl -X GET "$BASE_URL/stocks" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response includes:**
```json
[
  {
    "id": 1,
    "ticker": "SEPLF",
    "name": "Seplat Petroleum",
    "price": 2000,
    "is_active": 1
  }
]
```

### Place Buy Order (Before Wallet Created - Should Fail)

First, reset wallet_created for testing:

```bash
sqlite3 db/dotvests.db "UPDATE wallets SET wallet_created = 0 WHERE user_id = 1;"
```

```bash
curl -X POST "$BASE_URL/orders/place" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock_id": 1,
    "type": "buy",
    "quantity": 10
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Please create a wallet first before trading"
}
```

### Enable Wallet and Place Buy Order

```bash
sqlite3 db/dotvests.db "UPDATE wallets SET wallet_created = 1 WHERE user_id = 1;"
```

```bash
curl -X POST "$BASE_URL/orders/place" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock_id": 1,
    "type": "buy",
    "quantity": 10
  }'
```

**Expected Response:**
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
    "escrow_id": 1
  }
}
```

### Verify Wallet Changes

```bash
curl -X GET "$BASE_URL/wallet" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected (balance decreased, investment_balance increased):**
```json
{
  "data": {
    "balance": 30000,
    "investment_balance": 20000,
    "total_balance": 50000
  }
}
```

### Verify Escrow Created

```bash
sqlite3 db/dotvests.db "SELECT id, stock_ticker, amount, quantity, status FROM escrow_transactions WHERE user_id = 1;"
```

**Expected:**
```
1|SEPLF|20000|10|pending_trustee
```

---

## Test 5: View Investments

### Get My Investments

```bash
curl -X GET "$BASE_URL/escrow/my-investments" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "stock_ticker": "SEPLF",
      "stock_name": "Seplat Petroleum",
      "amount": 20000,
      "quantity": 10,
      "status": "pending_trustee",
      "current_price": 2000,
      "current_value": 20000,
      "unrealised_gain": 0
    }
  ]
}
```

### Get Single Investment

```bash
curl -X GET "$BASE_URL/escrow/1" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "stock_ticker": "SEPLF",
    "amount": 20000,
    "status": "pending_trustee"
  }
}
```

---

## Test 6: Sell Shares

### Place Sell Order

```bash
curl -X POST "$BASE_URL/orders/place" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock_id": 1,
    "type": "sell",
    "quantity": 5
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SELL order executed successfully",
  "order": {
    "id": 2,
    "stock": "SEPLF",
    "type": "sell",
    "quantity": 5,
    "price": 2000,
    "total": 10000
  }
}
```

### Verify Wallet Changes

```bash
curl -X GET "$BASE_URL/wallet" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected (investment_balance decreased, balance increased):**
```json
{
  "data": {
    "balance": 40000,
    "investment_balance": 10000,
    "total_balance": 50000
  }
}
```

### Verify Portfolio Updated

```bash
sqlite3 db/dotvests.db "SELECT * FROM portfolio WHERE user_id = 1 AND stock_id = 1;"
```

**Expected (5 units remain):**
```
1|1|1|5|2000|updated_at
```

### Verify Escrow Status Changed

```bash
sqlite3 db/dotvests.db "SELECT status FROM escrow_transactions WHERE user_id = 1 AND id = 1;"
```

**Expected:**
```
sold
```

---

## Test 7: Request Refund

### Request Refund (User)

```bash
curl -X POST "$BASE_URL/escrow/1/request-refund" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Changed my mind"
  }'
```

**Expected Response:**
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

### Check Escrow Status

```bash
sqlite3 db/dotvests.db "SELECT status FROM escrow_transactions WHERE id = 1;"
```

**Expected:**
```
refund_pending
```

---

## Test 8: Admin Approve Refund

### Approve Refund (Admin Only)

```bash
curl -X PATCH "$BASE_URL/escrow/1/refund-approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Refund approved and processed",
  "data": {
    "escrow_id": 1,
    "status": "refunded",
    "amount_refunded": 10000
  }
}
```

### Verify Wallet Restored

```bash
curl -X GET "$BASE_URL/wallet" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected (balance restored, investment_balance decreased):**
```json
{
  "data": {
    "balance": 50000,
    "investment_balance": 0,
    "total_balance": 50000
  }
}
```

### Verify Portfolio Removed

```bash
sqlite3 db/dotvests.db "SELECT * FROM portfolio WHERE user_id = 1 AND stock_id = 1;"
```

**Expected:** (no rows)

### Verify Escrow Status

```bash
sqlite3 db/dotvests.db "SELECT status FROM escrow_transactions WHERE id = 1;"
```

**Expected:**
```
refunded
```

---

## Test 9: Transaction History

### Get All Transactions

```bash
curl -X GET "$BASE_URL/wallet/transactions" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response includes:**
```json
{
  "success": true,
  "count": 4,
  "transactions": [
    {
      "type": "investment",
      "amount": 20000,
      "description": "Invested ₦20,000 in SEPLF"
    },
    {
      "type": "sell",
      "amount": 10000,
      "description": "Sold 5 units of SEPLF"
    },
    {
      "type": "refund",
      "amount": 10000,
      "description": "Refund for investment in SEPLF"
    },
    {
      "type": "deposit",
      "amount": 50000,
      "description": "Wallet deposit via bank_transfer"
    }
  ]
}
```

### Filter by Type

```bash
curl -X GET "$BASE_URL/wallet/transactions?type=investment" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Common Issues & Fixes

### Issue: Wallet creation fails with Paystack error

**Solution:** 
- Check `PAYSTACK_SECRET_KEY` is correct in `.env`
- Ensure Paystack API is accessible
- For testing, mock the Paystack response

### Issue: Escrow webhook not firing

**Solution:**
- The DVA webhook is sent by Paystack automatically
- For testing, manually run the webhook curl command
- Check webhook handler is receiving the event

### Issue: Transaction not atomic (partial updates)

**Solution:**
- Verify `db.transaction()` is wrapping the entire operation
- Check for errors in logs
- Ensure no code is running outside the transaction block

### Issue: Balance shows incorrect amount

**Solution:**
- Check `balance` (liquid) vs `investment_balance` (invested)
- Verify `total_balance = balance + investment_balance`
- Check wallet record hasn't been modified directly

---

## Database Reset (For Testing)

To reset a user's wallet for re-testing:

```bash
# Reset wallet
sqlite3 db/dotvests.db "
  UPDATE wallets SET balance = 0, investment_balance = 0, wallet_created = 0 WHERE user_id = 1;
  DELETE FROM orders WHERE user_id = 1;
  DELETE FROM portfolio WHERE user_id = 1;
  DELETE FROM escrow_transactions WHERE user_id = 1;
  DELETE FROM transactions WHERE user_id = 1;
"
```

---

## Load Testing Scenarios

### Scenario 1: Multiple Buy Orders

```bash
for i in {1..5}; do
  curl -X POST "$BASE_URL/orders/place" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"stock_id\": 1, \"type\": \"buy\", \"quantity\": $i}"
done
```

### Scenario 2: Rapid Sell and Buy

```bash
curl -X POST "$BASE_URL/orders/place" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stock_id": 1, "type": "sell", "quantity": 2}' &

curl -X POST "$BASE_URL/orders/place" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stock_id": 2, "type": "buy", "quantity": 3}' &

wait
```

---

## Success Criteria

All tests should pass with:
- ✅ Wallet creation only after KYC verified
- ✅ Buy order atomic: balance ↓, investment_balance ↑
- ✅ Sell order atomic: investment_balance ↓, balance ↑
- ✅ Escrow records created on buy
- ✅ Escrow status updated on sell/refund
- ✅ Admin can approve refunds
- ✅ Portfolio correctly updated
- ✅ Notifications sent (check DB)
- ✅ Transaction history complete

