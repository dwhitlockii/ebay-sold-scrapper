// Developer: Dean Whitlock

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'pricehistory.db'));

const defaultImagePath = path.join(__dirname, 'public', 'default-image.png');

// Initialize database with required tables
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ebay_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_id INTEGER NOT NULL,
        avg_price REAL NOT NULL,
        high_price REAL NOT NULL,
        low_price REAL NOT NULL,
        total_sales INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (search_id) REFERENCES searches(id)
      );
      CREATE TABLE IF NOT EXISTS wishlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        target_price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS price_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        target_price REAL NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Create a new user
function createUser(username, email, password) {
  try {
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(username, email, password);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Get a user by username
function getUserByUsername(username) {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  } catch (error) {
    console.error('Error getting user by username:', error);
    throw error;
  }
}

// Save eBay search results
function saveEbayResults(query, data) {
  try {
    const searchInsert = db.prepare('INSERT INTO searches (query) VALUES (?)');
    const searchResult = searchInsert.run(query);
    const searchId = searchResult.lastInsertRowid;
    
    const ebayInsert = db.prepare(`
      INSERT INTO ebay_prices (
        search_id, avg_price, high_price, low_price, total_sales, timestamp
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    ebayInsert.run(
      searchId,
      data.aggregates.avgPrice,
      data.aggregates.highPrice,
      data.aggregates.lowPrice,
      data.aggregates.totalSales
    );
    
    console.log('eBay results saved successfully');
    return searchId;
  } catch (error) {
    console.error('Error saving eBay results:', error);
    throw error;
  }
}

function formatPrice(price) {
  return price !== null ? `$${price.toFixed(2)}` : 'N/A';
}

// Wishlist functions
function addToWishlist(productName, targetPrice) {
  try {
    const stmt = db.prepare('INSERT INTO wishlist (product_name, target_price) VALUES (?, ?)');
    const result = stmt.run(productName, targetPrice);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    throw error;
  }
}

function getWishlist() {
  try {
    const stmt = db.prepare('SELECT * FROM wishlist ORDER BY created_at DESC');
    return stmt.all();
  } catch (error) {
    console.error('Error getting wishlist:', error);
    throw error;
  }
}

function removeFromWishlist(id) {
  try {
    const stmt = db.prepare('DELETE FROM wishlist WHERE id = ?');
    return stmt.run(id);
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    throw error;
  }
}

function createPriceAlert(userId, productName, targetPrice) {
  try {
    const stmt = db.prepare(`
      INSERT INTO price_alerts (user_id, product_name, target_price) VALUES (?, ?, ?)
    `);
    const result = stmt.run(userId, productName, targetPrice);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating price alert:', error);
    throw error;
  }
}

function getEbayHistory(query) {
  try {
    console.log('Executing eBay history query for:', query);
    const stmt = db.prepare(`
      SELECT ebay_prices.timestamp, 
             ebay_prices.avg_price, 
             ebay_prices.high_price, 
             ebay_prices.low_price, 
             ebay_prices.total_sales
      FROM ebay_prices
      JOIN searches ON ebay_prices.search_id = searches.id
      WHERE searches.query = ?
      ORDER BY ebay_prices.timestamp DESC
    `);
    
    console.log('SQL Query:', stmt.source);
    const results = stmt.all(query);
    console.log('Query results:', results);
    return results;
  } catch (error) {
    console.error('Error in getEbayHistory:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = {
  db, // Export the database instance
  initDatabase,
  createUser,
  getUserByUsername,
  saveEbayResults,
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  createPriceAlert,
  getEbayHistory
};
