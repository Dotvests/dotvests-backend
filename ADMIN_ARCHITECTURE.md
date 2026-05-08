# Admin Dashboard Architecture

Complete design for the DotVests admin panel.

---

## Overview

The admin dashboard is the **control center** for DotVests operations. It handles:
- ✅ User & KYC management
- ✅ Escrow & refund approvals (critical for two-wallet system)
- ✅ Transaction monitoring
- ✅ Stock management
- ✅ Compliance & audit logs
- ✅ System analytics

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Admin Dashboard                      │
│                    (React/Vue/Angular)                  │
└────────┬──────────────────────────────────────────────┘
         │
         │ HTTP/REST API
         ↓
┌─────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Middleware                                     │   │
│  │  - Admin Authentication (JWT)                  │   │
│  │  - Authorization (Role-based)                  │   │
│  │  - Request Logging                             │   │
│  │  - Rate Limiting                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Routes                                         │   │
│  │  /api/admin/users                              │   │
│  │  /api/admin/kyc                                │   │
│  │  /api/admin/escrow                             │   │
│  │  /api/admin/transactions                       │   │
│  │  /api/admin/stocks                             │   │
│  │  /api/admin/analytics                          │   │
│  │  /api/admin/settings                           │   │
│  │  /api/admin/audit-logs                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Database (PostgreSQL)                          │   │
│  │  - users, wallets, orders, escrow...           │   │
│  │  - admin_logs (audit trail)                    │   │
│  │  - admin_actions (admin-only operations)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Admin Authentication

**Separate from regular users:**

```javascript
// Admin login endpoint
POST /api/admin/auth/login
{
  "email": "admin@dotvests.com",
  "password": "secure_password"
}

Response:
{
  "success": true,
  "token": "admin_jwt_token",
  "admin": {
    "id": 1,
    "name": "Admin User",
    "role": "super_admin",
    "permissions": ["users:read", "escrow:approve", "kyc:verify", ...]
  }
}
```

**Admin roles:**
- `super_admin` — Full access to everything
- `kyc_verifier` — KYC approval only
- `escrow_manager` — Escrow/refund approvals
- `financial_admin` — Transactions, withdrawals
- `support_admin` — User support, limited access
- `analyst` — Read-only analytics

---

### 2. User Management

**Endpoint: GET /api/admin/users**

```json
{
  "success": true,
  "count": 245,
  "users": [
    {
      "id": 1,
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "08012345678",
      "kyc_status": "verified",
      "account_status": "active",
      "wallet_balance": 150000,
      "investment_balance": 50000,
      "total_traded": 200000,
      "created_at": "2026-05-01T10:00:00Z",
      "last_login": "2026-05-07T14:30:00Z",
      "actions": ["view_details", "suspend", "force_kyc_reverify"]
    }
  ]
}
```

**Features:**
- ✅ Search by email/name/phone
- ✅ Filter by KYC status
- ✅ Filter by account status
- ✅ Sort by balance, trading volume, signup date
- ✅ Bulk actions (suspend multiple users)

---

### 3. KYC Management (Critical)

**Endpoint: GET /api/admin/kyc/pending**

```json
{
  "success": true,
  "pending_count": 12,
  "kyc_requests": [
    {
      "id": 1,
      "user_id": 5,
      "full_name": "Jane Smith",
      "email": "jane@example.com",
      "bvn": "11111111111",
      "nin": "22222222222",
      "document_type": "passport",
      "document_number": "ABC123456",
      "smile_job_id": "job_123456",
      "submission_status": "approved",
      "submission_date": "2026-05-06T10:00:00Z",
      "actions": ["approve", "reject", "request_resubmission"]
    }
  ]
}
```

**Approve KYC:**

```javascript
PATCH /api/admin/kyc/:id/approve
{
  "notes": "Document verified, liveness passed"
}
```

**Reject KYC:**

```javascript
PATCH /api/admin/kyc/:id/reject
{
  "reason": "Document not clear, please resubmit"
}
```

---

### 4. Escrow Management (🔑 Critical)

This is the **heart of the admin system** for two-wallet operations.

**Endpoint: GET /api/admin/escrow**

