// Developer: Dean Whitlock

const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors'); // Add CORS middleware
const db = require('./database');
const { saveEbayResults } = require('./database');
const settings = require('./settings');

// Add this near the top of the file after the imports
const DEBUG = true;

// Initialize the database
db.initDatabase();

const app = express();
app.use(express.json()); // Add middleware to parse JSON request bodies
app.use(cors()); // Enable CORS

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Secret key for JWT
const JWT_SECRET = 'your_jwt_secret_key';

// Middleware to protect routes
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Create a dynamic rate limiter
function createRateLimiter() {
    const rateLimitSettings = settings.getRateLimitSettings();
    return rateLimit({
        windowMs: rateLimitSettings.windowMs,
        max: rateLimitSettings.maxRequests
    });
}

// Settings routes
app.get('/api/settings/ratelimit', (req, res) => {
    res.json(settings.getRateLimitSettings());
});

app.post('/api/settings/ratelimit', async (req, res) => {
    try {
        await settings.updateRateLimit(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/settings/proxy', (req, res) => {
    res.json(settings.getProxySettings());
});

app.post('/api/settings/proxy', async (req, res) => {
    try {
        await settings.updateProxy(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Apply rate limiting to API routes
app.use('/api/', createRateLimiter());

// Use proxy in API calls
async function makeRequest(url) {
    const proxy = settings.getNextProxy();
    if (proxy) {
        // Use the proxy for the request
        const agent = new HttpsProxyAgent(proxy);
        return await axios.get(url, { httpsAgent: agent });
    }
    return await axios.get(url);
}

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

// Add array of rotating user agents
const userAgents = [
  // Windows browsers
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/92.0.902.73',
  // macOS browsers
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
  // Mobile browsers
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Mobile Safari/537.36'
];

// Add proxy support (configure with your proxy service)
const proxies = [
  'http://proxy1.example.com:8080',
  'http://proxy2.example.com:8080',
  'http://proxy3.example.com:8080',
  'http://proxy4.example.com:8080',
  'http://proxy5.example.com:8080'
].map(proxy => ({
  host: proxy.split('://')[1].split(':')[0],
  port: proxy.split(':')[2],
  protocol: proxy.split('://')[0]
}));

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Enhanced error logging
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// User registration
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }

  // Password strength validation
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters long and contain at least one letter and one number." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const userId = db.createUser(username, email, hashedPassword);
    res.status(201).json({ success: true, userId });
  } catch (error) {
    res.status(500).json({ error: "An error occurred during registration." });
  }
});

// User login with rate limiting
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route.", user: req.user });
});

// Serve login page
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve registration page
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// ---------------------------
// eBay Sold Items Scraping API
// ---------------------------

app.get('/api/search', async (req, res) => {
  if (DEBUG) console.log('\n=== DEBUG: /api/search endpoint ===');
  const query = req.query.q;
  
  if (DEBUG) {
      console.log('Query:', query);
      console.log('Headers:', req.headers);
  }

  if (!query) {
      if (DEBUG) console.log('No query parameter provided');
      return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
      let ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
      if (DEBUG) console.log('eBay URL:', ebayUrl);

      const response = await axios.get(ebayUrl, {
          headers: {
              'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)]
          }
      });

      if (DEBUG) {
          console.log('eBay Response Status:', response.status);
          console.log('Response Headers:', response.headers);
      }

      const $ = cheerio.load(response.data);

      let items = [];
      
      // Improved selector to only get actual sold items
      $('.s-item__pl-on-bottom').each((i, el) => {
        try {
          const $item = $(el);
          
          // Skip if this is a "Shop on eBay" or "Similar sponsored items" listing
          const title = $item.find('.s-item__title').first().text().trim();
          if (title === "Shop on eBay" || !title) {
            return;
          }

          // Verify this is actually a sold item
          const soldElement = $item.find('.s-item__title--tag, .POSITIVE, .SECONDARY_INFO').text();
          if (!soldElement.includes('Sold')) {
            return;
          }

          let priceText = $item.find('.s-item__price').first().text().trim();
          let soldDateText = $item.find('.s-item__title--tagblock, .POSITIVE').first().text().trim();
          let link = $item.find('.s-item__link').attr('href');
          let image = $item.find('.s-item__image-img').attr('src');
          let condition = $item.find('.SECONDARY_INFO').first().text().trim();

          // More robust price parsing
          const priceMatch = priceText.match(/\$\s?([0-9]+[,.][0-9]+)/);
          if (!priceMatch) {
            console.log(`Skipping item with invalid price format: ${priceText}`);
            return;
          }

          const soldPrice = parseFloat(priceMatch[1].replace(',', ''));
          
          // Skip items with invalid prices
          if (isNaN(soldPrice) || soldPrice <= 0) {
            console.log(`Skipping item with invalid price: ${soldPrice}`);
            return;
          }

          // Parse the date
          const dateMatch = soldDateText.match(/Sold\s+([A-Za-z]+\s+\d+,\s+\d{4})|(\d{2}\/\d{2}\/\d{4})/);
          const soldDate = dateMatch ? new Date(dateMatch[1] || dateMatch[2]) : new Date();

          items.push({
            title,
            link,
            image,
            soldPrice,
            soldDate,
            condition,
            soldDateText: soldDateText.replace(/Sold\s+/, '')
          });

          console.log(`Valid item ${items.length}:`, {
            title: title.substring(0, 50) + '...',
            price: soldPrice,
            date: soldDate
          });

        } catch (err) {
          console.error('Error parsing item:', err.message);
        }
      });

      if (items.length === 0) {
        console.log("No valid sold items were scraped.");
        return res.status(404).json({ 
          error: "No sold item data could be scraped." 
        });
      }

      const totalSales = items.length;
      const sumPrices = items.reduce((sum, item) => sum + item.soldPrice, 0);
      const avgPrice = parseFloat((sumPrices / totalSales).toFixed(2));
      const highPrice = Math.max(...items.map(item => item.soldPrice));
      const lowPrice = Math.min(...items.map(item => item.soldPrice)); // Fixed the error here

      const salesOverTimeObj = {};
      items.forEach(item => {
        const date = new Date(item.soldDate).toISOString().slice(0, 10);
        salesOverTimeObj[date] = (salesOverTimeObj[date] || 0) + 1;
      });
      const datesSorted = Object.keys(salesOverTimeObj).sort();
      const salesCounts = datesSorted.map(date => salesOverTimeObj[date]);

      // Save to database
      db.saveEbayResults(query, {
        aggregates: {
          avgPrice,
          highPrice,
          lowPrice,
          totalSales
        }
      });

      if (DEBUG) {
        console.log(`Found ${items.length} items`);
        console.log('First item example:', items[0]);
        console.log('=== End DEBUG ===\n');
      }

      res.json({
        items,
        aggregates: {
          avgPrice,
          highPrice,
          lowPrice,
          totalSales,
          salesOverTime: {
            dates: datesSorted,
            counts: salesCounts
          }
        }
      });

  } catch (error) {
      console.error('Error during scraping:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ 
          error: "An error occurred while scraping eBay data.",
          details: error.message,
          stack: error.stack
      });
  }
});

