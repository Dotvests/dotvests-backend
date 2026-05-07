const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// GET UNIFIED TRANSACTION HISTORY
router.get('/history', protect, (req, res) => {
  try {
    const { type = 'all', limit = 50, offset = 0, start_date, end_date } = req.query;

    let query = `SELECT * FROM transactions WHERE user_id = ?`;
    const params = [req.user.id];

    // Filter by transaction type
    if (type !== 'all') {
      query += ` AND type = ?`;
      params.push(type);
    }

    // Filter by date range
    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(end_date + ' 23:59:59');
    }

    // Order by date descending (newest first) and paginate
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const transactions = db.prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM transactions WHERE user_id = ?`;
    const countParams = [req.user.id];

    if (type !== 'all') {
      countQuery += ` AND type = ?`;
      countParams.push(type);
    }

    if (start_date) {
      countQuery += ` AND created_at >= ?`;
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ` AND created_at <= ?`;
      countParams.push(end_date + ' 23:59:59');
    }

    const countResult = db.prepare(countQuery).all(...countParams);
    const totalCount = countResult[0]?.total || 0;

    // Format transactions for consistent response
    const formatted = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      reference: tx.reference,
      status: tx.status,
      created_at: tx.created_at,
      // Add icon/color based on type
      icon: getTransactionIcon(tx.type),
      color: getTransactionColor(tx.type)
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      total_count: totalCount,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      limit: parseInt(limit),
      transactions: formatted
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch transaction history',
      error: error.message
    });
  }
});

// GET TRANSACTION SUMMARY (Stats)
router.get('/summary', protect, (req, res) => {
  try {
    const user_id = req.user.id;

    // Get totals by type
    const summary = db.prepare(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      WHERE user_id = ?
      GROUP BY type
    `).all(user_id);

    // Get overall stats
    const overall = db.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
        SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawals,
        SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END) as total_invested,
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) as total_from_sales,
        SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END) as total_refunded
      FROM transactions
      WHERE user_id = ?
    `).get(user_id);

    return res.status(200).json({
      success: true,
      data: {
        overall: {
          total_transactions: overall.total_transactions || 0,
          total_deposits: overall.total_deposits || 0,
          total_withdrawals: overall.total_withdrawals || 0,
          total_invested: overall.total_invested || 0,
          total_from_sales: overall.total_from_sales || 0,
          total_refunded: overall.total_refunded || 0
        },
        by_type: summary.map(item => ({
          type: item.type,
          count: item.count,
          total: item.total || 0
        }))
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch transaction summary',
      error: error.message
    });
  }
});

// GET SINGLE TRANSACTION DETAIL
router.get('/:id', protect, (req, res) => {
  try {
    const transaction = db.prepare(`
      SELECT * FROM transactions
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Get related data if investment/sell
    let relatedData = null;
    if (transaction.type === 'investment' || transaction.type === 'sell') {
      relatedData = db.prepare(`
        SELECT id, stock_ticker, stock_name, quantity, status
        FROM escrow_transactions
        WHERE amount = ? AND user_id = ? AND (
          (? = 'investment' AND status IN ('pending_trustee', 'confirmed', 'sold', 'refunded')) OR
          (? = 'sell' AND status = 'sold')
        )
        LIMIT 1
      `).get(transaction.amount, req.user.id, transaction.type, transaction.type);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...transaction,
        related_data: relatedData,
        icon: getTransactionIcon(transaction.type),
        color: getTransactionColor(transaction.type)
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch transaction detail',
      error: error.message
    });
  }
});

// Helper function to get icon for transaction type
function getTransactionIcon(type) {
  const icons = {
    'deposit': '💰',
    'withdrawal': '💸',
    'investment': '📈',
    'sell': '📉',
    'refund': '↩️'
  };
  return icons[type] || '💳';
}

// Helper function to get color for transaction type
function getTransactionColor(type) {
  const colors = {
    'deposit': 'success',      // green
    'withdrawal': 'warning',   // orange
    'investment': 'primary',   // blue
    'sell': 'secondary',       // gray
    'refund': 'info'          // cyan
  };
  return colors[type] || 'default';
}

module.exports = router;