```json
{
  "success": true,
  "escrows": [
    {
      "id": 1,
      "user_id": 5,
      "user_name": "Jane Smith",
      "stock_ticker": "SEPLF",
      "stock_name": "Seplat Petroleum",
      "amount": 50000,
      "quantity": 25,
      "status": "pending_trustee",
      "days_pending": 2,
      "created_at": "2026-05-05T10:00:00Z",
      "actions": ["confirm_holding", "request_refund"]
    },
    {
      "id": 2,
      "user_id": 8,
      "user_name": "John Doe",
      "stock_ticker": "WAPCO",
      "amount": 100000,
      "quantity": 50,
      "status": "refund_pending",
      "refund_reason": "User requested refund",
      "requested_at": "2026-05-06T14:00:00Z",
      "actions": ["approve_refund", "reject_refund", "request_more_info"]
    }
  ]
}
```

**Confirm Escrow (Trustee Holding):**

```javascript
PATCH /api/admin/escrow/:id/confirm
{
  "trustee_wallet": "0xaddress...",
  "trustee_reference": "TXN_HASH_HERE",
  "notes": "Confirmed shares with trustee"
}
```

Response:
```json
{
  "success": true,
  "escrow_id": 1,
  "status": "confirmed",
  "message": "Escrow confirmed. User notified."
}
```

**Approve Refund:**

```javascript
PATCH /api/admin/escrow/:id/refund-approve
{
  "notes": "Refund approved and processed"
}
```

Automatically:
- ✅ Credits user's liquid balance
- ✅ Deducts from investment_balance
- ✅ Removes from portfolio
- ✅ Sends notification to user
- ✅ Logs action for audit

---

### 5. Transaction Monitoring

**Endpoint: GET /api/admin/transactions**

```json
{
  "success": true,
  "transactions": [
    {
      "id": 100,
      "user_id": 5,
      "user_email": "jane@example.com",
      "type": "investment",
      "amount": 50000,
      "description": "Invested in SEPLF",
      "reference": "BUY-1715076800000-5",
      "status": "completed",
      "created_at": "2026-05-07T10:00:00Z"
    },
    {
      "id": 101,
      "user_id": 8,
      "type": "withdrawal",
      "amount": 25000,
      "status": "processing",
      "initiated_at": "2026-05-07T14:00:00Z",
      "actions": ["force_complete", "cancel_withdrawal"]
    }
  ],
  "filters": {
    "type": ["all", "deposit", "investment", "sell", "withdrawal", "refund"],
    "status": ["all", "completed", "processing", "failed"],
    "date_range": "last_7_days"
  }
}
```

**Manually complete stuck transaction:**

```javascript
PATCH /api/admin/transactions/:id/force-complete
{
  "reason": "Payment provider confirmed but not updated in system"
}
```

---

### 6. Stock Management

**Endpoint: GET /api/admin/stocks**

```json
{
  "success": true,
  "stocks": [
    {
      "id": 1,
      "ticker": "SEPLF",
      "name": "Seplat Petroleum",
      "current_price": 2050,
      "previous_price": 2000,
      "change": "2.5%",
      "is_active": true,
      "total_holdings": 5000,
      "total_value": 10250000,
      "last_updated": "2026-05-07T14:30:00Z",
      "actions": ["edit", "disable", "update_price"]
    }
  ]
}
```

**Update stock price:**

```javascript
PATCH /api/admin/stocks/:id/price
{
  "price": 2100,
  "reason": "Market update from NSE"
}
```

**Disable stock from trading:**

```javascript
PATCH /api/admin/stocks/:id/disable
{
  "reason": "Delisted from exchange"
}
```

---

### 7. Analytics & Reporting

**Endpoint: GET /api/admin/analytics**

```json
{
  "success": true,
  "overview": {
    "total_users": 1250,
    "active_users_today": 342,
    "kyc_verified": 1100,
    "kyc_pending": 45,
    "total_invested": 15000000,
    "total_in_escrow": 8000000,
    "total_withdrawn": 2500000,
    "platform_commission": 150000
  },
  "daily_metrics": {
    "new_users": 15,
    "kyc_completed": 8,
    "trades_executed": 45,
    "total_volume": 500000,
    "refunds_requested": 2,
    "refunds_approved": 1
  },
  "charts": {
    "user_growth": [...],
    "trading_volume": [...],
    "kyc_completion_rate": 88%,
    "refund_rate": 2%
  }
}
```

