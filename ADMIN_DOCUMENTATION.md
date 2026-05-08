# DotVests Admin Dashboard - Complete Documentation

**Version:** 1.0
**Last Updated:** May 2026
**Author:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Admin Roles & Permissions](#admin-roles--permissions)
4. [Key Features](#key-features)
5. [Workflows](#workflows)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [UI/UX Guide](#uiux-guide)
9. [Security & Compliance](#security--compliance)
10. [Implementation Checklist](#implementation-checklist)

---

## Overview

The **DotVests Admin Dashboard** is the central control system for managing:
- User accounts and KYC verification
- Investment escrow and refund approvals
- Financial transactions
- Stock listings and trading parameters
- System analytics and reporting
- Compliance and audit trails

**Purpose:** Enable the DotVests team to safely and efficiently manage platform operations while maintaining regulatory compliance.

**Scope:** This documentation covers the entire admin system architecture, workflows, and implementation.

---

## System Requirements

### Backend Requirements
- Node.js 20.x or higher
- Express.js 5.x
- PostgreSQL (production)
- JWT for authentication
- Role-based access control (RBAC)

### Frontend Requirements
- React 18+ or Vue 3+
- Redux/Context for state management
- TailwindCSS or Material-UI for styling
- Chart library (Chart.js, Recharts)
- Data tables with sorting/filtering

### Infrastructure
- Render.com (or similar PaaS)
- PostgreSQL managed database
- HTTPS/SSL enabled
- Regular backups

---

## Admin Roles & Permissions

### 1. Super Admin

**Access Level:** Full system access

**Permissions:**
- ✅ Approve/reject KYC verifications
- ✅ Approve/reject escrow refunds
- ✅ Manage all users
- ✅ Manage stock listings
- ✅ Update system settings
- ✅ View all analytics
- ✅ View audit logs
- ✅ Manage other admin accounts

**Use Cases:**
- Escalations and edge cases
- Critical system decisions
- Final approval on disputed refunds
- Adding new admins

**Required:** 2+ super admins at all times

---

### 2. KYC Verifier

**Access Level:** KYC management only

**Permissions:**
- ✅ View pending KYC submissions
- ✅ Approve KYC (set to verified)
- ✅ Reject KYC (set to rejected)
- ✅ Request resubmission
- ✅ View user KYC documents
- ✅ View own approval history

**Restrictions:**
- ❌ Cannot manage escrow
- ❌ Cannot modify user data
- ❌ Cannot change system settings
- ❌ Cannot view financial data

**Use Cases:**
- Verify user documents
- Approve legitimate KYC
- Reject fraudulent submissions
- Request clarifications

**Team:** 2-4 KYC specialists

---

### 3. Escrow Manager

**Access Level:** Escrow and refund operations

**Permissions:**
- ✅ View all escrow transactions
- ✅ Confirm escrow holdings (trustee approval)
- ✅ Approve refund requests
- ✅ Reject refund requests
- ✅ View investment details
- ✅ Send messages to users

**Restrictions:**
- ❌ Cannot approve KYC
- ❌ Cannot access settings
- ❌ Cannot delete records
- ❌ Cannot manage stocks

**Use Cases:**
- Confirm investments with trustee
- Process refund approvals
- Handle investment disputes
- Monitor escrow status

**Team:** 1-2 escrow specialists

---

### 4. Financial Admin

**Access Level:** Transactions and financial operations

**Permissions:**
- ✅ View all transactions
- ✅ View user wallets
- ✅ Monitor deposits/withdrawals
- ✅ Force-complete stuck transactions
- ✅ Handle payment disputes
- ✅ View financial analytics

**Restrictions:**
- ❌ Cannot approve refunds
- ❌ Cannot modify user data
- ❌ Cannot change settings

**Use Cases:**
- Monitor cash flow
- Handle payment issues
- Verify transaction status
- Investigate discrepancies

**Team:** 1-2 financial staff

---

### 5. Support Admin

**Access Level:** Limited user support

**Permissions:**
- ✅ View user profiles (read-only)
- ✅ View user activity logs
- ✅ Send messages to users
- ✅ View transaction history
- ✅ View trading history

**Restrictions:**
- ❌ Cannot approve anything
- ❌ Cannot modify data
- ❌ Cannot access settings
- ❌ Cannot view financial details

**Use Cases:**
- Customer support inquiries
- User issue investigation
- Activity tracking
- Basic troubleshooting

**Team:** 2-3 support staff

---

### 6. Analyst

**Access Level:** Read-only analytics

**Permissions:**
- ✅ View all analytics
- ✅ View charts and reports
- ✅ Export data (CSV/PDF)
- ✅ View user statistics
- ✅ View trading patterns

**Restrictions:**
- ❌ Cannot modify anything
- ❌ Cannot approve anything
- ❌ Cannot access settings

**Use Cases:**
- Generate reports
- Analyze trends
- Monitor platform health
- Business intelligence

**Team:** 1-2 analysts

---

## Key Features

### 1. Dashboard Overview

**Displays:**
- Total users & KYC completion rate
- Total invested & in escrow
- Daily trading volume
- Pending approvals count
- Recent activities feed
- Key alerts & warnings

**Charts:**
- User growth trend
- Trading volume trend
- KYC completion rate
- Refund statistics
- Stock performance

---

### 2. User Management

**View All Users:**
- Search by email, name, phone
- Filter by account status (active, suspended, pending)
- Filter by KYC status (verified, pending, rejected)
- Sort by balance, join date, trading volume
- Bulk actions (suspend multiple)

**User Details:**
- Profile information
- Wallet balance (liquid + investment)
- Trading history
- KYC status
- Transaction history
- Escrow records
- Actions: suspend, force-verify, view audit log

---

### 3. KYC Verification

**Pending KYC List:**
- User information
- Submission date
- Document type & number
- Smile verification status
- Action buttons: Approve, Reject, Request Info

**KYC Details View:**
- Full user profile
- All submitted documents
- Smile verification result
- Approval/rejection history
- Comments/notes field

**Actions:**
- ✅ **Approve:** Set user kyc_status = "verified", enable wallet creation
- ❌ **Reject:** Set kyc_status = "rejected", notify user, allow resubmission
- 🔄 **Request Info:** Send message to user, pause verification

---

### 4. Escrow Management (CRITICAL)

**Dashboard View:**

| Status | Count | Action |
|--------|-------|--------|
| Pending Trustee | 12 | Confirm holding |
| Refund Pending | 3 | Approve/Reject |
| Confirmed | 45 | Monitor |
| Refunded | 120 | View history |

**Pending Trustee Confirmations:**
- User name & email
- Stock ticker & name
- Amount invested
- Quantity of shares
- Investment date
- **Action:** Confirm holding (set status = "confirmed", add trustee details)

**Refund Requests:**
- User requesting refund
- Investment details (stock, amount)
- Reason for refund
- Request date
- **Actions:**
  - Approve → Credits balance, notifies user
  - Reject → Denies request, notifies user
  - Request Info → Ask for clarification

**Escrow Details:**
- Investment timeline
- Trustee information
- Current status
- Audit trail
- Related transactions

---

### 5. Transaction Monitoring

**View All Transactions:**
- Type: Deposit, Withdrawal, Investment, Sale, Refund
- Status: Completed, Processing, Failed
- Amount & currency
- User information
- Date range filtering
- User search

**Transaction Details:**
- Full transaction record
- Wallet before & after
- Related escrow/order
- Payment reference
- Status history

**Actions:**
- View related user account
- View related order/escrow
- Force-complete (if stuck)
- Generate receipt/invoice

**Alerts:**
- Large transactions (>₦1M)
- Failed transactions
- Unusual patterns
- Pending for >24 hours

---

### 6. Stock Management

**Stock List:**
- Ticker symbol
- Stock name
- Current price
- Price change %
- Total holdings (all users)
- Total invested value
- Trading enabled status
- Last updated

**Stock Details:**
- Company information
- Current price & history
- 52-week high/low
- Trading volume
- Users holding stock

**Actions:**
- Edit company details
- Update price
- Disable trading (emergency)
- View price history
- Export stock data

---

### 7. Analytics & Reporting

**Key Metrics:**
- Total users & growth
- KYC completion rate
- Active traders
- Total invested & in escrow
- Daily trading volume
- Average trade size
- Refund rate

**Charts:**
- User growth (daily/weekly/monthly)
- Trading volume trends
- KYC completion timeline
- Escrow status breakdown
- Refund analytics
- Stock popularity

**Reports (Exportable):**
- User registration report
- KYC verification report
- Trading activity report
- Financial summary
- Escrow status report
- Compliance report

**Export Formats:** CSV, PDF, Excel

---

### 8. Settings Management

**Trading Settings:**
- Minimum investment amount
- Maximum investment amount
- Trading enabled/disabled flag

**KYC Settings:**
- Require KYC before trading
- Auto-approve KYC (off)
- Document requirements

**Escrow Settings:**
- Trustee wallet address
- Trustee name
- Escrow holding period (days)

**Paystack Integration:**
- Live mode toggle
- Webhook URL
- Test mode settings

**Smile Integration:**
- Partner ID
- API key (masked)
- Webhook URL

**Email Settings:**
- Admin notification email
- Waitlist notification email
- SendGrid API key

---

### 9. Audit Logs

**Log Entries Include:**
- Admin name & email
- Action performed
- Target (user, escrow, kyc, etc.)
- Timestamp
- IP address
- Details/notes
- Result (success/failure)

**Searchable By:**
- Admin user
- Action type
- Date range
- Target user/escrow
- Keyword search

**Exportable:** CSV format for compliance

**Retention:** 5 years minimum

---

## Workflows

### Workflow 1: User Registration → KYC Approval

```
User Signs Up
    ↓
Frontend: User completes KYC via Smile SDK
    ↓
Backend: KYC status = "pending"
    ↓
Admin: KYC Verifier reviews submission
    ↓
Admin: Clicks "Approve"
    ↓
Backend: KYC status = "verified"
    ↓
System: Sends notification to user
    ↓
User: Can now create wallet & trade
```

**Admin Responsibilities:**
- Review documents quality
- Verify Smile approval result
- Approve legitimate users
- Reject fraudulent submissions
- Request clarifications if needed

---

### Workflow 2: Investment Purchase → Escrow Confirmation

```
User Buys Shares (₦50,000 SEPLF)
    ↓
Backend: Creates order + escrow record
    ↓
Wallet: Balance -₦50,000, Investment +₦50,000
    ↓
Escrow Status: "pending_trustee"
    ↓
Admin: Escrow Manager sees pending confirmation
    ↓
Admin: Clicks "Confirm Holding"
    ↓
Admin: Enters trustee wallet & reference
    ↓
Backend: Escrow status = "confirmed"
    ↓
System: Notifies user "Investment confirmed"
    ↓
User: Can now view investment in portfolio
```

**Admin Responsibilities:**
- Verify with trustee that shares received
- Get trustee wallet address
- Get trustee transaction reference
- Confirm in dashboard
- Monitor for delays

---

### Workflow 3: User Requests Refund

```
User Clicks "Request Refund" (for ₦50,000 SEPLF)
    ↓
Backend: Escrow status = "refund_pending"
    ↓
System: Notifies admin
    ↓
Admin: Escrow Manager reviews request
    ↓
Admin: Checks:
    - Investment amount correct?
    - User balance sufficient?
    - No suspicious patterns?
    - Valid reason given?
    ↓
Admin: Clicks "Approve Refund"
    ↓
Backend: Automatic atomic transaction:
    - Balance +₦50,000
    - Investment balance -₦50,000
    - Remove from portfolio
    - Escrow status = "refunded"
    - Log action
    ↓
System: Notifies user "Refund processed"
    ↓
User: Sees refunded amount in wallet
```

**Admin Responsibilities:**
- Review refund reason
- Check user history for fraud
- Verify escrow status
- Approve legitimate refunds
- Reject suspicious requests

---

### Workflow 4: Transaction Dispute

```
User Reports: "I didn't receive my deposit"
    ↓
Support: Opens support ticket
    ↓
Admin: Financial Admin investigates
    ↓
Admin: Checks:
    - Is transaction in system?
    - What's the status?
    - Paystack confirmation?
    - User wallet update?
    ↓
If found but not processed:
    Admin: Clicks "Force Complete"
    ↓
Backend: Credits wallet, updates status, logs action
    ↓
System: Notifies user
    ↓
Admin: Notifies support to close ticket
```

**Admin Responsibilities:**
- Investigate transaction issues
- Verify with payment provider
- Process manual corrections if needed
- Document actions for audit trail

---

## API Reference

### Authentication

**Admin Login:**
```
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@dotvests.com",
  "password": "secure_password"
}

Response:
{
  "success": true,
  "token": "jwt_admin_token_here",
  "admin": {
    "id": 1,
    "name": "John Admin",
    "email": "admin@dotvests.com",
    "role": "super_admin",
    "permissions": [...]
  }
}
```

**All admin endpoints require:**
```
Authorization: Bearer [jwt_admin_token]
```

---

### Users

**Get All Users:**
```
GET /api/admin/users?status=active&kyc=verified&limit=50&offset=0
```

**Get User Details:**
```
GET /api/admin/users/:user_id
```

**Suspend User:**
```
PATCH /api/admin/users/:user_id/suspend
{
  "reason": "Suspicious activity detected"
}
```

---

### KYC

**Get Pending KYC:**
```
GET /api/admin/kyc/pending
```

**Approve KYC:**
```
PATCH /api/admin/kyc/:kyc_id/approve
{
  "notes": "Document verified, liveness passed"
}
```

**Reject KYC:**
```
PATCH /api/admin/kyc/:kyc_id/reject
{
  "reason": "Document not clear. Please resubmit with clearer photo."
}
```

---

### Escrow (CRITICAL)

**Get All Escrows:**
```
GET /api/admin/escrow?status=pending_trustee&limit=20
```

**Confirm Escrow Holding:**
```
PATCH /api/admin/escrow/:escrow_id/confirm
{
  "trustee_wallet": "0x_trustee_address",
  "trustee_reference": "TXN_HASH_FROM_TRUSTEE",
  "notes": "Confirmed with trustee on call"
}
```

**Approve Refund:**
```
PATCH /api/admin/escrow/:escrow_id/refund-approve
{
  "notes": "Refund approved and processed"
}
```

Response: Automatically credits user wallet + logs action

**Reject Refund:**
```
PATCH /api/admin/escrow/:escrow_id/refund-reject
{
  "reason": "Insufficient grounds for refund"
}
```

---

### Transactions

**Get All Transactions:**
```
GET /api/admin/transactions?type=all&status=all&limit=50&start_date=2026-05-01
```

**Get Transaction Details:**
```
GET /api/admin/transactions/:transaction_id
```

**Force Complete Transaction:**
```
PATCH /api/admin/transactions/:transaction_id/force-complete
{
  "reason": "Payment provider confirmed but system not updated"
}
```

---

### Stocks

**Get All Stocks:**
```
GET /api/admin/stocks
```

**Update Stock Price:**
```
PATCH /api/admin/stocks/:stock_id/price
{
  "price": 2150,
  "reason": "NSE market update"
}
```

**Disable Stock Trading:**
```
PATCH /api/admin/stocks/:stock_id/disable
{
  "reason": "Company delisted from exchange"
}
```

---

### Analytics

**Get Dashboard Analytics:**
```
GET /api/admin/analytics
```

Returns: Overview metrics, daily stats, charts data

**Export Report:**
```
GET /api/admin/reports/:type?format=csv&start_date=2026-05-01&end_date=2026-05-07
```

Types: users, kyc, trading, financial, escrow

---

### Audit Logs

**Get Audit Logs:**
```
GET /api/admin/audit-logs?admin_id=1&action=kyc_approved&limit=50
```

**Export Audit Trail:**
```
GET /api/admin/audit-logs/export?format=csv&start_date=2026-05-01
```

---

## Database Schema

### admin_users

```sql
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL,  -- super_admin, kyc_verifier, etc.
  permissions TEXT[],  -- Array of permission strings
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_by INTEGER REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### admin_audit_logs

```sql
CREATE TABLE admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admin_users(id),
  action VARCHAR(100) NOT NULL,  -- kyc_approved, escrow_confirmed, etc.
  target_type VARCHAR(50),  -- user, kyc, escrow, transaction, stock
  target_id INTEGER,
  details TEXT,  -- JSON string with action details
  result VARCHAR(50),  -- success, failure
  ip_address VARCHAR(50),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_admin_timestamp (admin_id, timestamp),
  INDEX idx_action_timestamp (action, timestamp),
  INDEX idx_target (target_type, target_id)
);
```

### admin_sessions

```sql
CREATE TABLE admin_sessions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admin_users(id),
  token_hash VARCHAR(255),
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_admin_id (admin_id)
);
```

---

## UI/UX Guide

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│ Admin Dashboard      [Notifications] [Profile]  │
├─────────────────────────────────────────────────┤
│ Sidebar             │  Main Content Area        │
│                     │                           │
│ • Dashboard         │  Metrics Cards            │
│ • Users             │  ┌────┐ ┌────┐ ┌────┐   │
│ • KYC ⚠️ (12)      │  │1250│ │88% │ │₦15M│   │
│ • Escrow 🔐 (3)   │  │user│ │kyc │ │inv │   │
│ • Transactions      │  └────┘ └────┘ └────┘   │
│ • Stocks            │                          │
│ • Analytics         │  Charts Section          │
│ • Settings          │  ┌──────────────────┐   │
│ • Audit Logs        │  │ User Growth      │   │
│                     │  │ [Chart]          │   │
│                     │  └──────────────────┘   │
│                     │                          │
│                     │  Recent Activity         │
│                     │  ┌──────────────────┐   │
│                     │  │ 2 min ago: KYC app│   │
│                     │  │ 5 min ago: Refund│   │
│                     │  └──────────────────┘   │
└─────────────────────────────────────────────────┘
```

### KYC Verification Page

```
Pending KYC Verifications (12)

┌────────────────────────────────────────────┐
│ Jane Smith          │ Submitted: 2 hours ago│
│ jane@example.com    │ Status: Pending       │
│ BVN: 11111111111    │                       │
│ Document: Passport  │ [View] [Approve] [Reject]
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ John Doe            │ Submitted: 5 hours ago│
│ john@example.com    │ Status: Pending       │
│ NIN: 22222222222    │                       │
│ Document: National  │ [View] [Approve] [Reject]
│ ID                  │
└────────────────────────────────────────────┘
```

### Escrow Management Page

```
┌─────────────────────────────────────────────────┐
│ Pending Trustee Confirmations (12)              │
├─────────────────────────────────────────────────┤
│ Jane Smith          │ SEPLF | ₦50,000 | 25 units
│ Invested 2 days ago │ [Confirm Holding] [Details]
├─────────────────────────────────────────────────┤
│ John Doe            │ WAPCO | ₦100,000| 50 units
│ Invested 5 days ago │ [Confirm Holding] [Details]
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Pending Refund Requests (3)                     │
├─────────────────────────────────────────────────┤
│ Sarah Johnson       │ SEPLF | ₦25,000        │
│ Reason: Changed mind│ [Approve] [Reject]     │
├─────────────────────────────────────────────────┤
│ Mike Chen           │ WAPCO | ₦50,000        │
│ Reason: Emergency   │ [Approve] [Reject]     │
└─────────────────────────────────────────────────┘
```

---

## Security & Compliance

### Security Measures

**Authentication:**
- ✅ Admin JWT tokens (separate from user tokens)
- ✅ Secure password hashing (bcrypt)
- ✅ Token expiration (24 hours)
- ✅ Email + password login
- ⏳ 2FA (future enhancement)

**Authorization:**
- ✅ Role-based access control (RBAC)
- ✅ Permission checks on every endpoint
- ✅ Cannot approve own actions
- ✅ Super admin approval for sensitive operations

**Audit Trail:**
- ✅ Every admin action logged
- ✅ Immutable audit logs (cannot be deleted)
- ✅ IP address & user agent captured
- ✅ Timestamp for all actions

**Data Protection:**
- ✅ HTTPS/SSL for all connections
- ✅ Sensitive data masked in logs
- ✅ API keys hidden in settings
- ✅ No passwords in audit logs

---

### Compliance Features

**Regulatory:**
- ✅ KYC verification before trading (CBN requirement)
- ✅ User identity verification (Smile Identity)
- ✅ Transaction monitoring
- ✅ Audit trail for 5 years
- ✅ Refund approval process

**Financial:**
- ✅ Escrow tracking (no funds held by DotVests)
- ✅ Transaction integrity (atomic operations)
- ✅ Balance reconciliation
- ✅ Dispute resolution process

**Data Privacy:**
- ✅ User data protection
- ✅ Secure credential storage
- ✅ Audit logging
- ✅ Access controls

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)

- [ ] Create admin database tables
  - [ ] admin_users
  - [ ] admin_audit_logs
  - [ ] admin_sessions
  
- [ ] Create admin authentication
  - [ ] `/api/admin/auth/login` endpoint
  - [ ] Admin JWT token generation
  - [ ] Admin authentication middleware

- [ ] Create admin middleware
  - [ ] Role verification
  - [ ] Permission checking
  - [ ] Audit logging

---

### Phase 2: Core Features (Week 2)

- [ ] User management
  - [ ] `GET /api/admin/users` (list)
  - [ ] `GET /api/admin/users/:id` (details)
  - [ ] `PATCH /api/admin/users/:id/suspend` (suspend)

- [ ] KYC management
  - [ ] `GET /api/admin/kyc/pending` (list pending)
  - [ ] `PATCH /api/admin/kyc/:id/approve` (approve)
  - [ ] `PATCH /api/admin/kyc/:id/reject` (reject)

- [ ] Escrow management (CRITICAL)
  - [ ] `GET /api/admin/escrow` (list all)
  - [ ] `PATCH /api/admin/escrow/:id/confirm` (confirm holding)
  - [ ] `PATCH /api/admin/escrow/:id/refund-approve` (approve refund)
  - [ ] `PATCH /api/admin/escrow/:id/refund-reject` (reject refund)

---

### Phase 3: Extended Features (Week 3)

- [ ] Transaction monitoring
  - [ ] `GET /api/admin/transactions` (list)
  - [ ] `GET /api/admin/transactions/:id` (details)
  - [ ] `PATCH /api/admin/transactions/:id/force-complete` (manual complete)

- [ ] Stock management
  - [ ] `GET /api/admin/stocks` (list)
  - [ ] `PATCH /api/admin/stocks/:id/price` (update price)
  - [ ] `PATCH /api/admin/stocks/:id/disable` (disable trading)

- [ ] Analytics
  - [ ] `GET /api/admin/analytics` (dashboard data)
  - [ ] `GET /api/admin/reports/:type` (export reports)

---

### Phase 4: Admin Panel Frontend (Week 4)

- [ ] Dashboard page
  - [ ] Metrics cards
  - [ ] Charts (user growth, volume, kyc rate)
  - [ ] Recent activities
  - [ ] Alerts

- [ ] Users page
  - [ ] User list with filters
  - [ ] User details modal
  - [ ] Suspend user button

- [ ] KYC page
  - [ ] Pending KYC list
  - [ ] KYC details view
  - [ ] Approve/reject buttons

- [ ] Escrow page
  - [ ] Pending confirmations list
  - [ ] Refund requests list
  - [ ] Approve/reject buttons

- [ ] Transactions page
  - [ ] Transaction list
  - [ ] Transaction details
  - [ ] Force complete button

- [ ] Analytics page
  - [ ] Charts and metrics
  - [ ] Report generation
  - [ ] CSV/PDF export

---

### Phase 5: Polish & Security (Week 5)

- [ ] Error handling & validation
- [ ] Rate limiting on admin endpoints
- [ ] Input sanitization
- [ ] CORS configuration
- [ ] Logging & monitoring
- [ ] Performance optimization
- [ ] Security audit

---

### Phase 6: Testing & Deployment (Week 6)

- [ ] Unit tests for admin endpoints
- [ ] Integration tests for workflows
- [ ] Manual testing checklist
- [ ] Security testing
- [ ] Load testing
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitoring & alerts

---

## Testing Scenarios

### Test 1: KYC Approval Workflow

1. Create test user with pending KYC
2. Admin logs in with KYC verifier role
3. Admin views pending KYC
4. Admin clicks "Approve"
5. Verify: kyc_status changed to "verified"
6. Verify: User notification sent
7. Verify: Audit log entry created

### Test 2: Escrow Confirmation

1. User purchases shares (creates escrow)
2. Admin logs in with escrow manager role
3. Admin sees pending confirmation
4. Admin enters trustee details
5. Admin clicks "Confirm"
6. Verify: escrow status = "confirmed"
7. Verify: User can see investment in portfolio

### Test 3: Refund Approval

1. User requests refund
2. Admin sees refund request
3. Admin clicks "Approve Refund"
4. Verify: Atomic transaction completes
   - Balance increased ✓
   - Investment balance decreased ✓
   - Portfolio updated ✓
   - Escrow status = "refunded" ✓
5. Verify: User notification sent
6. Verify: Audit log shows admin action

---

## Troubleshooting Guide

### Admin Cannot Login

- [ ] Check email/password correct
- [ ] Check admin_users table has entry
- [ ] Check password_hash is valid
- [ ] Check is_active = true

### Permission Denied on Action

- [ ] Check admin role in admin_users
- [ ] Check role has required permission
- [ ] Check JWT token is valid
- [ ] Check token not expired

### Escrow Refund Failed

- [ ] Check user has investment_balance
- [ ] Check escrow_id is correct
- [ ] Check escrow status allows refund
- [ ] Check transaction log for errors

### Audit Log Not Recording

- [ ] Check admin_audit_logs table exists
- [ ] Check middleware is logging actions
- [ ] Check database connection
- [ ] Check disk space for logs

---

## Support & Questions

**For Technical Questions:**
- Check this documentation
- Review API reference section
- Check database schema
- Review implementation checklist

**For Operational Questions:**
- Refer to workflows section
- Review role-specific permissions
- Check security guidelines

**For Issues:**
- Check troubleshooting guide
- Review audit logs
- Check error messages
- Contact development team

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 2026 | Initial documentation |

---

**Document Status:** ✅ Ready for Team Review

**Next Step:** Review with team and begin Phase 1 implementation

