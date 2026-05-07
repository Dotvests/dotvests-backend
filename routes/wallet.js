const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// CREATE WALLET (with Paystack DVA)
router.post('/create', protect, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Guard: KYC must be verified
    if (user.kyc_status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'KYC verification required before wallet creation'
      });
    }

    const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);

    if (wallet && wallet.wallet_created) {
      return res.status(400).json({
        success: false,
        message: 'Wallet already created for this account'
      });
    }

    try {
      // Create Paystack customer
      const customerResponse = await axios.post(
        'https://api.paystack.co/customer',
        {
          email: user.email,
          first_name: user.full_name.split(' ')[0] || '',
          last_name: user.full_name.split(' ')[1] || '',
          phone: user.phone
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!customerResponse.data.status) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create Paystack customer'
        });
      }

      const paystackCustomerCode = customerResponse.data.data.customer_code;

      // Create Dedicated Virtual Account (DVA)
      const dvaResponse = await axios.post(
        'https://api.paystack.co/dedicated_account',
        {
          customer: paystackCustomerCode,
          preferred_bank: 'wema-bank' // Wema Bank for DVA
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!dvaResponse.data.status) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create dedicated virtual account'
        });
      }

      const dvaData = dvaResponse.data.data;

      // Update wallet with DVA details
      if (!wallet) {
        // Create new wallet if doesn't exist
        db.prepare(`
          INSERT INTO wallets (user_id, balance, currency, paystack_customer_code, dva_account_number, dva_bank_name, dva_bank_code, wallet_created)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user.id,
          0,
          'NGN',
          paystackCustomerCode,
          dvaData.account_number,
          dvaData.bank.name,
          dvaData.bank.code,
          1
        );
      } else {
        // Update existing wallet
        db.prepare(`
          UPDATE wallets
          SET paystack_customer_code = ?, dva_account_number = ?, dva_bank_name = ?, dva_bank_code = ?, wallet_created = 1
          WHERE user_id = ?
        `).run(
          paystackCustomerCode,
          dvaData.account_number,
          dvaData.bank.name,
          dvaData.bank.code,
          req.user.id
        );
      }

      // Create notification
      db.prepare(
        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
      ).run(
        req.user.id,
        'Wallet Created',
        `Your DotVests wallet has been created. Your dedicated account number is ${dvaData.account_number}. You can now receive transfers directly to this account.`
      );

      return res.status(201).json({
        success: true,
        message: 'Wallet created successfully',
        data: {
          account_number: dvaData.account_number,
          bank_name: dvaData.bank.name,
          bank_code: dvaData.bank.code,
          account_type: dvaData.assignment.account_type
        }
      });

    } catch (paystackError) {
      console.error('Paystack error:', paystackError.response?.data || paystackError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to create wallet with payment provider',
        error: paystackError.response?.data?.message || paystackError.message
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not create wallet',
      error: error.message
    });
  }
});

// GET DVA DETAILS
router.get('/dva', protect, (req, res) => {
  try {
    const wallet = db.prepare(`
      SELECT dva_account_number, dva_bank_name, dva_bank_code, wallet_created
      FROM wallets WHERE user_id = ?
    `).get(req.user.id);

    if (!wallet || !wallet.wallet_created) {
      return res.status(404).json({
        success: false,
        message: 'No wallet created yet. Please create a wallet first.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        account_number: wallet.dva_account_number,
        bank_name: wallet.dva_bank_name,
        bank_code: wallet.dva_bank_code
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch DVA details',
      error: error.message
    });
  }
});

// GET WALLET BALANCE
router.get('/', protect, (req, res) => {
  try {
    const wallet = db.prepare(`
      SELECT id, user_id, balance, investment_balance, currency,
      COALESCE(account_number, 'Not set') as account_number,
      COALESCE(bank_name, 'Access Bank') as bank_name,
      COALESCE(dva_account_number, '') as dva_account_number,
      wallet_created,
      updated_at
      FROM wallets WHERE user_id = ?
    `).get(req.user.id);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...wallet,
        total_balance: (wallet.balance || 0) + (wallet.investment_balance || 0)
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch wallet',
      error: error.message
    });
  }
});

// DEPOSIT FUNDS
router.post('/deposit', protect, (req, res) => {
  try {
    const { amount, payment_method = 'bank_transfer', reference: externalRef } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    const wallet = db.prepare(
      'SELECT * FROM wallets WHERE user_id = ?'
    ).get(req.user.id);

    const newBalance = wallet.balance + amount;

    db.prepare(
      'UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).run(newBalance, req.user.id);

    const reference = externalRef || ('DEP-' + Date.now() + '-' + req.user.id);

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, description, reference, status)
      VALUES (?, 'deposit', ?, ?, ?, 'completed')
    `).run(req.user.id, amount, `Wallet deposit via ${payment_method}`, reference);

    db.prepare(`
      INSERT INTO notifications (user_id, title, message)
      VALUES (?, 'Deposit Successful', ?)
    `).run(req.user.id, `₦${amount.toLocaleString()} has been added to your wallet`);

    return res.status(201).json({
      success: true,
      message: `₦${amount.toLocaleString()} deposited successfully`,
      new_balance: parseFloat(newBalance.toFixed(2)),
      reference,
      transaction: {
        id: Date.now(),
        type: 'deposit',
        amount,
        status: 'completed',
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Deposit failed. Please try again.',
      error: error.message
    });
  }
});