---

### 8. Settings & Configuration

**Endpoint: GET /api/admin/settings**

```json
{
  "success": true,
  "settings": {
    "trading": {
      "min_investment": 50000,
      "max_investment": 10000000,
      "trading_enabled": true
    },
    "kyc": {
      "required": true,
      "provider": "smile",
      "auto_approve": false
    },
    "escrow": {
      "trustee_address": "0xaddress...",
      "trustee_name": "TBD",
      "holding_period_days": 0
    },
    "paystack": {
      "live_mode": false,
      "webhook_url": "https://..."
    },
    "smile": {
      "partner_id": "620...",
      "api_key": "***masked***"
    }
  }
}
```

**Update settings:**

```javascript
PATCH /api/admin/settings
{
  "trading": {
    "min_investment": 60000
  }
}
```

---

### 9. Audit Logs (Compliance)

**Endpoint: GET /api/admin/audit-logs**

```json
{
  "success": true,
  "logs": [
    {
      "id": 1001,
      "admin_id": 1,
      "admin_email": "admin@dotvests.com",
      "action": "kyc_approved",
      "target": "user_5",
      "details": "KYC verified for Jane Smith",
      "timestamp": "2026-05-07T10:00:00Z",
      "ip_address": "203.0.113.42"
    },
    {
      "id": 1002,
      "admin_id": 2,
      "admin_email": "escrow_admin@dotvests.com",
      "action": "escrow_refund_approved",
      "target": "escrow_8",
      "details": "Refunded ₦50,000 to user_12",
      "timestamp": "2026-05-07T14:00:00Z",
      "ip_address": "203.0.113.43"
    }
  ]
}
```

---

## Admin Routes Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/auth/login` | POST | Admin login |
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/:id` | GET | User details |
| `/api/admin/users/:id/suspend` | PATCH | Suspend user |
| `/api/admin/kyc/pending` | GET | Pending KYC verifications |
| `/api/admin/kyc/:id/approve` | PATCH | Approve KYC |
| `/api/admin/kyc/:id/reject` | PATCH | Reject KYC |
| `/api/admin/escrow` | GET | All escrow records |
| `/api/admin/escrow/:id/confirm` | PATCH | Confirm escrow holding |
| `/api/admin/escrow/:id/refund-approve` | PATCH | Approve refund |
| `/api/admin/escrow/:id/refund-reject` | PATCH | Reject refund |
| `/api/admin/transactions` | GET | Transaction history |
| `/api/admin/transactions/:id/force-complete` | PATCH | Manually complete |
| `/api/admin/stocks` | GET | Stock listings |
| `/api/admin/stocks/:id/price` | PATCH | Update price |
| `/api/admin/stocks/:id/disable` | PATCH | Disable trading |
| `/api/admin/analytics` | GET | Dashboard analytics |
| `/api/admin/settings` | GET/PATCH | System settings |
| `/api/admin/audit-logs` | GET | Audit trail |

---

## Database Schema Additions

### admin_users Table

```sql
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50),  -- super_admin, kyc_verifier, escrow_manager, etc.
  permissions TEXT[],  -- Array of permissions
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### admin_audit_logs Table

```sql
CREATE TABLE admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admin_users(id),
  action VARCHAR(100),  -- kyc_approved, escrow_refund_approved, etc.
  target_type VARCHAR(50),  -- user, escrow, kyc, etc.
  target_id INTEGER,
  details TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (admin_id, timestamp),
  INDEX (action, timestamp)
);
```

### admin_actions Table (Queued Actions)

