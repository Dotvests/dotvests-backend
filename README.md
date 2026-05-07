# DotVests Backend API

A Node.js/Express-based stock trading platform with blockchain integration, payment processing, and real-time notifications.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 3. Start Server
```bash
node index.js
```

Server runs on `http://localhost:3000`

---

## 📋 Documentation

Comprehensive documentation is available in:

- **[SETUP.md](SETUP.md)** - Complete installation guide, environment setup, and full API endpoint documentation
- **[BUGS_AND_FIXES.md](BUGS_AND_FIXES.md)** - Detailed analysis of all identified bugs and issues
- **[FIXES_APPLIED.md](FIXES_APPLIED.md)** - Summary of all fixes that have been applied

---

## 🛠️ Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Express.js | 5.2.1 |
| **Database** | SQLite (better-sqlite3) | 12.6.2 |
| **Authentication** | JWT | 9.0.3 |
| **Hashing** | bcryptjs | 3.0.3 |
| **Blockchain** | ethers.js | 6.16.0 |
| **Payments** | Paystack API | - |
| **Email** | SendGrid | 8.1.6 |
| **Security** | Helmet | 8.1.0 |

---

## 📁 Project Structure

```
dotvests-backend/
├── config/
│   ├── db.js              # SQLite database setup
│   └── blockchain.js      # Polymesh Web3 integration
├── middleware/
│   ├── auth.js            # JWT verification & admin check
│   └── validate.js        # Input validation
├── routes/
│   ├── auth.js            # Authentication endpoints
│   ├── user.js            # User profile & KYC
│   ├── stocks.js          # Stock data & watchlist
│   ├── orders.js          # Buy/sell orders
│   ├── wallet.js          # Wallet & transactions
│   ├── portfolio.js       # Holdings & performance
│   ├── payment.js         # Paystack integration
│   └── admin.js           # Admin operations
├── db/
│   └── dotvests.db        # SQLite database (auto-created)
├── index.js               # Main server file
├── package.json           # Dependencies
└── .env                   # Environment variables
```

---

## 🔑 Key Features

### Authentication
- User registration & login
- JWT-based authentication
- Password reset via email
- KYC (Know Your Customer) verification workflow

### Trading
- Buy/sell stock orders
- Real-time portfolio tracking
- Profit/loss calculations
- Order history

### Wallet Management
- Deposit & withdraw funds
- Multiple payment methods (direct + Paystack)
- Transaction history
- Real-time balance updates

### Blockchain Integration
- ZetaChain Athens Testnet
- Mint/burn tokens on purchase/sale
- Smart contract interaction
- Transaction verification

### Admin Dashboard
- User management
- KYC approval/rejection
- Account suspension
- Platform statistics
- Stock management

---

## 🔐 Security Features

- **Helmet.js** - HTTP header protection
- **CORS** - Cross-origin request validation
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Password Hashing** - bcryptjs with salt rounds
- **JWT Authentication** - Stateless token verification
- **Input Validation** - Type checking and sanitization

---

## 📊 Database Schema

### Core Tables
- **users** - User accounts with profiles
- **wallets** - Wallet balances per user
- **stocks** - Available stocks for trading
- **orders** - Buy/sell order records
- **portfolio** - User stock holdings

### Supporting Tables
- **transactions** - Deposit/withdrawal history
- **watchlists** - User's stock watchlists
- **notifications** - In-app notifications

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Endpoint Categories
- `/auth` - Authentication (register, login, password reset)
- `/user` - User profile & notifications
- `/stocks` - Stock data & watchlist
- `/orders` - Buy/sell orders
- `/wallet` - Wallet & transactions
- `/portfolio` - Holdings & performance
- `/payment` - Payment processing
- `/admin` - Admin operations

See [SETUP.md](SETUP.md) for complete endpoint documentation with examples.

---

## 🐛 Known Issues & Fixes

### Recent Fixes (Latest)
✅ Input validation in profile updates
✅ Route ordering in watchlist endpoints
✅ Number formatting in payments
✅ Null checks in admin operations
✅ Decimal precision in calculations

### Remaining Issues
See [BUGS_AND_FIXES.md](BUGS_AND_FIXES.md) for a complete list of identified issues and recommendations for future improvements.

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] User registration & login
- [ ] Profile update validation
- [ ] Stock watchlist operations
- [ ] Buy/sell order placement
- [ ] Wallet deposit/withdrawal
- [ ] Payment initialization & verification
- [ ] Admin KYC approval
- [ ] Portfolio calculations

### Integration Testing
- [ ] Blockchain token mint/burn
- [ ] Paystack webhook handling
- [ ] Email notifications
- [ ] Database transaction integrity

---

## 📦 Environment Variables

Required variables in `.env`:

```env
# Required
PORT=3000
JWT_SECRET=<generate_secure_key>
JWT_EXPIRES_IN=7d

# Email (SendGrid)
SENDGRID_API_KEY=<your_key>
FROM_EMAIL=noreply@dotvests.com
FRONTEND_URL=http://localhost:3000

# Payments (Paystack)
PAYSTACK_SECRET_KEY=<your_secret>

# Blockchain (ZetaChain)
PRIVATE_KEY=<wallet_key>
PLATFORM_WALLET=<wallet_address>
DTV_CONTRACT=<contract_address>
TEL_CONTRACT=<contract_address>
ORB_CONTRACT=<contract_address>
CEM_CONTRACT=<contract_address>
```

See `.env.example` for the template.

---

## 🚀 Deployment

### Production Checklist
1. Set strong `JWT_SECRET`
2. Configure all third-party API keys
3. Set `FRONTEND_URL` to production domain
4. Use environment-specific database
5. Enable HTTPS
6. Set proper CORS origins
7. Monitor rate limiting effectiveness
8. Set up logging and error tracking
9. Regular database backups
10. Test all payment flows

---

## 📞 Support

For issues or questions:
1. Check [BUGS_AND_FIXES.md](BUGS_AND_FIXES.md) for known issues
2. Review endpoint documentation in [SETUP.md](SETUP.md)
3. Check environment variables are set correctly
4. Verify database connectivity

---

## 📄 License

ISC

---

## 👤 Author

Adeleke Sherifdeen Adeboye

---

**Last Updated**: April 2026  
**Status**: ✅ All critical bugs fixed and documented
