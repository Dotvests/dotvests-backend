# Frontend Price Simulation & Charts Integration Guide

## Overview

The backend now provides live stock prices via Server-Sent Events (SSE) and historical price data for rendering charts. This guide covers integrating real-time price updates and candlestick charts in your React/React Native frontend.

---

## What the Backend Provides

### 1. Live Price Stream (SSE)
**Endpoint:** `GET /api/stocks/stream`

**Connection:** Server-Sent Events (no library needed, built into browsers)

**Data received every 10 seconds:**
```json
{
  "ticker": "DTV",
  "price": 341.25,
  "change": 5.50,
  "change_percent": 1.63,
  "timestamp": "2026-05-02T12:30:45.123Z"
}
```

### 2. Historical Price Data (Candlesticks)
**Endpoint:** `GET /api/stocks/:ticker/history?limit=100&from=ISO_DATE&to=ISO_DATE`

**Returns 5-minute OHLCV candles:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "stock_id": 1,
      "open": 341.25,
      "high": 341.50,
      "low": 340.90,
      "close": 341.03,
      "volume": 711,
      "timestamp": "2026-05-06T05:19:07.541Z"
    }
  ],
  "count": 100,
  "ticker": "DTV"
}
```

---

## React Implementation

### 1. Install Chart Library

```bash
npm install recharts
# or
npm install chart.js react-chartjs-2
```

### 2. Price Stream Hook

Create `hooks/usePriceStream.js`:

```javascript
import { useEffect, useState } from 'react';

export function usePriceStream(ticker = null) {
  const [price, setPrice] = useState(null);
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    const url = ticker 
      ? `/api/stocks/stream?tickers=${ticker}`
      : '/api/stocks/stream';

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setPrice(data);

      // Keep last 100 prices
      setPrices(prev => [...prev.slice(-99), data]);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [ticker]);

  return { price, prices };
}
```

### 3. Display Live Price

```javascript
import React from 'react';
import { usePriceStream } from '../hooks/usePriceStream';