```sql
CREATE TABLE admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admin_users(id),
  action_type VARCHAR(100),
  target_id INTEGER,
  status VARCHAR(50),  -- pending, completed, failed
  result TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## Frontend Dashboard Pages

```
Admin Dashboard
├── 📊 Dashboard (Overview)
│   ├── Key metrics cards
│   ├── Charts (users, volume, kyc)
│   ├── Recent activities
│   └── Alerts
│
├── 👥 Users Management
│   ├── User list (searchable, filterable)
│   ├── User details view
│   ├── Suspend/unsuspend user
│   └── View user wallet history
│
├── ✅ KYC Verification
│   ├── Pending requests list
│   ├── KYC details view
│   ├── Approve button
│   ├── Reject with reason
│   └── View submitted documents
│
├── 🔐 Escrow Management (CRITICAL)
│   ├── Pending trustee confirmations
│   ├── Refund requests list
│   ├── Confirm escrow holding
│   ├── Approve/reject refunds
│   └── Escrow history
│
├── 💳 Transactions
│   ├── All transactions list
│   ├── Filter by type/status
│   ├── Transaction details
│   ├── Force complete stuck transactions
│   └── Dispute resolution
│
├── 📈 Stocks
│   ├── Active stocks list
│   ├── Edit stock details
│   ├── Update price
│   ├── Disable/enable trading
│   └── Trading volume per stock
│
├── 📊 Analytics & Reports
│   ├── Dashboard metrics
│   ├── User growth charts
│   ├── Trading volume trends
│   ├── KYC completion rate
│   ├── Refund analytics
│   └── Export reports (CSV/PDF)
│
├── ⚙️ Settings
│   ├── Trading parameters
│   ├── KYC settings
│   ├── Escrow settings
│   ├── API keys management
│   └── Webhook configuration
│
└── 📋 Audit Logs
    ├── Action history
    ├── Filter by admin
    ├── Filter by action type
    └── Export logs (compliance)
```

---

## Security Features

### 1. Admin Authentication
- ✅ Separate JWT tokens from regular users
- ✅ Longer expiration (e.g., 24 hours)
- ✅ Email + password + 2FA (optional)
- ✅ IP whitelisting (optional)

### 2. Authorization
- ✅ Role-based access control (RBAC)
- ✅ Permission checks on every endpoint
- ✅ Cannot approve own requests

### 3. Audit Trail
- ✅ Every admin action logged
- ✅ Timestamp, IP, user agent
- ✅ Cannot delete audit logs
- ✅ Compliance-ready

### 4. Rate Limiting
- ✅ Admin endpoints rate-limited
- ✅ Prevent bulk actions abuse
- ✅ Alert on suspicious activity

---

## Critical Operations Requiring Approval

These operations are **irreversible** and need special handling:

| Operation | Approval | Conditions |
|-----------|----------|-----------|
| **Approve Refund** | 2 admins | Refund amount, user balance check |
| **Disable Stock** | Super admin only | Affects all open positions |
| **Suspend User** | Support lead + super admin | Account security |
| **Force Complete Transaction** | Financial admin + lead | Risk of double-crediting |

---

## Notifications to Users

Admin actions automatically notify users:

- ✅ KYC approved → "You can now create a wallet"
- ✅ KYC rejected → "Please resubmit with clear documents"
- ✅ Escrow confirmed → "Your investment is confirmed and held in escrow"
- ✅ Refund approved → "Your refund has been processed to your wallet"
- ✅ Stock disabled → "Stock no longer available for trading"

---

## Compliance & Regulatory

The admin system maintains:

- ✅ **Audit logs** — Every action recorded
- ✅ **Immutable records** — Cannot delete/modify logs
- ✅ **User activity** — Track KYC, trades, withdrawals
- ✅ **Regulatory reporting** — Export for compliance
- ✅ **Transaction monitoring** — Flag suspicious activity
- ✅ **Data retention** — Keep logs for X years

---

## Development Phases

### Phase 1: MVP (Week 1-2)
- ✅ Admin authentication
- ✅ User management
- ✅ KYC approval/rejection
- ✅ Escrow confirmation & refund approval
- ✅ Basic dashboard

### Phase 2: Enhanced (Week 3-4)
- ✅ Transaction monitoring
- ✅ Stock management
- ✅ Analytics & charts
- ✅ Audit logs

### Phase 3: Production Ready (Week 5-6)
- ✅ Settings management
- ✅ 2FA for admins
- ✅ Role-based access
- ✅ Export reports
- ✅ Performance optimization

---

## Next Steps

To implement the admin system:

1. **Create `routes/admin.js`** — All admin endpoints
2. **Create `middleware/adminAuth.js`** — Admin JWT verification
3. **Create `middleware/adminAuthorize.js`** — Role-based checks
4. **Create admin tables** — admin_users, admin_audit_logs, admin_actions
5. **Build frontend** — Dashboard UI components

Ready to start implementation?

