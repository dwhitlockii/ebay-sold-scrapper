// Developer: Dean Whitlock

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'pricehistory.db');
const db = new Database(dbPath);

const defaultImagePath = path.join(__dirname, 'public', 'default-image.png');

// Initialize database with required tables
function initDatabase() {
  try {
    // Enable foreign key support
    db.exec('PRAGMA foreign_keys = ON');

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        profile_picture TEXT,
        role TEXT DEFAULT 'user',
        email_verified INTEGER DEFAULT 1,
        reset_password_token TEXT,
        reset_password_expires DATETIME,
        last_login DATETIME,
        login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
        FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE
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
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create indexes if they don't exist
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_reset_password ON users(reset_password_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query);
      CREATE INDEX IF NOT EXISTS idx_ebay_prices_search_id ON ebay_prices(search_id);
      CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// User-related functions
function createUser({ username, email, password, firstName, lastName }) {
  const stmt = db.prepare(`
    INSERT INTO users (
      username, email, password, first_name, last_name, verification_token
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  try {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const result = stmt.run(username, email, password, firstName, lastName, verificationToken);
    return {
      id: result.lastInsertRowid,
      verificationToken
    };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      if (error.message.includes('users.email')) {
        throw new Error('Email already registered');
      }
      if (error.message.includes('users.username')) {
        throw new Error('Username already taken');
      }
    }
    throw error;
  }
}

function verifyEmail(token) {
  const stmt = db.prepare(`
    UPDATE users 
    SET email_verified = 1, 
        verification_token = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE verification_token = ?
  `);
  const result = stmt.run(token);
  return result.changes > 0;
}

function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

function updateLoginAttempts(userId, attempts) {
  const stmt = db.prepare(`
    UPDATE users 
    SET login_attempts = ?, 
        locked_until = CASE 
          WHEN ? >= 5 THEN datetime('now', '+15 minutes')
          ELSE NULL 
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(attempts, attempts, userId);
}

function createSession(userId, token, ipAddress, userAgent) {
  const stmt = db.prepare(`
    INSERT INTO user_sessions (
      user_id, token, ip_address, user_agent, expires_at
    ) VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
  `);
  return stmt.run(userId, token, ipAddress, userAgent);
}

function createRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');
  const stmt = db.prepare(`
    INSERT INTO refresh_tokens (
      user_id, token, expires_at
    ) VALUES (?, ?, datetime('now', '+30 days'))
  `);
  stmt.run(userId, token);
  return token;
}

function validateSession(token) {
  const stmt = db.prepare(`
    SELECT us.*, u.* FROM user_sessions us
    JOIN users u ON us.user_id = u.id
    WHERE us.token = ? AND us.expires_at > datetime('now')
  `);
  return stmt.get(token);
}

function validateRefreshToken(token) {
  const stmt = db.prepare(`
    SELECT rt.*, u.* FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ? AND rt.expires_at > datetime('now')
  `);
  return stmt.get(token);
}

function invalidateSession(token) {
  const stmt = db.prepare('DELETE FROM user_sessions WHERE token = ?');
  return stmt.run(token);
}

function invalidateAllUserSessions(userId) {
  const stmt = db.prepare('DELETE FROM user_sessions WHERE user_id = ?');
  return stmt.run(userId);
}

function updatePassword(userId, hashedPassword) {
  const stmt = db.prepare(`
    UPDATE users 
    SET password = ?,
        reset_password_token = NULL,
        reset_password_expires = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(hashedPassword, userId);
}

function setResetPasswordToken(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const stmt = db.prepare(`
    UPDATE users 
    SET reset_password_token = ?,
        reset_password_expires = datetime('now', '+1 hour'),
        updated_at = CURRENT_TIMESTAMP
    WHERE email = ?
  `);
  const result = stmt.run(token, email);
  return result.changes > 0 ? token : null;
}

// Save eBay search results
function saveEbayResults(query, data) {
  try {
    // Check if we have a recent search (within last 5 minutes) for this query
    const checkRecent = db.prepare(`
      SELECT id FROM searches s
      JOIN ebay_prices e ON e.search_id = s.id
      WHERE s.query = ? 
      AND datetime(e.timestamp) > datetime('now', '-5 minutes')
      ORDER BY e.timestamp DESC
      LIMIT 1
    `);
    
    const recentSearch = checkRecent.get(query);
    if (recentSearch) {
      console.log('Recent search found, skipping save');
      return recentSearch.id;
    }
    
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
  verifyEmail,
  getUserByEmail,
  getUserById,
  updateLoginAttempts,
  createSession,
  createRefreshToken,
  validateSession,
  validateRefreshToken,
  invalidateSession,
  invalidateAllUserSessions,
  updatePassword,
  setResetPasswordToken,
  saveEbayResults,
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  createPriceAlert,
  getEbayHistory
};