const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const priceSimulator = require('../services/priceSimulator');

// LIVE PRICE STREAM (SSE)
router.get('/stream', (req, res) => {
  try {
    const { tickers } = req.query;
    const tickerList = tickers ? tickers.split(',').map(t => t.toUpperCase()) : null;
    priceSimulator.subscribe(res, tickerList);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not subscribe to price stream',
      error: error.message
    });
  }
});

// GET PRICE HISTORY (5-minute candles)
router.get('/:ticker/history', (req, res) => {
  try {
    const { ticker } = req.params;
    const { limit = 100, from, to } = req.query;

    const stock = db.prepare(
      'SELECT id FROM stocks WHERE ticker = ? AND is_active = 1'
    ).get(ticker.toUpperCase());

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    const history = priceSimulator.getHistory(stock.id, parseInt(limit), from, to);

    return res.status(200).json({
      success: true,
      data: history,
      count: history.length,
      ticker: ticker.toUpperCase()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch price history',
      error: error.message
    });
  }
});

// GET ALL STOCKS
router.get('/', (req, res) => {
  try {
    const { search, sector, limit = 50, offset = 0 } = req.query;

    let query = `SELECT * FROM stocks WHERE is_active = 1`;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR ticker LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (sector) {
      query += ` AND sector = ?`;
      params.push(sector);
    }

    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const stocks = db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      count: stocks.length,
      stocks
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch stocks',
      error: error.message
    });
  }
});

// ADD TO WATCHLIST
router.post('/watchlist/add', protect, (req, res) => {
  try {
    const { stock_id } = req.body;

    const stock = db.prepare(
      'SELECT id FROM stocks WHERE id = ?'
    ).get(stock_id);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    const existing = db.prepare(
      'SELECT id FROM watchlists WHERE user_id = ? AND stock_id = ?'
    ).get(req.user.id, stock_id);

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Stock already in your watchlist'
      });
    }

    db.prepare(
      'INSERT INTO watchlists (user_id, stock_id) VALUES (?, ?)'
    ).run(req.user.id, stock_id);

    return res.status(200).json({
      success: true,
      message: 'Stock added to watchlist'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not add to watchlist',
      error: error.message
    });
  }
});

// GET MY WATCHLIST
router.get('/watchlist/me', protect, (req, res) => {
  try {
    const watchlist = db.prepare(`
      SELECT s.* FROM stocks s
      INNER JOIN watchlists w ON s.id = w.stock_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `).all(req.user.id);

    return res.status(200).json({
      success: true,
      count: watchlist.length,
      watchlist
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch watchlist',
      error: error.message
    });
  }
});

// REMOVE FROM WATCHLIST
router.delete('/watchlist/:stock_id', protect, (req, res) => {
  try {
    db.prepare(
      'DELETE FROM watchlists WHERE user_id = ? AND stock_id = ?'
    ).run(req.user.id, req.params.stock_id);

    return res.status(200).json({
      success: true,
      message: 'Stock removed from watchlist'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not remove from watchlist',
      error: error.message
    });
  }
});

// GET TRENDING STOCKS
router.get('/trending/list', (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const trending = db.prepare(`
      SELECT
        id, name, ticker,
        COALESCE(expected_apy, 0) as expected_apy,
        COALESCE(risk_level, 'medium') as risk_level,
        COALESCE(min_investment, 50000) as min_investment,
        price as current_price,
        CASE WHEN description IS NOT NULL THEN description ELSE 'Investment opportunity' END as description,
        CASE WHEN ticker THEN ticker ELSE 'DTV' END as icon
      FROM stocks
      WHERE is_active = 1
      ORDER BY expected_apy DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));

    return res.status(200).json({
      success: true,
      count: trending.length,
      trending
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch trending stocks',
      error: error.message
    });
  }
});

// GET SINGLE STOCK (must be after watchlist routes to avoid pattern matching)
router.get('/:ticker', (req, res) => {
  try {
    const stock = db.prepare(`
      SELECT
        id, name, ticker, price, previous_price,
        COALESCE(ROUND(price - previous_price, 2), 0) as change_amount,
        COALESCE(ROUND(((price - previous_price) / previous_price * 100), 2), 0) as change_percent,
        COALESCE(high_52w, price) as high_52w,
        COALESCE(low_52w, price) as low_52w,
        price as open,
        COALESCE(high_52w * 0.95, price) as high,
        COALESCE(low_52w * 1.05, price) as low,
        market_cap, shares_outstanding, sector, industry, description,
        pe_ratio, eps, dividend_yield, beta, volume, average_volume,
        COALESCE(exchange, 'NGX') as exchange,
        logo
      FROM stocks
      WHERE ticker = ? AND is_active = 1
    `).get(req.params.ticker.toUpperCase());

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    return res.status(200).json({
      success: true,
      stock
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch stock',
      error: error.message
    });
  }
});

// ADMIN — ADD NEW STOCK
router.post('/admin/add', protect, adminOnly, (req, res) => {
  try {
    const { name, ticker, sector, price, logo, description } = req.body;

    if (!name || !ticker || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, ticker and price are required'
      });
    }

    const existing = db.prepare(
      'SELECT id FROM stocks WHERE ticker = ?'
    ).get(ticker.toUpperCase());

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A stock with this ticker already exists'
      });
    }

    const newStock = db.prepare(`
      INSERT INTO stocks (name, ticker, sector, price, previous_price, logo, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, ticker.toUpperCase(), sector, price, price, logo, description);

    return res.status(201).json({
      success: true,
      message: 'Stock added successfully',
      stock_id: newStock.lastInsertRowid
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not add stock',
      error: error.message
    });
  }
});

// ADMIN — UPDATE STOCK PRICE
router.patch('/admin/price/:id', protect, adminOnly, (req, res) => {
  try {
    const { price } = req.body;

    const stock = db.prepare(
      'SELECT * FROM stocks WHERE id = ?'
    ).get(req.params.id);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    db.prepare(`
      UPDATE stocks
      SET previous_price = price, price = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(price, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Stock price updated',
      old_price: stock.price,
      new_price: price
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not update price',
      error: error.message
    });
  }
});

module.exports = router;