// WITHDRAW FUNDS
router.post('/withdraw', protect, (req, res) => {
  try {
    const { amount, destination = 'bank_account', account_number, account_name } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    if (destination === 'bank_account' && !account_number) {
      return res.status(400).json({
        success: false,
        message: 'Account number is required for bank transfers'
      });
    }

    const wallet = db.prepare(
      'SELECT * FROM wallets WHERE user_id = ?'
    ).get(req.user.id);

    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. You have ₦${wallet.balance.toLocaleString()} available`
      });
    }

    const newBalance = wallet.balance - amount;

    db.prepare(
      'UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).run(newBalance, req.user.id);

    const reference = 'WDR-' + Date.now() + '-' + req.user.id;
    const description = destination === 'bank_account'
      ? `Withdrawal to ${account_name} (${account_number})`
      : `Withdrawal to ${destination}`;

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, description, reference, status)
      VALUES (?, 'withdrawal', ?, ?, ?, 'processing')
    `).run(req.user.id, amount, description, reference);

    db.prepare(`
      INSERT INTO notifications (user_id, title, message)
      VALUES (?, 'Withdrawal Initiated', ?)
    `).run(req.user.id, `₦${amount.toLocaleString()} withdrawal initiated. Will be completed in 1-3 business days`);

    return res.status(201).json({
      success: true,
      message: `₦${amount.toLocaleString()} withdrawal initiated`,
      new_balance: parseFloat(newBalance.toFixed(2)),
      reference,
      status: 'processing',
      transaction: {
        id: Date.now(),
        type: 'withdrawal',
        amount,
        status: 'processing',
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Withdrawal failed. Please try again.',
      error: error.message
    });
  }
});

// GET TRANSACTION HISTORY
router.get('/transactions', protect, (req, res) => {
  try {
    const { type = 'all', limit = 20, offset = 0, start_date, end_date } = req.query;

    let query = `SELECT * FROM transactions WHERE user_id = ?`;
    const params = [req.user.id];

    if (type !== 'all') {
      query += ` AND type = ?`;
      params.push(type);
    }

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(end_date + ' 23:59:59');
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const transactions = db.prepare(query).all(...params);

    const countQuery = `SELECT COUNT(*) as total FROM transactions WHERE user_id = ?`;
    const countResult = db.prepare(countQuery).get(req.user.id);

    return res.status(200).json({
      success: true,
      count: transactions.length,
      total_count: countResult.total,
      transactions
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch transactions',
      error: error.message
    });
  }
});

module.exports = router;