const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');
const { mintTokens, burnTokens } = require('../config/blockchain');

// PLACE ORDER (BUY OR SELL)
router.post('/place', protect, async (req, res) => {
  try {
    const { stock_id, type, quantity } = req.body;

    if (!stock_id || !type || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Stock ID, type, and quantity are all required'
      });
    }

    if (type !== 'buy' && type !== 'sell') {
      return res.status(400).json({
        success: false,
        message: 'Order type must be buy or sell'
      });
    }

    const stock = db.prepare(
      'SELECT * FROM stocks WHERE id = ? AND is_active = 1'
    ).get(stock_id);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found or unavailable'
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    // Guard: KYC must be verified
    if (user.kyc_status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'KYC verification required before trading'
      });
    }

    const wallet = db.prepare(
      'SELECT * FROM wallets WHERE user_id = ?'
    ).get(req.user.id);

    // Guard: Wallet must be created (with DVA)
    if (!wallet || !wallet.wallet_created) {
      return res.status(403).json({
        success: false,
        message: 'Please create a wallet first before trading'
      });
    }

    // Use the stock's current price from database, not client-supplied price
    const price = stock.price;
    const total = quantity * price;

    let blockchainTx = null;
    let orderResult = null;

    // BUY ORDER
    if (type === 'buy') {
      if (wallet.balance < total) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. You need ₦${total.toLocaleString()} but have ₦${wallet.balance.toLocaleString()}`
        });
      }

      // Wrap entire buy order in transaction for atomicity
      try {
        orderResult = db.transaction(() => {
          // Deduct from wallet balance, add to investment balance
          db.prepare(
            'UPDATE wallets SET balance = ?, investment_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
          ).run(wallet.balance - total, wallet.investment_balance + total, req.user.id);

          // Record transaction
          const reference = 'BUY-' + Date.now() + '-' + req.user.id;
          db.prepare(`
            INSERT INTO transactions (user_id, type, amount, description, reference, status)
            VALUES (?, 'investment', ?, ?, ?, 'completed')
          `).run(req.user.id, total, `Invested ₦${total.toLocaleString()} in ${stock.ticker}`, reference);

          // Update portfolio
          const existing = db.prepare(
            'SELECT * FROM portfolio WHERE user_id = ? AND stock_id = ?'
          ).get(req.user.id, stock_id);

          if (existing) {
            const newQuantity = existing.quantity + quantity;
            const newAvgPrice = ((existing.avg_buy_price * existing.quantity) + (price * quantity)) / newQuantity;
            db.prepare(`
              UPDATE portfolio SET quantity = ?, avg_buy_price = ?, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ? AND stock_id = ?
            `).run(newQuantity, newAvgPrice, req.user.id, stock_id);
          } else {
            db.prepare(`
              INSERT INTO portfolio (user_id, stock_id, quantity, avg_buy_price)
              VALUES (?, ?, ?, ?)
            `).run(req.user.id, stock_id, quantity, price);
          }

          // Create order record
          const orderRecord = db.prepare(`
            INSERT INTO orders (user_id, stock_id, type, quantity, price, total, status, order_type)
            VALUES (?, ?, ?, ?, ?, ?, 'executed', 'market')
          `).run(req.user.id, stock_id, type, quantity, price, total);

          // Create escrow record for the investment
          const escrowRecord = db.prepare(`
            INSERT INTO escrow_transactions (user_id, order_id, stock_id, stock_ticker, stock_name, amount, quantity, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_trustee')
          `).run(req.user.id, orderRecord.lastInsertRowid, stock_id, stock.ticker, stock.name, total, quantity);

          // Notify user
          db.prepare(`
            INSERT INTO notifications (user_id, title, message)
            VALUES (?, 'Investment Placed', ?)
          `).run(req.user.id, `You invested ₦${total.toLocaleString()} in ${quantity} units of ${stock.ticker}. Awaiting escrow confirmation.`);

          return { orderId: orderRecord.lastInsertRowid, escrowId: escrowRecord.lastInsertRowid };
        })();
      } catch (txError) {
        return res.status(500).json({
          success: false,
          message: 'Could not execute buy order: ' + txError.message
        });
      }

      // Mint tokens on ZetaChain (after transaction commits, best-effort, no rollback)
      const platformWallet = process.env.PLATFORM_WALLET;
      if (platformWallet) {
        blockchainTx = await mintTokens(stock.ticker, platformWallet, quantity);
        if (blockchainTx.success) {
          console.log(`Minted ${quantity} ${stock.ticker} tokens. TX: ${blockchainTx.txHash}`);
        } else {
          console.error(`Mint failed for ${stock.ticker}:`, blockchainTx.error);
        }
      }
    }

    // SELL ORDER
    if (type === 'sell') {
      const holding = db.prepare(
        'SELECT * FROM portfolio WHERE user_id = ? AND stock_id = ?'
      ).get(req.user.id, stock_id);

      if (!holding || holding.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient holdings. You only have ${holding ? holding.quantity : 0} units of ${stock.ticker}`
        });
      }

      // Wrap entire sell order in transaction for atomicity
      try {
        orderResult = db.transaction(() => {
          // Credit wallet balance, deduct from investment balance
          db.prepare(
            'UPDATE wallets SET balance = ?, investment_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
          ).run(wallet.balance + total, wallet.investment_balance - total, req.user.id);

          // Record transaction
          const reference = 'SELL-' + Date.now() + '-' + req.user.id;
          db.prepare(`
            INSERT INTO transactions (user_id, type, amount, description, reference, status)
            VALUES (?, 'sell', ?, ?, ?, 'completed')
          `).run(req.user.id, total, `Sold ${quantity} units of ${stock.ticker}`, reference);

          // Update portfolio
          const newQuantity = holding.quantity - quantity;
          if (newQuantity === 0) {
            db.prepare(
              'DELETE FROM portfolio WHERE user_id = ? AND stock_id = ?'
            ).run(req.user.id, stock_id);
          } else {
            db.prepare(`
              UPDATE portfolio SET quantity = ?, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ? AND stock_id = ?
            `).run(newQuantity, req.user.id, stock_id);
          }

          // Create order record
          const orderRecord = db.prepare(`
            INSERT INTO orders (user_id, stock_id, type, quantity, price, total, status, order_type)
            VALUES (?, ?, ?, ?, ?, ?, 'executed', 'market')
          `).run(req.user.id, stock_id, type, quantity, price, total);

          // Mark corresponding escrow as closed/removed
          db.prepare(
            'UPDATE escrow_transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND stock_id = ? AND status IN (?, ?)'
          ).run('sold', req.user.id, stock_id, 'pending_trustee', 'confirmed');

          // Notify user
          db.prepare(`
            INSERT INTO notifications (user_id, title, message)
            VALUES (?, 'Sell Order Executed', ?)
          `).run(req.user.id, `You sold ${quantity} units of ${stock.ticker} at ₦${price.toLocaleString()} each`);

          return { orderId: orderRecord.lastInsertRowid };
        })();
      } catch (txError) {
        return res.status(500).json({
          success: false,
          message: 'Could not execute sell order: ' + txError.message
        });
      }

      // Burn tokens on ZetaChain (after transaction commits, best-effort, no rollback)
      const platformWallet = process.env.PLATFORM_WALLET;
      if (platformWallet) {
        blockchainTx = await burnTokens(stock.ticker, platformWallet, quantity);
        if (blockchainTx.success) {
          console.log(`Burned ${quantity} ${stock.ticker} tokens. TX: ${blockchainTx.txHash}`);
        } else {
          console.error(`Burn failed for ${stock.ticker}:`, blockchainTx.error);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `${type.toUpperCase()} order executed successfully`,
      order: {
        id: orderResult.orderId,
        stock: stock.ticker,
        type,
        quantity,
        price,
        total,
        escrow_id: orderResult.escrowId || null,
        blockchain: blockchainTx
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Order failed. Please try again.',
      error: error.message
    });
  }
});

// GET MY ORDER HISTORY
router.get('/my-orders', protect, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, s.name as stock_name, s.ticker
      FROM orders o
      INNER JOIN stocks s ON o.stock_id = s.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch orders',
      error: error.message
    });
  }
});

// GET SINGLE ORDER
router.get('/:id', protect, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, s.name as stock_name, s.ticker
      FROM orders o
      INNER JOIN stocks s ON o.stock_id = s.id
      WHERE o.id = ? AND o.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch order',
      error: error.message
    });
  }
});

module.exports = router;