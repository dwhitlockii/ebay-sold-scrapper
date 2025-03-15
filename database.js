// Developer: Dean Whitlock

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logger } = require('./utils/logger');

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
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        avg_price REAL,
        high_price REAL,
        low_price REAL,
        total_sales INTEGER,
        status TEXT DEFAULT 'pending',
        error TEXT,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

      CREATE TABLE IF NOT EXISTS search_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_id INTEGER,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        link TEXT,
        image_url TEXT,
        sold_date TEXT,
        FOREIGN KEY (search_id) REFERENCES searches (id)
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
      CREATE INDEX IF NOT EXISTS idx_search_results_search_id ON search_results(search_id);
    `);

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Error initializing database:', error);
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
  const { aggregates } = data;
  
  // Start a transaction
  const transaction = db.transaction((query, aggregates) => {
    // Insert search record
    const searchStmt = db.prepare(`
      INSERT INTO searches (query, avg_price, high_price, low_price, total_sales)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = searchStmt.run(
      query,
      aggregates.avgPrice,
      aggregates.highPrice,
      aggregates.lowPrice,
      aggregates.totalSales
    );
    
    return result.lastInsertRowid;
  });

  try {
    const searchId = transaction(query, aggregates);
    logger.info('Search results saved successfully', { searchId });
    return searchId;
  } catch (error) {
    logger.error('Error saving search results:', error);
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
    logger.error('Error adding to wishlist:', error);
    throw error;
  }
}

function getWishlist() {
  try {
    const stmt = db.prepare('SELECT * FROM wishlist ORDER BY created_at DESC');
    return stmt.all();
  } catch (error) {
    logger.error('Error getting wishlist:', error);
    throw error;
  }
}

function removeFromWishlist(id) {
  try {
    const stmt = db.prepare('DELETE FROM wishlist WHERE id = ?');
    return stmt.run(id);
  } catch (error) {
    logger.error('Error removing from wishlist:', error);
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
    logger.error('Error creating price alert:', error);
    throw error;
  }
}

function getEbayHistory(query = '') {
  try {
    let sql = `
      SELECT id, query, timestamp, avg_price, high_price, low_price, total_sales
      FROM searches
    `;
    
    const params = [];
    if (query) {
      sql += ' WHERE query LIKE ?';
      params.push(`%${query}%`);
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT 50';
    
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    logger.error('Error fetching search history:', error);
    throw error;
  }
}

// Execute a SQL query and return all results
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    logger.error('Database query error:', error);
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
  getEbayHistory,
  all
};