const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/db');
const priceSimulator = require('./services/priceSimulator');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const stockRoutes = require('./routes/stocks');
const orderRoutes = require('./routes/orders');
const walletRoutes = require('./routes/wallet');
const portfolioRoutes = require('./routes/portfolio');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');
const waitlistRoutes = require('./routes/waitlist');
const contactRoutes = require('./routes/contact');
const polymeshRoutes = require('./routes/polymesh');
const kycRoutes = require('./routes/kyc');
const escrowRoutes = require('./routes/escrow');
const transactionRoutes = require('./routes/transactions');

const app = express();

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests. Please try again after 15 minutes.' },
  skip: (req) => req.path === '/api/payment/webhook'
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Webhook route with raw body parser (must be before express.json())
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hash = require('crypto')
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { event, data } = body;

    if (event === 'dedicatedaccount.assign.success') {
      const db = require('./config/db');

      const { customer, assignment } = data;
      try {
        const wallet = db.prepare(
          'SELECT * FROM wallets WHERE paystack_customer_code = ?'
        ).get(customer.customer_code);

        if (wallet) {
          db.prepare(
            'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
          ).run(
            wallet.user_id,
            'Virtual Account Ready',
            `Your dedicated virtual account (${assignment.account_number}) is now ready to receive transfers. You can start depositing funds.`
          );
        }
      } catch (error) {
        console.error('Error processing DVA assignment:', error.message);
      }

      return res.status(200).json({ received: true });
    }

    if (event === 'charge.success') {
      const axios = require('axios');
      const db = require('./config/db');

      const { reference, amount, metadata } = data;
      const user_id = metadata.user_id;
      const amountInNaira = amount / 100;

      try {
        db.transaction(() => {
          const existing = db.prepare(
            'SELECT * FROM transactions WHERE reference = ? AND status = ?'
          ).get(reference, 'completed');

          if (existing) {
            return;
          }

          const wallet = db.prepare(
            'SELECT * FROM wallets WHERE user_id = ?'
          ).get(user_id);

          if (wallet) {
            db.prepare(
              'UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
            ).run(wallet.balance + amountInNaira, user_id);

            db.prepare(
              'UPDATE transactions SET status = ? WHERE reference = ?'
            ).run('completed', reference);

            db.prepare(
              'INSERT INTO notifications (user_id, title, message) VALUES (?, \'Deposit Successful\', ?)'
            ).run(user_id, `₦${amountInNaira.toLocaleString()} has been added to your DotVests wallet`);
          }
        })();
      } catch (txError) {
        console.error('Transaction error in webhook:', txError.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(200).json({ received: true });
  }
});

app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/polymesh', polymeshRoutes);

app.get('/', function(req, res) {
  res.json({
    success: true,
    message: 'DotVests API is live',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      user: '/api/user',
      stocks: '/api/stocks',
      orders: '/api/orders',
      wallet: '/api/wallet',
      portfolio: '/api/portfolio',
      admin: '/api/admin',
      payment: '/api/payment',
      waitlist: '/api/waitlist',
      contact: '/api/contact'
    }
  });
});

app.use(function(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('Server running on port ' + PORT);
  // Start price simulator
  priceSimulator.start();
});