app.post('/search-ebay', async (req, res) => {
  const { query } = req.body;
  try {
    const response = await axios.get(`https://api.ebay.com/...`, {
      params: { query },
      headers: { 'Authorization': `Bearer ${process.env.EBAY_API_TOKEN}` }
    });
    
    const data = response.data;
    const searchId = saveEbayResults(query, data);
    
    res.json({ searchId, data });
  } catch (error) {
    console.error('Error fetching eBay data:', error);
    res.status(500).json({ error: 'Failed to fetch eBay data' });
  }
});

// Wishlist API Endpoints

// Get all wishlist items
app.get('/api/wishlist', (req, res) => {
  try {
    const wishlist = db.getWishlist();
    res.json({ wishlist });
  } catch (error) {
    console.error('Error fetching wishlist:', error.message);
    res.status(500).json({ error: "An error occurred while fetching wishlist." });
  }
});

// Add item to wishlist
app.post('/api/wishlist', (req, res) => {
  try {
    const { productName, targetPrice } = req.body;
    
    if (!productName) {
      return res.status(400).json({ error: "Product name is required." });
    }
    
    const id = db.addToWishlist(productName, targetPrice || null);
    res.status(201).json({ 
      success: true, 
      id, 
      message: "Item added to wishlist successfully." 
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error.message);
    res.status(500).json({ error: "An error occurred while adding to wishlist." });
  }
});

// Remove item from wishlist
app.delete('/api/wishlist/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = db.removeFromWishlist(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Item not found in wishlist." });
    }
    
    res.json({ 
      success: true, 
      message: "Item removed from wishlist successfully." 
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error.message);
    res.status(500).json({ error: "An error occurred while removing from wishlist." });
  }
});

// Price History Trends & Analytics
app.get('/api/analytics/:productId', async (req, res) => {
  try {
    const stats = {
      priceVolatility: calculateVolatility(prices),
      seasonalTrends: analyzeSeasonalPatterns(prices),
      bestTimeToSell: findOptimalSellingPeriods(prices),
      priceProjection: predictFuturePrices(prices)
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Analytics calculation failed" });
  }
});

app.get('/api/historical-data', async (req, res) => {
  const query = req.query.q;
  console.log('\n=== Historical Data Debug ===');
  console.log('Query:', query);
  
  if (!query) {
    console.log('ERROR: No query parameter provided');
    console.log('===========================');
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
    // eBay History Debug
    console.log('\n--- eBay History ---');
    console.log('eBay Search URL:', `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`);
    console.log('Executing query for:', query);
    const ebayHistory = await db.getEbayHistory(query);
    console.log('Records found:', ebayHistory.length);
    if (ebayHistory.length > 0) {
      console.log('Latest record:', ebayHistory[0]);
      console.log('Oldest record:', ebayHistory[ebayHistory.length - 1]);
    }

    const response = { ebayHistory };
    console.log('\nResponse summary:');
    console.log('eBay records:', ebayHistory.length);
    console.log('Search URL:', `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`);
    console.log('===========================\n');
    
    res.json(response);
  } catch (error) {
    console.error('\nERROR in historical data:', error);
    console.error('Stack:', error.stack);
    console.log('===========================\n');
    res.status(500).json({ error: "An error occurred while fetching historical data." });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});