
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'pricehistory.db'));

// Initialize database with required tables
function initDatabase() {
  db.exec(`
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
    
    CREATE TABLE IF NOT EXISTS amazon_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_id INTEGER NOT NULL,
      avg_new_price REAL,
      high_new_price REAL,
      low_new_price REAL,
      total_new INTEGER,
      avg_used_price REAL,
      high_used_price REAL,
      low_used_price REAL,
      total_used INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (search_id) REFERENCES searches(id)
    );
    
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      target_price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('Database initialized');
}

// Save eBay search results
function saveEbayResults(query, data) {
  const searchInsert = db.prepare('INSERT INTO searches (query) VALUES (?)');
  const searchResult = searchInsert.run(query);
  const searchId = searchResult.lastInsertRowid;
  
  const ebayInsert = db.prepare(`
    INSERT INTO ebay_prices (
      search_id, avg_price, high_price, low_price, total_sales
    ) VALUES (?, ?, ?, ?, ?)
  `);
  
  ebayInsert.run(
    searchId,
    data.aggregates.avgPrice,
    data.aggregates.highPrice,
    data.aggregates.lowPrice,
    data.aggregates.totalSales
  );
  
  return searchId;
}

// Save Amazon search results
function saveAmazonResults(query, data) {
  // Check if there's a recent search for this query
  const searchQuery = db.prepare('SELECT id FROM searches WHERE query = ? ORDER BY timestamp DESC LIMIT 1');
  const existingSearch = searchQuery.get(query);
  
  let searchId;
  if (existingSearch) {
    searchId = existingSearch.id;
  } else {
    const searchInsert = db.prepare('INSERT INTO searches (query) VALUES (?)');
    const searchResult = searchInsert.run(query);
    searchId = searchResult.lastInsertRowid;
  }
  
  const amazonInsert = db.prepare(`
    INSERT INTO amazon_prices (
      search_id, avg_new_price, high_new_price, low_new_price, total_new,
      avg_used_price, high_used_price, low_used_price, total_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  amazonInsert.run(
    searchId,
    data.aggregates.new.avgNew,
    data.aggregates.new.highNew,
    data.aggregates.new.lowNew,
    data.aggregates.new.totalNew,
    data.aggregates.used.avgUsed,
    data.aggregates.used.highUsed,
    data.aggregates.used.lowUsed,
    data.aggregates.used.totalUsed
  );
  
  return searchId;
}

// Get price history for a query
function getPriceHistory(query) {
  const historyQuery = db.prepare(`
    SELECT 
      s.query, 
      s.timestamp as search_date,
      e.avg_price as ebay_avg_price,
      e.high_price as ebay_high_price,
      e.low_price as ebay_low_price,
      e.total_sales as ebay_total_sales,
      a.avg_new_price as amazon_avg_new_price,
      a.avg_used_price as amazon_avg_used_price
    FROM 
      searches s
    LEFT JOIN 
      ebay_prices e ON s.id = e.search_id
    LEFT JOIN 
      amazon_prices a ON s.id = a.search_id
    WHERE 
      s.query = ?
    ORDER BY 
      s.timestamp DESC
    LIMIT 30
  `);
  
  return historyQuery.all(query);
}

// Wishlist functions
function addToWishlist(productName, targetPrice) {
  const stmt = db.prepare('INSERT INTO wishlist (product_name, target_price) VALUES (?, ?)');
  const result = stmt.run(productName, targetPrice);
  return result.lastInsertRowid;
}

function getWishlist() {
  const stmt = db.prepare('SELECT * FROM wishlist ORDER BY created_at DESC');
  return stmt.all();
}

function removeFromWishlist(id) {
  const stmt = db.prepare('DELETE FROM wishlist WHERE id = ?');
  return stmt.run(id);
}

module.exports = {
  initDatabase,
  saveEbayResults,
  saveAmazonResults,
  getPriceHistory,
  addToWishlist,
  getWishlist,
  removeFromWishlist
};
