const db = require('../config/db');

class PriceSimulator {
  constructor() {
    this.running = false;
    this.interval = null;
    this.clients = new Set();
    this.candleData = new Map(); // Track candles being built
    this.lastCandleTime = new Map(); // Track when last candle was saved
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('Price simulator started');

    // Seed historical data if missing
    this.seedHistoricalData();

    // Update prices every 10 seconds
    this.interval = setInterval(() => {
      this.updatePrices();
    }, 10000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
    this.clients.clear();
    console.log('Price simulator stopped');
  }

  // Subscribe a client to price updates
  subscribe(res, tickers = null) {
    this.clients.add({ res, tickers });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Remove client when connection closes
    res.on('close', () => {
      this.clients.delete({ res, tickers });
    });
  }

  // Broadcast price update to all connected clients
  broadcast(ticker, stock) {
    const change = stock.price - (stock.previous_price || stock.price);
    const changePercent = stock.previous_price ? (change / stock.previous_price) * 100 : 0;

    const data = {
      ticker,
      price: parseFloat(stock.price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      change_percent: parseFloat(changePercent.toFixed(2)),
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(({ res, tickers }) => {
      // If client specified tickers, only send if this ticker matches
      if (tickers && !tickers.includes(ticker)) return;

      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        // Client disconnected
        this.clients.delete({ res, tickers });
      }
    });
  }

  // Normal distribution (Box-Muller transform)
  normalRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Update all stock prices using Geometric Brownian Motion
  updatePrices() {
    try {
      const stocks = db.prepare('SELECT * FROM stocks WHERE is_active = 1').all();

      stocks.forEach((stock) => {
        const dt = 10 / 86400; // 10 seconds as fraction of trading day
        const beta = stock.beta || 1;
        const sigma = 0.002 * beta; // Volatility based on beta
        const drift = 0.0001; // Slight upward drift

        // Geometric Brownian Motion
        const z = this.normalRandom();
        const logReturn = (drift - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * z;
        let newPrice = stock.price * Math.exp(logReturn);

        // Clamp price to ±20% from previous close
        const priceFloor = stock.previous_price ? stock.previous_price * 0.8 : stock.price * 0.8;
        const priceCeiling = stock.previous_price ? stock.previous_price * 1.2 : stock.price * 1.2;
        newPrice = Math.max(priceFloor, Math.min(priceCeiling, newPrice));

        // Update stock record
        db.prepare(`
          UPDATE stocks
          SET price = ?, previous_price = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newPrice, stock.price, stock.id);

        // Track candle data
        this.updateCandle(stock.id, stock.ticker, newPrice);

        // Broadcast to SSE clients
        this.broadcast(stock.ticker, { ...stock, price: newPrice, previous_price: stock.price });
      });
    } catch (error) {
      console.error('Error updating prices:', error.message);
    }
  }

  // Track open/high/low/close for 5-minute candles
  updateCandle(stockId, ticker, price) {
    const now = new Date();
    const candleKey = `${stockId}`;

    if (!this.candleData.has(candleKey)) {
      this.candleData.set(candleKey, {
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        startTime: now
      });
      this.lastCandleTime.set(candleKey, now);
    } else {
      const candle = this.candleData.get(candleKey);
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.volume += 1;

      // Save candle every 5 minutes
      const timeSinceOpen = (now - candle.startTime) / 1000 / 60; // minutes
      if (timeSinceOpen >= 5) {
        this.saveCandle(stockId, candle);
        this.candleData.delete(candleKey);
        this.lastCandleTime.delete(candleKey);
      }
    }
  }

  // Save a completed 5-minute candle to the database
  saveCandle(stockId, candle) {
    try {
      db.prepare(`
        INSERT INTO price_history (stock_id, open, high, low, close, volume, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        stockId,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume
      );
    } catch (error) {
      console.error('Error saving candle:', error.message);
    }
  }

  // Seed historical data if stock has no price history
  seedHistoricalData() {
    try {
      const stocks = db.prepare('SELECT * FROM stocks WHERE is_active = 1').all();

      stocks.forEach((stock) => {
        const existingCandles = db.prepare(
          'SELECT COUNT(*) as count FROM price_history WHERE stock_id = ?'
        ).get(stock.id);

        if (existingCandles.count === 0) {
          // Generate 24 hours of 5-minute candles (288 candles)
          let price = stock.price;
          const now = new Date();

          for (let i = 287; i >= 0; i--) {
            const candleTime = new Date(now.getTime() - i * 5 * 60 * 1000);
            const beta = stock.beta || 1;
            const sigma = 0.002 * beta;

            // Generate OHLCV for this 5-min period
            const open = price;
            let high = price;
            let low = price;
            let volume = Math.floor(Math.random() * 1000) + 100;

            // Simulate 30 ticks within the 5-min candle
            for (let j = 0; j < 30; j++) {
              const z = this.normalRandom();
              const dt = (5 / 1440); // 5 minutes as fraction of trading day
              const logReturn = (0.0001 - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * z;
              price = price * Math.exp(logReturn);
              high = Math.max(high, price);
              low = Math.min(low, price);
            }

            const close = price;

            db.prepare(`
              INSERT INTO price_history (stock_id, open, high, low, close, volume, timestamp)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(stock.id, open, high, low, close, volume, candleTime.toISOString());
          }

          console.log(`Seeded 288 historical candles for ${stock.ticker}`);
        }
      });
    } catch (error) {
      console.error('Error seeding historical data:', error.message);
    }
  }

  // Get historical candles for a stock
  getHistory(stockId, limit = 100, from = null, to = null) {
    try {
      let query = 'SELECT * FROM price_history WHERE stock_id = ?';
      const params = [stockId];

      if (from) {
        query += ' AND timestamp >= ?';
        params.push(from);
      }

      if (to) {
        query += ' AND timestamp <= ?';
        params.push(to);
      }

      query += ' ORDER BY timestamp ASC LIMIT ?';
      params.push(limit);

      return db.prepare(query).all(...params);
    } catch (error) {
      console.error('Error fetching history:', error.message);
      return [];
    }
  }
}

// Singleton instance
const simulator = new PriceSimulator();

module.exports = simulator;
