# Unified Transaction History API

Complete guide for implementing the all-in-one transaction history page for users.

---

## Overview

Users can now see **all their financial activity** in one place:
- 💰 Deposits (money added)
- 📈 Investments (shares bought)
- 📉 Sales (shares sold)
- 💸 Withdrawals (money removed)
- ↩️ Refunds (investment refunds)

All transactions appear in a **single timeline**, sorted by date (newest first), with icons and status indicators.

---

## API Endpoints

### 1. GET /api/transactions/history

**Get all transactions with pagination and filtering**

**Request:**
```
GET /api/transactions/history?type=all&limit=50&offset=0&start_date=2026-05-01&end_date=2026-05-07
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `all` | Filter by type: `all`, `deposit`, `withdrawal`, `investment`, `sell`, `refund` |
| `limit` | number | `50` | Results per page |
| `offset` | number | `0` | Pagination offset |
| `start_date` | string | - | Filter from date (YYYY-MM-DD) |
| `end_date` | string | - | Filter to date (YYYY-MM-DD) |

**Response (Success):**
```json
{
  "success": true,
  "count": 10,
  "total_count": 45,
  "page": 1,
  "limit": 50,
  "transactions": [
    {
      "id": 1,
      "type": "investment",
      "amount": 20000,
      "description": "Invested ₦20,000 in 10 units of SEPLF",
      "reference": "BUY-1715077200000-1",
      "status": "completed",
      "created_at": "2026-05-07T14:30:00Z",
      "icon": "📈",
      "color": "primary"
    },
    {
      "id": 2,
      "type": "deposit",
      "amount": 50000,
      "description": "Wallet deposit via bank_transfer",
      "reference": "DEP-1715076800000-1",
      "status": "completed",
      "created_at": "2026-05-07T14:00:00Z",
      "icon": "💰",
      "color": "success"
    },
    {
      "id": 3,
      "type": "sell",
      "amount": 10250,
      "description": "Sold 5 units of SEPLF",
      "reference": "SELL-1715076400000-1",
      "status": "completed",
      "created_at": "2026-05-07T13:30:00Z",
      "icon": "📉",
      "color": "secondary"
    },
    {
      "id": 4,
      "type": "withdrawal",
      "amount": 15000,
      "description": "Withdrawal to John Doe (1234567890)",
      "reference": "WDR-1715076000000-1",
      "status": "processing",
      "created_at": "2026-05-07T13:00:00Z",
      "icon": "💸",
      "color": "warning"
    },
    {
      "id": 5,
      "type": "refund",
      "amount": 20000,
      "description": "Refund for investment in SEPLF",
      "reference": "REF-1715075600000-1",
      "status": "completed",
      "created_at": "2026-05-07T12:30:00Z",
      "icon": "↩️",
      "color": "info"
    }
  ]
}
```

**Color Mapping:**
- `success` (green) — Deposit
- `warning` (orange) — Withdrawal
- `primary` (blue) — Investment
- `secondary` (gray) — Sale
- `info` (cyan) — Refund

---

### 2. GET /api/transactions/summary

**Get transaction statistics and totals**

**Request:**
```
GET /api/transactions/summary
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "total_transactions": 25,
      "total_deposits": 150000,
      "total_withdrawals": 25000,
      "total_invested": 100000,
      "total_from_sales": 45000,
      "total_refunded": 10000
    },
    "by_type": [
      {
        "type": "investment",
        "count": 5,
        "total": 100000
      },
      {
        "type": "deposit",
        "count": 3,
        "total": 150000
      },
      {
        "type": "sell",
        "count": 7,
        "total": 45000
      },
      {
        "type": "withdrawal",
        "count": 2,
        "total": 25000
      },
      {
        "type": "refund",
        "count": 1,
        "total": 10000
      }
    ]
  }
}
```

---

### 3. GET /api/transactions/:id

**Get a single transaction with related details**

**Request:**
```
GET /api/transactions/1
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "type": "investment",
    "amount": 20000,
    "description": "Invested ₦20,000 in 10 units of SEPLF",
    "reference": "BUY-1715077200000-1",
    "status": "completed",
    "created_at": "2026-05-07T14:30:00Z",
    "icon": "📈",
    "color": "primary",
    "related_data": {
      "id": 1,
      "stock_ticker": "SEPLF",
      "stock_name": "Seplat Petroleum",
      "quantity": 10,
      "status": "pending_trustee"
    }
  }
}
```

---

## Transaction Types

| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `deposit` | 💰 | success (green) | Money added to wallet |
| `withdrawal` | 💸 | warning (orange) | Money withdrawn to bank |
| `investment` | 📈 | primary (blue) | Shares purchased |
| `sell` | 📉 | secondary (gray) | Shares sold |
| `refund` | ↩️ | info (cyan) | Investment refunded |

---

## Frontend Implementation

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: filters.type,
        limit: filters.limit,
        offset: filters.offset,
        ...(filters.startDate && { start_date: filters.startDate }),
        ...(filters.endDate && { end_date: filters.endDate })
      });

      const response = await fetch(`/api/transactions/history?${params}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });

      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  return (
    <div className="transaction-history">
      <h2>Transaction History</h2>

      {/* Filters */}
      <div className="filters">
        <select 
          value={filters.type}
          onChange={(e) => handleFilterChange({ type: e.target.value })}
        >
          <option value="all">All Transactions</option>
          <option value="deposit">Deposits Only</option>
          <option value="investment">Investments Only</option>
          <option value="sell">Sales Only</option>
          <option value="withdrawal">Withdrawals Only</option>
          <option value="refund">Refunds Only</option>
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => handleFilterChange({ startDate: e.target.value })}
          placeholder="From date"
        />

        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => handleFilterChange({ endDate: e.target.value })}
          placeholder="To date"
        />
      </div>

      {/* Transaction List */}
      <div className="transaction-list">
        {loading ? (
          <p>Loading...</p>
        ) : transactions.length === 0 ? (
          <p>No transactions found</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className={`transaction-item ${tx.color}`}>
              <div className="icon">{tx.icon}</div>
              <div className="details">
                <div className="description">{tx.description}</div>
                <div className="date">
                  {new Date(tx.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className={`amount ${tx.type}`}>
                {tx.type === 'withdrawal' || tx.type === 'investment' || tx.type === 'refund' ? '-' : '+'}₦{tx.amount.toLocaleString()}
              </div>
              <div className={`status ${tx.status}`}>
                {tx.status}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button 
          onClick={() => handleFilterChange({ offset: filters.offset - filters.limit })}
          disabled={filters.offset === 0}
        >
          Previous
        </button>
        <span>Page {Math.floor(filters.offset / filters.limit) + 1}</span>
        <button 
          onClick={() => handleFilterChange({ offset: filters.offset + filters.limit })}
          disabled={transactions.length < filters.limit}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default TransactionHistory;
```

---

### HTML/CSS Example

```html
<div class="transaction-history">
  <h2>💳 Transaction History</h2>

  <!-- Filters -->
  <div class="filters">
    <select id="typeFilter">
      <option value="all">All Transactions</option>
      <option value="deposit">Deposits</option>
      <option value="investment">Investments</option>
      <option value="sell">Sales</option>
      <option value="withdrawal">Withdrawals</option>
      <option value="refund">Refunds</option>
    </select>

    <input type="date" id="startDate" placeholder="From">
    <input type="date" id="endDate" placeholder="To">
    
    <button id="filterBtn">Filter</button>
  </div>

  <!-- Transaction Timeline -->
  <div class="transaction-timeline">
    <!-- Transactions will be inserted here -->
  </div>

  <!-- Pagination -->
  <div class="pagination">
    <button id="prevBtn">← Previous</button>
    <span id="pageInfo">Page 1</span>
    <button id="nextBtn">Next →</button>
  </div>
</div>
```

```css
.transaction-history {
  max-width: 800px;
  margin: 20px auto;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filters select,
.filters input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.filters button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.transaction-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #f9f9f9;
}

.transaction-item.success {
  border-left: 4px solid #28a745;
}

.transaction-item.primary {
  border-left: 4px solid #007bff;
}

.transaction-item.warning {
  border-left: 4px solid #ffc107;
}

.transaction-item.secondary {
  border-left: 4px solid #6c757d;
}

.transaction-item.info {
  border-left: 4px solid #17a2b8;
}

.transaction-item .icon {
  font-size: 24px;
  min-width: 30px;
}

.transaction-item .details {
  flex: 1;
}

.transaction-item .description {
  font-weight: 500;
  color: #333;
}

.transaction-item .date {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.transaction-item .amount {
  font-weight: 600;
  font-size: 16px;
  min-width: 120px;
  text-align: right;
}

.transaction-item .amount.investment,
.transaction-item .amount.withdrawal,
.transaction-item .amount.refund {
  color: #e74c3c;
}

.transaction-item .amount.deposit,
.transaction-item .amount.sell {
  color: #27ae60;
}

.transaction-item .status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #f0f0f0;
  text-transform: capitalize;
}

.transaction-item .status.completed {
  background: #d4edda;
  color: #155724;
}

.transaction-item .status.processing {
  background: #fff3cd;
  color: #856404;
}

.transaction-item .status.pending {
  background: #e2e3e5;
  color: #383d41;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  align-items: center;
}

.pagination button {
  padding: 8px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

## Usage Examples

### Get Last 10 Transactions
```bash
curl "http://localhost:3000/api/transactions/history?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Get All Investments
```bash
curl "http://localhost:3000/api/transactions/history?type=investment" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Transactions from May 1-7, 2026
```bash
curl "http://localhost:3000/api/transactions/history?start_date=2026-05-01&end_date=2026-05-07" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Page 2 (50 per page)
```bash
curl "http://localhost:3000/api/transactions/history?limit=50&offset=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Get All Transactions for May, Then Filter Only Deposits
```bash
curl "http://localhost:3000/api/transactions/history?type=deposit&start_date=2026-05-01&end_date=2026-05-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Transaction Status Values

| Status | Meaning |
|--------|---------|
| `completed` | ✅ Transaction finished successfully |
| `processing` | ⏳ Pending (e.g., withdrawal in transit) |
| `pending` | ⌛ Awaiting confirmation |
| `failed` | ❌ Transaction failed |

---

## Display Recommendations

### Transaction List View (Recommended)
```
📈 Invested ₦20,000 in 10 units of SEPLF
   May 7, 2026 at 2:30 PM                          completed

💰 Wallet deposit via bank_transfer
   May 7, 2026 at 2:00 PM                          completed

📉 Sold 5 units of SEPLF
   May 7, 2026 at 1:30 PM                          completed

💸 Withdrawal to John Doe (1234567890)
   May 7, 2026 at 1:00 PM                          processing

↩️  Refund for investment in SEPLF
   May 7, 2026 at 12:30 PM                         completed
```

### Summary Card
```
Total Transactions: 25

Deposits:       ₦150,000
Withdrawals:    -₦25,000
Investments:    -₦100,000
Sales:          +₦45,000
Refunds:        +₦10,000
```

---

## Testing

### Test Data to Create

1. **Deposit:** Add ₦50,000 via Paystack
2. **Investment:** Buy 10 shares of SEPLF (₦20,000)
3. **Sale:** Sell 5 shares (₦10,250)
4. **Withdrawal:** Withdraw ₦15,000
5. **Refund:** Request refund on investment (approved)

Then verify in transaction history:
```bash
curl "http://localhost:3000/api/transactions/history" \
  -H "Authorization: Bearer $TOKEN" | jq '.transactions | length'
```

Should show 5 transactions in reverse chronological order.

---

## Notes

- All transactions are stored in the `transactions` table
- Timestamps are in ISO 8601 format (UTC)
- Amounts are in Nigerian Naira (₦)
- Pagination is offset-based (not cursor-based)
- All endpoints require JWT authentication
- Frontend can cache list and refresh on manual "Refresh" button

