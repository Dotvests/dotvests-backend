const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');

// GET MY INVESTMENTS (with escrow details)
router.get('/my-investments', protect, (req, res) => {
  try {
    const escrows = db.prepare(`
      SELECT
        e.id,
        e.user_id,
        e.stock_id,
        e.stock_ticker,
        e.stock_name,
        e.amount,
        e.quantity,
        e.status,
        e.trustee_wallet,
        e.trustee_reference,
        e.created_at,
        e.updated_at,
        s.price as current_price
      FROM escrow_transactions e
      LEFT JOIN stocks s ON e.stock_id = s.id
      WHERE e.user_id = ?
      ORDER BY e.created_at DESC
    `).all(req.user.id);

    const enriched = escrows.map(escrow => ({
      ...escrow,
      current_value: escrow.quantity * (escrow.current_price || 0),
      unrealised_gain: (escrow.quantity * (escrow.current_price || 0)) - escrow.amount
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      count: enriched.length
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch investments',
      error: error.message
    });
  }
});

// GET SINGLE ESCROW DETAILS
router.get('/:id', protect, (req, res) => {
  try {
    const { id } = req.params;

    const escrow = db.prepare(`
      SELECT
        e.id,
        e.user_id,
        e.order_id,
        e.stock_id,
        e.stock_ticker,
        e.stock_name,
        e.amount,
        e.quantity,
        e.status,
        e.trustee_wallet,
        e.trustee_reference,
        e.notes,
        e.created_at,
        e.updated_at,
        s.price as current_price
      FROM escrow_transactions e
      LEFT JOIN stocks s ON e.stock_id = s.id
      WHERE e.id = ? AND e.user_id = ?
    `).get(id, req.user.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...escrow,
        current_value: escrow.quantity * (escrow.current_price || 0),
        unrealised_gain: (escrow.quantity * (escrow.current_price || 0)) - escrow.amount
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch escrow details',
      error: error.message
    });
  }
});

// CONFIRM ESCROW (Trustee acknowledged holding)
router.patch('/:id/confirm', protect, adminOnly, (req, res) => {
  try {
    const { id } = req.params;

    const escrow = db.prepare('SELECT * FROM escrow_transactions WHERE id = ?').get(id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow transaction not found'
      });
    }

    if (escrow.status !== 'pending_trustee') {
      return res.status(400).json({
        success: false,
        message: 'Escrow can only be confirmed when status is pending_trustee'
      });
    }

    db.prepare(
      'UPDATE escrow_transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('confirmed', id);

    db.prepare(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
    ).run(
      escrow.user_id,
      'Investment Confirmed',
      `Your investment of ₦${escrow.amount.toLocaleString()} in ${escrow.stock_name} has been confirmed and is now held in escrow.`
    );

    return res.status(200).json({
      success: true,
      message: 'Escrow confirmed',
      data: {
        escrow_id: id,
        status: 'confirmed',
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not confirm escrow',
      error: error.message
    });
  }
});

// APPROVE REFUND (Trustee approved refund request)
router.patch('/:id/refund-approve', protect, adminOnly, (req, res) => {
  try {
    const { id } = req.params;

    const escrow = db.prepare('SELECT * FROM escrow_transactions WHERE id = ?').get(id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow transaction not found'
      });
    }

    if (escrow.status !== 'refund_pending') {
      return res.status(400).json({
        success: false,
        message: 'Escrow can only be refunded when status is refund_pending'
      });
    }

    try {
      db.transaction(() => {
        // Get wallet
        const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(escrow.user_id);

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        // Restore balance from investment
        db.prepare(
          'UPDATE wallets SET balance = ?, investment_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
        ).run(
          wallet.balance + escrow.amount,
          wallet.investment_balance - escrow.amount,
          escrow.user_id
        );

        // Update escrow status
        db.prepare(
          'UPDATE escrow_transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('refunded', id);

        // Remove from portfolio if exists
        const portfolio = db.prepare(
          'SELECT * FROM portfolio WHERE user_id = ? AND stock_id = ?'
        ).get(escrow.user_id, escrow.stock_id);

        if (portfolio) {
          const newQuantity = portfolio.quantity - escrow.quantity;
          if (newQuantity <= 0) {
            db.prepare('DELETE FROM portfolio WHERE id = ?').run(portfolio.id);
          } else {
            db.prepare('UPDATE portfolio SET quantity = ? WHERE id = ?').run(newQuantity, portfolio.id);
          }
        }

        // Create refund transaction record
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, description, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          escrow.user_id,
          'refund',
          escrow.amount,
          `Refund for investment in ${escrow.stock_name}`,
          'completed'
        );

        // Create notification
        db.prepare(
          'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
        ).run(
          escrow.user_id,
          'Investment Refunded',
          `Your investment of ₦${escrow.amount.toLocaleString()} in ${escrow.stock_name} has been refunded to your wallet.`
        );
      })();
    } catch (txError) {
      return res.status(500).json({
        success: false,
        message: 'Could not process refund: ' + txError.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Refund approved and processed',
      data: {
        escrow_id: id,
        status: 'refunded',
        amount_refunded: escrow.amount,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not approve refund',
      error: error.message
    });
  }
});

// REQUEST REFUND (User initiates refund request)
router.post('/:id/request-refund', protect, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const escrow = db.prepare('SELECT * FROM escrow_transactions WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow transaction not found'
      });
    }

    if (escrow.status === 'refunded' || escrow.status === 'refund_pending') {
      return res.status(400).json({
        success: false,
        message: 'Refund already requested or already refunded'
      });
    }

    db.prepare(
      'UPDATE escrow_transactions SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('refund_pending', reason || 'User requested refund', id);

    db.prepare(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
    ).run(
      req.user.id,
      'Refund Request Submitted',
      'Your refund request has been submitted and is awaiting trustee approval.'
    );

    return res.status(200).json({
      success: true,
      message: 'Refund requested',
      data: {
        escrow_id: id,
        status: 'refund_pending'
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not request refund',
      error: error.message
    });
  }
});

module.exports = router;