function PriceDisplay({ ticker }) {
  const { price } = usePriceStream(ticker);

  if (!price) {
    return <div>Loading price...</div>;
  }

  const isPositive = price.change_percent >= 0;

  return (
    <div style={{ fontSize: 24, fontWeight: 'bold' }}>
      <div>₦{price.price.toFixed(2)}</div>
      <div style={{ color: isPositive ? 'green' : 'red', fontSize: 14 }}>
        {isPositive ? '+' : ''}{price.change.toFixed(2)} 
        ({price.change_percent.toFixed(2)}%)
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        Updated: {new Date(price.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

export default PriceDisplay;
```

### 4. Candlestick Chart with Recharts

```javascript
import React, { useEffect, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function StockChart({ ticker }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `/api/stocks/${ticker}/history?limit=288`
        );
        const data = await response.json();

        if (data.success) {
          const formatted = data.data.map(candle => ({
            time: new Date(candle.timestamp).toLocaleTimeString(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
          }));
          setHistory(formatted);
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [ticker]);

  if (loading) return <div>Loading chart...</div>;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={history}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 12 }}
          interval={Math.floor(history.length / 10)}
        />
        <YAxis yAxisId="left" label={{ value: 'Price (₦)', angle: -90, position: 'insideLeft' }} />
        <YAxis yAxisId="right" orientation="right" label={{ value: 'Volume', angle: 90, position: 'insideRight' }} />
        
        <Tooltip 
          formatter={(value) => value.toFixed(2)}
          labelFormatter={(label) => `Time: ${label}`}
        />
        <Legend />

        {/* OHLC lines */}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="open"
          stroke="#8884d8"
          dot={false}
          name="Open"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="close"
          stroke="#82ca9d"
          dot={false}
          name="Close"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="high"
          stroke="#ffc658"
          dot={false}
          name="High"
          strokeDasharray="5 5"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="low"
          stroke="#ff7c7c"
          dot={false}
          name="Low"
          strokeDasharray="5 5"
        />

        {/* Volume bars */}
        <Bar
          yAxisId="right"
          dataKey="volume"
          fill="#8884d8"
          opacity={0.3}
          name="Volume"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default StockChart;
```

### 5. Real-Time Chart Updates

```javascript
import React, { useEffect, useState } from 'react';
import StockChart from './StockChart';
import PriceDisplay from './PriceDisplay';
import { usePriceStream } from '../hooks/usePriceStream';

function StockAnalysisPage({ ticker }) {
  const { price } = usePriceStream(ticker);
  const [chartData, setChartData] = useState([]);

  // Fetch initial history
  useEffect(() => {
    const fetchHistory = async () => {
      const response = await fetch(`/api/stocks/${ticker}/history?limit=288`);
      const data = await response.json();
      setChartData(data.data || []);
    };
    fetchHistory();
  }, [ticker]);

  // Update chart as prices stream in
  useEffect(() => {
    if (price && chartData.length > 0) {
      // Update the last candle with new price info
      const updatedData = [...chartData];
      const lastCandle = updatedData[updatedData.length - 1];
      
      // In real implementation, you'd aggregate the tick into 5-min candles
      // For now, just update close price
      lastCandle.close = price.price;
      lastCandle.high = Math.max(lastCandle.high, price.price);
      lastCandle.low = Math.min(lastCandle.low, price.price);
      
      setChartData(updatedData);
    }
  }, [price]);

  return (
    <div>
      <h1>{ticker}</h1>
      <PriceDisplay ticker={ticker} />
      <StockChart ticker={ticker} />
    </div>
  );
}

export default StockAnalysisPage;
```

---

## React Native Implementation

### 1. Install Chart Library

```bash
npm install react-native-chart-kit
```

### 2. Price Stream Hook (React Native)

Create `hooks/usePriceStream.js`:

```javascript
import { useEffect, useState } from 'react';

export function usePriceStream(ticker = null) {
  const [price, setPrice] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Polling fallback for React Native (SSE not fully supported)
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/stocks/${ticker}`);
        const data = await response.json();
        if (data.success) {
          setPrice({
            ticker: data.stock.ticker,
            price: data.stock.price,
            change: data.stock.change_amount,
            change_percent: data.stock.change_percent,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [ticker]);

  return { price, lastUpdate };
}
```

### 3. Live Price Display (React Native)

```javascript
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { usePriceStream } from '../hooks/usePriceStream';

function PriceDisplay({ ticker }) {
  const { price } = usePriceStream(ticker);

  if (!price) {
    return <ActivityIndicator size="large" color="#007AFF" />;
  }

  const isPositive = price.change_percent >= 0;
  const textColor = isPositive ? '#00AA00' : '#FF0000';

  return (
    <View style={styles.container}>
      <Text style={styles.price}>₦{price.price.toFixed(2)}</Text>
      <Text style={[styles.change, { color: textColor }]}>
        {isPositive ? '+' : ''}{price.change.toFixed(2)} ({price.change_percent.toFixed(2)}%)
      </Text>
      <Text style={styles.timestamp}>
        Updated: {new Date(price.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center'
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333'
  },
  change: {
    fontSize: 16,
    marginTop: 8,
    fontWeight: '600'
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 8
  }
});

export default PriceDisplay;
```

### 4. Candlestick Chart (React Native)

```javascript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

function StockChart({ ticker }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `/api/stocks/${ticker}/history?limit=50`
        );
        const data = await response.json();

        if (data.success) {
          setHistory(data.data);
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [ticker]);

  if (loading) {
    return <ActivityIndicator size="large" color="#007AFF" />;
  }

  if (history.length === 0) {
    return <Text>No chart data available</Text>;
  }

  // Prepare data for LineChart
  const closes = history.map(candle => candle.close);
  const labels = history.map((_, index) => {
    if (index % 10 === 0) {
      return new Date(history[index].timestamp).toLocaleTimeString();
    }
    return '';
  });

  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.title}>Price History (5-min candles)</Text>
        <LineChart
          data={{
            labels: labels,
            datasets: [
              {
                data: closes,
                color: (opacity = 1) => `rgba(0, 170, 255, ${opacity})`,
                strokeWidth: 2
              }
            ]
          }}
          width={screenWidth - 20}
          height={300}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            propsForDots: {
              r: '2',
              strokeWidth: '1'
            }
          }}
          style={styles.chart}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#f9f9f9'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  chart: {
    borderRadius: 8,
    marginVertical: 10
  }
});

export default StockChart;
```

---

## Key Integration Points

### 1. Load Historical Data on Mount
```javascript
useEffect(() => {
  fetchHistory(); // Get 288 5-minute candles
}, [ticker]);
```

### 2. Subscribe to Live Updates
```javascript
useEffect(() => {
  const eventSource = new EventSource('/api/stocks/stream');
  // Listen for updates and refresh chart
}, []);
```

### 3. Handle Price Changes
- Update live price display immediately (green/red indicator)
- Aggregate ticks into 5-minute candles
- Refresh chart in real-time

### 4. Error Handling
```javascript
try {
  const response = await fetch('/api/stocks/:ticker/history');
  if (!response.ok) throw new Error('Failed to fetch');
  // Handle data
} catch (error) {
  // Show error message to user
  console.error(error);
}
```

---

## Performance Tips

### 1. Limit Chart Points
```javascript
// Show only last 100 candles instead of all history
const visibleCandles = history.slice(-100);
```

### 2. Debounce Updates
```javascript
const debouncedUpdate = debounce((newPrice) => {
  updateChart(newPrice);
}, 500);
```

### 3. Memoize Components
```javascript
const MemoizedChart = React.memo(StockChart, (prev, next) => {
  return prev.ticker === next.ticker;
});
```

### 4. Unsubscribe on Unmount
```javascript
useEffect(() => {
  const eventSource = new EventSource('/api/stocks/stream');
  return () => eventSource.close(); // Clean up
}, []);
```

---

## Example: Complete Stock Analysis Page

```javascript
import React, { useState } from 'react';
import PriceDisplay from './components/PriceDisplay';
import StockChart from './components/StockChart';
import { usePriceStream } from './hooks/usePriceStream';

export default function StockAnalysis() {
  const [selectedTicker, setSelectedTicker] = useState('DTV');
  const { price } = usePriceStream(selectedTicker);

  return (
    <div style={{ padding: 20 }}>
      <h1>{selectedTicker}</h1>
      
      {/* Live Price */}
      <PriceDisplay ticker={selectedTicker} />
      
      {/* Price Change Indicator */}
      {price && (
        <div style={{
          padding: 10,
          margin: '20px 0',
          backgroundColor: price.change_percent >= 0 ? '#e8f5e9' : '#ffebee',
          borderRadius: 8
        }}>
          {price.change_percent >= 0 ? '📈' : '📉'} 
          {' '}
          Last 10 seconds: {price.change.toFixed(2)} 
          ({price.change_percent.toFixed(2)}%)
        </div>
      )}
      
      {/* Chart */}
      <StockChart ticker={selectedTicker} />
    </div>
  );
}
```

---

## Testing

### 1. Test SSE Connection
```javascript
// In browser console
const es = new EventSource('http://localhost:3000/api/stocks/stream');
es.onmessage = (e) => console.log(JSON.parse(e.data));
// Should see new data every 10 seconds
```

### 2. Test History Endpoint
```bash
curl http://localhost:3000/api/stocks/DTV/history?limit=10
# Should return array of candles
```

### 3. Monitor Network Tab
- Open DevTools → Network
- Filter by "stream" to see SSE connection
- See data flowing every 10 seconds

---

## Troubleshooting

### Issue: SSE connection not working
**Cause:** Browser CORS or proxy issues

**Solution:**
```javascript
const es = new EventSource('/api/stocks/stream', {
  withCredentials: true
});
```

### Issue: Chart not updating in real-time
**Cause:** Not subscribing to SSE or not updating state

**Solution:**
```javascript
// Make sure to call setState when price updates
const { price } = usePriceStream(ticker);
useEffect(() => {
  if (price) {
    // Update chart state here
    updateChartData(price);
  }
}, [price]);
```

### Issue: Memory leak with event source
**Cause:** Not unsubscribing on component unmount

**Solution:**
```javascript
useEffect(() => {
  const es = new EventSource('/api/stocks/stream');
  return () => es.close(); // Clean up on unmount
}, []);
```
