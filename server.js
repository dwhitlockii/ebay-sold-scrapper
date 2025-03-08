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

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

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
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
    // Construct the eBay URL for sold/completed items
    let ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
    console.log(`Fetching URL: ${ebayUrl}`);

    // Fetch the eBay page HTML.
    const response = await axios.get(ebayUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/90.0.4430.93 Safari/537.36'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);

    console.log(`Found ${$('.s-item').length} elements with '.s-item' selector.`);
    let items = [];
    $('.s-item').each((i, el) => {
      // Try to extract price using primary and fallback selectors.
      let priceText = $(el).find('.s-item__price').first().text().trim();
      if (!priceText) {
        priceText = $(el).find('span[itemprop="price"]').first().text().trim();
      }

      if (priceText) {
        const soldPrice = parseFloat(priceText.replace(/[^0-9\.]/g, ''));

        // Try to extract sold date information.
        let soldDateText = $(el).find('.s-item__title--tagblock').first().text().trim();
        let soldDate;
        if (soldDateText && soldDateText.match(/\d{2}\/\d{2}\/\d{4}/)) {
          soldDate = new Date(soldDateText);
        } else {
          // If no date is found, simulate a sold date within the last 30 days.
          const today = new Date();
          const pastTime = Math.random() * 30 * 24 * 60 * 60 * 1000;
          soldDate = new Date(today.getTime() - pastTime);
        }

        // Extract the sold item title and link.
        let title = $(el).find('.s-item__title').first().text().trim();
        let link = $(el).find('.s-item__link').attr('href');

        if (!isNaN(soldPrice)) {
          items.push({ title, link, soldPrice, soldDate });
        }
      }
    });

    if (items.length === 0) {
      console.log("No valid sold items were scraped.");
      return res.status(404).json({ 
        error: "No sold item data could be scraped. The page structure may have changed or there are no sold listings for this query." 
      });
    }

    // Compute aggregate metrics.
    const totalSales = items.length;
    const sumPrices = items.reduce((sum, item) => sum + item.soldPrice, 0);
    const avgPrice = parseFloat((sumPrices / totalSales).toFixed(2));
    const highPrice = Math.max(...items.map(item => item.soldPrice));
    const lowPrice = Math.min(...items.map(item => item.soldPrice));

    // Group sales over time (by date in YYYY-MM-DD format).
    const salesOverTimeObj = {};
    items.forEach(item => {
      const date = new Date(item.soldDate).toISOString().slice(0, 10);
      salesOverTimeObj[date] = (salesOverTimeObj[date] || 0) + 1;
    });
    const datesSorted = Object.keys(salesOverTimeObj).sort();
    const salesCounts = datesSorted.map(date => salesOverTimeObj[date]);

    // Save results to database
    db.saveEbayResults(query, {
      aggregates: {
        avgPrice,
        highPrice,
        lowPrice,
        totalSales
      }
    });

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
    console.error('Error during scraping:', error.message);
    res.status(500).json({ error: "An error occurred while scraping eBay data." });
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

// ---------------------------
// Amazon New & Used Scraping API
// ---------------------------

app.get('/api/search/amazon', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }
  try {
    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    console.log(`Fetching Amazon URL: ${amazonUrl}`);
    const response = await axios.get(amazonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/90.0.4430.93 Safari/537.36'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);
    let items = [];
    // Each Amazon search result is in a container with this attribute.
    $('div[data-component-type="s-search-result"]').each((i, el) => {
      const title = $(el).find('h2 a span').text().trim();
      if (!title) {
        return; // Skip if no title is found.
      }
      let newPrice = null;
      let usedPrice = null;

      // Extract new price for this product.
      const newPriceText = $(el).find('span.a-price > span.a-offscreen').first().text().trim();
      if (newPriceText) {
        newPrice = parseFloat(newPriceText.replace(/[^0-9\.]/g, ''));
      }

      // Extract used price if available (looking for text like "Used from $XX.XX")
      let usedPriceText = "";
      $(el).find('span.a-size-base.a-color-price').each((j, usedEl) => {
        const text = $(usedEl).text().trim();
        if (text.toLowerCase().includes("used from")) {
          usedPriceText = text;
        }
      });
      if (usedPriceText) {
        const match = usedPriceText.match(/\$([0-9\.,]+)/);
        if (match) {
          usedPrice = parseFloat(match[1].replace(/,/g, ''));
        }
      }
      items.push({ title, newPrice, usedPrice });
    });

    // Filter out items without any price info.
    items = items.filter(item => item.newPrice !== null || item.usedPrice !== null);

    if (items.length === 0) {
      console.log("No relevant Amazon data was scraped.");
      return res.status(404).json({ error: "No relevant Amazon data could be scraped for this query." });
    }

    // Compute aggregates for new prices.
    const newItems = items.filter(item => item.newPrice !== null);
    const totalNew = newItems.length;
    const sumNew = newItems.reduce((sum, item) => sum + item.newPrice, 0);
    const avgNew = totalNew ? parseFloat((sumNew / totalNew).toFixed(2)) : null;
    const highNew = totalNew ? Math.max(...newItems.map(item => item.newPrice)) : null;
    const lowNew = totalNew ? Math.min(...newItems.map(item => item.newPrice)) : null;

    // Compute aggregates for used prices.
    const usedItems = items.filter(item => item.usedPrice !== null);
    const totalUsed = usedItems.length;
    const sumUsed = usedItems.reduce((sum, item) => sum + item.usedPrice, 0);
    const avgUsed = totalUsed ? parseFloat((sumUsed / totalUsed).toFixed(2)) : null;
    const highUsed = totalUsed ? Math.max(...usedItems.map(item => item.usedPrice)) : null;
    const lowUsed = totalUsed ? Math.min(...usedItems.map(item => item.usedPrice)) : null;

    // Save results to database
    db.saveAmazonResults(query, {
      aggregates: {
        new: { totalNew, avgNew, highNew, lowNew },
        used: { totalUsed, avgUsed, highUsed, lowUsed }
      }
    });

    res.json({
      items,
      aggregates: {
        new: { totalNew, avgNew, highNew, lowNew },
        used: { totalUsed, avgUsed, highUsed, lowUsed }
      }
    });
  } catch (error) {
    console.error("Error during Amazon scraping:", error.message);
    res.status(500).json({ error: "An error occurred while scraping Amazon data." });
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
  console.log('Historical data requested for query:', query);
  
  if (!query) {
    console.log('No query parameter provided');
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
    console.log('Fetching eBay history...');
    const ebayHistory = await db.getEbayHistory(query);
    console.log('eBay history results:', ebayHistory);

    console.log('Fetching Amazon history...');
    const amazonHistory = await db.getAmazonHistory(query);
    console.log('Amazon history results:', amazonHistory);

    const response = { ebayHistory, amazonHistory };
    console.log('Sending response:', response);
    
    res.json(response);
  } catch (error) {
    console.error('Detailed error in historical data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: "An error occurred while fetching historical data." });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});