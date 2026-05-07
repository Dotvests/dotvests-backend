# Complete Frontend Integration Guide

This is the master guide for integrating your React/React Native frontend with the DotVests API.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Wallet & Deposits](#wallet--deposits)
3. [Stocks & Price Data](#stocks--price-data)
4. [Orders & Trading](#orders--trading)
5. [Portfolio & Analytics](#portfolio--analytics)
6. [Waitlist & Contact](#waitlist--contact)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Authentication

### Signup

```javascript
async function signup(fullName, email, phone, password) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName, email, phone, password })
  });

  const data = await response.json();
  
  if (data.success) {
    // Store token securely
    localStorage.setItem('authToken', data.token);
    return { success: true, userId: data.user.id };
  }
  
  return { success: false, error: data.message };
}
```

### Login

```javascript
async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('authToken', data.token);
    return { success: true };
  }
  
  return { success: false, error: data.message };
}
```

### Auth Header Helper

```javascript
function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Usage in all protected requests:
const headers = getAuthHeaders(localStorage.getItem('authToken'));
```

### Get Current User

```javascript
async function getCurrentUser(token) {
  const response = await fetch('/api/auth/me', {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  return data.success ? data.user : null;
}
```

---

## Wallet & Deposits

### Get Wallet Balance

```javascript
async function getWallet(token) {
  const response = await fetch('/api/wallet', {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      balance: data.data.balance,
      currency: data.data.currency,
      accountNumber: data.data.account_number,
      bankName: data.data.bank_name
    };
  }
  
  throw new Error(data.message);
}
```

### Initialize Paystack Payment

```javascript
async function initializePayment(amount, token) {
  const response = await fetch('/api/payment/initialize', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ amount })
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      amount: data.data.amount
    };
  }
  
  throw new Error(data.message);
}
```

### Verify Payment & Credit Wallet

```javascript
async function verifyPayment(reference, token) {
  const response = await fetch(`/api/payment/verify/${reference}`, {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      message: data.message,
      newBalance: data.new_balance
    };
  }
  
  throw new Error(data.message);
}
```

### Get Banks List

```javascript
async function getBanks() {
  const response = await fetch('/api/payment/banks');
  const data = await response.json();
  
  if (data.success) {
    return data.data; // Array of { id, code, name }
  }
  
  throw new Error(data.message);
}
```

### Get Transaction History

```javascript
async function getTransactions(token, options = {}) {
  const {
    type = 'all',
    limit = 20,
    offset = 0,
    startDate = null,
    endDate = null
  } = options;

  let url = `/api/wallet/transactions?type=${type}&limit=${limit}&offset=${offset}`;
  
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  return data.success ? data.data : [];
}
```

---

## Stocks & Price Data

### Get All Stocks

```javascript
async function getAllStocks(options = {}) {
  const {
    search = '',
    sector = '',
    limit = 50,
    offset = 0
  } = options;

  const url = `/api/stocks?search=${search}&sector=${sector}&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  return data.success ? data.data : [];
}
```

### Get Single Stock Details

```javascript
async function getStockDetails(ticker) {
  const response = await fetch(`/api/stocks/${ticker}`);
  const data = await response.json();
  
  if (data.success) {
    return data.stock;
  }
  
  throw new Error(data.message);
}
```

### Get Trending Stocks

```javascript
async function getTrendingStocks(limit = 10) {
  const response = await fetch(`/api/stocks/trending/list?limit=${limit}`);
  const data = await response.json();
  
  return data.success ? data.data : [];
}
```

### Get Price History (For Charts)

```javascript
async function getPriceHistory(ticker, options = {}) {
  const {
    limit = 100,
    from = null,
    to = null
  } = options;

  let url = `/api/stocks/${ticker}/history?limit=${limit}`;
  
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  const response = await fetch(url);
  const data = await response.json();
  
  return data.success ? data.data : [];
}
```

### Subscribe to Live Prices (SSE)

```javascript
function subscribeToLivePrices(tickers = null, onPrice) {
  const url = tickers 
    ? `/api/stocks/stream?tickers=${tickers.join(',')}`
    : '/api/stocks/stream';

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    const priceData = JSON.parse(event.data);
    onPrice(priceData); // { ticker, price, change, change_percent, timestamp }
  };

  eventSource.onerror = () => {
    eventSource.close();
    console.error('Price stream disconnected');
  };

  // Return unsubscribe function
  return () => eventSource.close();
}
```

---

## Orders & Trading

### Place Order

**Important:** Price is calculated server-side from the current stock price. Send only stock_id, type, and quantity.

```javascript
async function placeOrder(stockId, orderType, quantity, token) {
  // Server will use current stock.price from DB
  // No need to send price from client
  
  const response = await fetch('/api/orders/place', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({
      stock_id: stockId,
      type: orderType, // 'buy' or 'sell'
      quantity: quantity,
      order_type: 'market' // or 'limit'
    })
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      orderId: data.data.id,
      total: data.data.total,
      status: data.data.status
    };
  }
  
  throw new Error(data.message);
}
```

### Get My Orders

```javascript
async function getMyOrders(token, options = {}) {
  const {
    status = 'all',
    type = 'all',
    limit = 50,
    offset = 0
  } = options;

  const url = `/api/orders/my-orders?status=${status}&type=${type}&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  
  return data.success ? data.data : [];
}
```

---

## Portfolio & Analytics

### Get Portfolio

```javascript
async function getPortfolio(token) {
  const response = await fetch('/api/portfolio', {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  
  return data.success ? data.data : [];
}
```

### Get Portfolio Performance

```javascript
async function getPortfolioPerformance(token) {
  const response = await fetch('/api/portfolio/summary/performance', {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      totalInvested: data.data.total_invested,
      currentValue: data.data.current_value,
      gains: data.data.gains,
      roi: data.data.roi
    };
  }
  
  throw new Error(data.message);
}
```

### Add to Watchlist

```javascript
async function addToWatchlist(stockId, token) {
  const response = await fetch('/api/stocks/watchlist/add', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ stock_id: stockId })
  });

  const data = await response.json();
  return data.success;
}
```

### Get Watchlist

```javascript
async function getWatchlist(token) {
  const response = await fetch('/api/stocks/watchlist/me', {
    headers: getAuthHeaders(token)
  });

  const data = await response.json();
  
  return data.success ? data.data : [];
}
```

---

## Waitlist & Contact

### Join Waitlist

```javascript
async function joinWaitlist(email, source = 'landing_page') {
  const response = await fetch('/api/waitlist/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source })
  });

  const data = await response.json();
  
  return {
    success: data.success,
    message: data.message,
    waitlistId: data.waitlist_id
  };
}
```

### Get Waitlist Count

```javascript
async function getWaitlistCount() {
  const response = await fetch('/api/waitlist/count');
  const data = await response.json();
  
  return data.success ? data.count : 0;
}
```

### Check if Email is on Waitlist

```javascript
async function checkWaitlistStatus(email) {
  const response = await fetch('/api/waitlist/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const data = await response.json();
  
  return {
    onWaitlist: data.on_waitlist,
    status: data.status,
    joinedAt: data.joined_at
  };
}
```

### Submit Contact Form

```javascript
async function submitContactForm(fullName, email, subject, message) {
  const response = await fetch('/api/contact/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName, email, subject, message })
  });

  const data = await response.json();
  
  return {
    success: data.success,
    message: data.message,
    contactId: data.contact_id
  };
}
```

---

## Error Handling

### Global Error Handler

```javascript
class APIError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(
        response.status,
        error.message || 'An error occurred'
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
    }
    
    throw error;
  }
}
```

### Network Error Handling

```javascript
async function safeAPICall(fetchFn) {
  try {
    return await fetchFn();
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error('No internet connection');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network request failed');
    }
    
    throw error;
  }
}
```

---

## Best Practices

### 1. Token Management

```javascript
// React Context for auth
const AuthContext = React.createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('authToken');
  });

  const login = (newToken) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

### 2. Debounce Search Requests

```javascript
function useStockSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    debounce(async (query) => {
      if (!query) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const stocks = await getAllStocks({ search: query });
        setResults(stocks);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  return { results, loading, search };
}
```

### 3. Polling Fallback for React Native

```javascript
function usePricePolling(ticker, interval = 10000) {
  const [price, setPrice] = useState(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const stock = await getStockDetails(ticker);
        setPrice({
          ticker: stock.ticker,
          price: stock.price,
          change: stock.change_amount,
          change_percent: stock.change_percent
        });
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    };

    fetchPrice();
    const intervalId = setInterval(fetchPrice, interval);

    return () => clearInterval(intervalId);
  }, [ticker, interval]);

  return price;
}
```

### 4. Form Validation

```javascript
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const validatePassword = (password) => {
  // Minimum 8 chars, 1 uppercase, 1 number, 1 special char
  const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

const validateOrderAmount = (amount, walletBalance) => {
  return amount > 0 && amount <= walletBalance;
};
```

### 5. Loading States & Skeletons

```javascript
function StockListSkeleton() {
  return (
    <div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ 
          height: 80, 
          backgroundColor: '#f0f0f0', 
          margin: 10,
          borderRadius: 8
        }} />
      ))}
    </div>
  );
}

export default function StockList() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllStocks().then(setStocks).finally(() => setLoading(false));
  }, []);

  if (loading) return <StockListSkeleton />;
  
  return <div>{stocks.map(stock => <StockCard key={stock.id} stock={stock} />)}</div>;
}
```

---

## Environment Setup

### .env.local (for your React app)

```env
REACT_APP_API_URL=https://dotvests.com/api
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
REACT_APP_ENVIRONMENT=production
```

### Usage in React

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

async function getAllStocks() {
  const response = await fetch(`${API_URL}/stocks`);
  return response.json();
}
```

---

## Testing Checklist

- [ ] User registration and login
- [ ] Wallet balance display
- [ ] Paystack deposit flow
- [ ] Stock listing and search
- [ ] Live price updates via SSE
- [ ] Chart rendering with historical data
- [ ] Placing buy/sell orders
- [ ] Portfolio view
- [ ] Transaction history
- [ ] Waitlist signup
- [ ] Contact form submission
- [ ] Error handling and network failures
- [ ] Logout and session cleanup
