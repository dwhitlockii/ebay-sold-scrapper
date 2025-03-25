const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logger } = require('../utils/logger');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, '../data/ebay.db'), (err) => {
            if (err) {
                logger.error('Error opening database:', err);
                throw err;
            }
            logger.info('Connected to SQLite database');
            this.initDatabase();
        });
    }

    initDatabase() {
        // Create tables if they don't exist
        this.db.serialize(() => {
            // eBay sold items table
            this.db.run(`CREATE TABLE IF NOT EXISTS ebay_sold_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                item_id TEXT NOT NULL,
                title TEXT,
                price REAL,
                sold_date DATETIME,
                seller_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Price history table
            this.db.run(`CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                price REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES ebay_sold_items(item_id)
            )`);

            // Analytics table
            this.db.run(`CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_items INTEGER,
                avg_price REAL,
                min_price REAL,
                max_price REAL,
                price_std_dev REAL,
                overall_avg REAL,
                demand_score REAL,
                market_saturation REAL,
                price_trend REAL,
                volatility REAL,
                seasonal_factor REAL,
                confidence_score REAL
            )`);

            // Market trends table
            this.db.run(`CREATE TABLE IF NOT EXISTS market_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                date DATE NOT NULL,
                volume INTEGER,
                price_change_percent REAL,
                demand_change_percent REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Create indexes for better performance
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_ebay_sold_items_query ON ebay_sold_items(query)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_ebay_sold_items_sold_date ON ebay_sold_items(sold_date)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_query ON analytics(query)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_market_trends_query ON market_trends(query)`);
        });
    }

    async saveEbayResults(query, data) {
        return new Promise((resolve, reject) => {
            try {
                if (!data || !data.items || !Array.isArray(data.items)) {
                    logger.error('Invalid data format for saveEbayResults:', { data });
                    return reject(new Error('Invalid data format: items array is required'));
                }

                const { items } = data;

                if (items.length === 0) {
                    logger.warn('No items to save for query:', query);
                    return resolve(); // Nothing to save, but not an error
                }

                const stmt = this.db.prepare(`
                    INSERT INTO ebay_sold_items (query, item_id, title, price, sold_date, seller_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                this.db.serialize(() => {
                    this.db.run('BEGIN TRANSACTION');

                    items.forEach(item => {
                        try {
                            if (!item.itemId) {
                                logger.warn('Skipping item with no itemId:', item);
                                return; // Skip this item but continue with others
                            }

                            stmt.run(
                                query,
                                item.itemId,
                                item.title || '',
                                parseFloat(item.price) || 0,
                                item.soldDate || new Date().toISOString(),
                                item.sellerId || 'unknown'
                            );
                        } catch (itemError) {
                            logger.error('Error saving individual item:', {
                                error: itemError.message,
                                item
                            });
                            // Continue with other items
                        }
                    });

                    stmt.finalize();

                    // After saving items, update analytics
                    this.updateAnalytics(query, true)
                        .then(() => {
                            // Also update market trends - pass true to indicate we're already in a transaction
                            this.updateMarketTrends(query, true)
                                .then(() => {
                                    this.db.run('COMMIT', (err) => {
                                        if (err) {
                                            logger.error('Error committing transaction:', err);

                                            // Try to rollback
                                            this.db.run('ROLLBACK', (rollbackErr) => {
                                                if (rollbackErr) {
                                                    logger.error('Error rolling back transaction:', rollbackErr);
                                                }
                                                reject(err);
                                            });
                                        } else {
                                            resolve();
                                        }
                                    });
                                })
                                .catch(trendsError => {
                                    logger.error('Error updating market trends, continuing anyway:', trendsError);

                                    // Commit anyway
                                    this.db.run('COMMIT', (err) => {
                                        if (err) {
                                            logger.error('Error committing transaction:', err);

                                            // Try to rollback
                                            this.db.run('ROLLBACK', (rollbackErr) => {
                                                if (rollbackErr) {
                                                    logger.error('Error rolling back transaction:', rollbackErr);
                                                }
                                                reject(err);
                                            });
                                        } else {
                                            resolve();
                                        }
                                    });
                                });
                        })
                        .catch(analyticsError => {
                            logger.error('Error updating analytics:', analyticsError);

                            // Try to commit anyway to save the items
                            this.db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    logger.error('Error committing transaction after analytics error:', commitErr);

                                    // Try to rollback
                                    this.db.run('ROLLBACK', (rollbackErr) => {
                                        if (rollbackErr) {
                                            logger.error('Error rolling back transaction:', rollbackErr);
                                        }
                                        reject(commitErr);
                                    });
                                } else {
                                    // We at least saved the items
                                    logger.info('Saved items but analytics update failed');
                                    resolve();
                                }
                            });
                        });
                });
            } catch (error) {
                logger.error('Error in saveEbayResults:', error);
                reject(error);
            }
        });
    }

    async updateAnalytics(query, inTransaction = false) {
        return new Promise((resolve, reject) => {
            console.log('Starting analytics update for query:', query);
            
            const sql = `
                WITH price_stats AS (
                    SELECT 
                        COUNT(*) as total_items,
                        COALESCE(ROUND(AVG(price), 2), 0) as avg_price,
                        COALESCE(ROUND(MIN(price), 2), 0) as min_price,
                        COALESCE(ROUND(MAX(price), 2), 0) as max_price,
                        COALESCE(ROUND(SQRT(AVG(price * price) - AVG(price) * AVG(price)), 2), 0) as price_std_dev
                    FROM ebay_sold_items 
                    WHERE query = ?
                ),
                recent_stats AS (
                    SELECT 
                        COALESCE(ROUND(AVG(price), 2), 0) as recent_avg_price,
                        COUNT(*) as recent_sales
                    FROM ebay_sold_items 
                    WHERE query = ? 
                    AND sold_date >= date('now', '-30 days')
                ),
                historical_stats AS (
                    SELECT 
                        COALESCE(ROUND(AVG(price), 2), 0) as historical_avg_price,
                        COUNT(*) as historical_sales
                    FROM ebay_sold_items 
                    WHERE query = ? 
                    AND sold_date >= date('now', '-90 days')
                )
                INSERT OR REPLACE INTO analytics (
                    query,
                    total_items,
                    avg_price,
                    min_price,
                    max_price,
                    price_std_dev,
                    overall_avg,
                    demand_score,
                    market_saturation,
                    price_trend,
                    volatility,
                    seasonal_factor,
                    confidence_score
                )
                SELECT 
                    ?,
                    ps.total_items,
                    ps.avg_price,
                    ps.min_price,
                    ps.max_price,
                    ps.price_std_dev,
                    COALESCE(rs.recent_avg_price, 0) as overall_avg,
                    CASE 
                        WHEN ps.total_items > 0 THEN COALESCE(ROUND(rs.recent_sales * 1.0 / 30, 2), 0)
                        ELSE 0
                    END as demand_score,
                    CASE 
                        WHEN ps.total_items > 0 THEN COALESCE(ROUND(rs.recent_sales * 1.0 / ps.total_items, 2), 0)
                        ELSE 0
                    END as market_saturation,
                    CASE 
                        WHEN hs.historical_avg_price > 0 THEN 
                            COALESCE(ROUND(((rs.recent_avg_price - hs.historical_avg_price) / hs.historical_avg_price) * 100, 2), 0)
                        ELSE 0
                    END as price_trend,
                    CASE 
                        WHEN ps.avg_price > 0 THEN 
                            COALESCE(ROUND((ps.price_std_dev / ps.avg_price) * 100, 2), 0)
                        ELSE 0
                    END as volatility,
                    CASE 
                        WHEN hs.historical_sales > 0 THEN 
                            COALESCE(ROUND(rs.recent_sales * 1.0 / (hs.historical_sales / 3), 2), 0)
                        ELSE 0
                    END as seasonal_factor,
                    CASE 
                        WHEN ps.avg_price > 0 THEN 
                            COALESCE(ROUND(1.0 - (ps.price_std_dev / ps.avg_price), 2), 0)
                        ELSE 0
                    END as confidence_score
                FROM price_stats ps
                CROSS JOIN recent_stats rs
                CROSS JOIN historical_stats hs
            `;

            const executeAnalyticsUpdate = () => {
                this.db.run(sql, [query, query, query, query], (err) => {
                    if (err) {
                        console.error('Error updating analytics:', err);
                        reject(err);
                    } else {
                        console.log('Analytics updated successfully');
                        // Log the final analytics values
                        this.db.get('SELECT * FROM analytics WHERE query = ?', [query], (getErr, row) => {
                            if (getErr) {
                                console.error('Error getting final analytics:', getErr);
                            } else {
                                console.log('Final analytics values:', row);
                            }
                            resolve();
                        });
                    }
                });
            };

            // Only start a transaction if we're not already in one
            if (!inTransaction) {
                try {
                    this.db.run('BEGIN TRANSACTION', (err) => {
                        if (err) {
                            console.error('Error beginning transaction for analytics:', err);
                            reject(err);
                        } else {
                            executeAnalyticsUpdate();
                        }
                    });
                } catch (error) {
                    console.error('Exception starting transaction for analytics:', error);
                    reject(error);
                }
            } else {
                // Already in a transaction, just execute the update
                executeAnalyticsUpdate();
            }
        });
    }

    async getAnalytics(query) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT *
                FROM analytics
                WHERE query = ?
                ORDER BY timestamp DESC
                LIMIT 1
            `;

            this.db.get(sql, [query], (err, row) => {
                if (err) {
                    logger.error('Error fetching analytics:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getEbayHistory(query, days = 30) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    DATE(sold_date) as date,
                    ROUND(AVG(price), 2) as avg_price,
                    ROUND(MAX(price), 2) as max_price,
                    ROUND(MIN(price), 2) as min_price,
                    COUNT(*) as total_sales,
                    GROUP_CONCAT(DISTINCT seller_id) as seller_ids
                FROM ebay_sold_items
                WHERE query = ?
                AND sold_date IS NOT NULL
                AND sold_date >= DATE('now', ?)
                GROUP BY DATE(sold_date)
                ORDER BY date DESC
            `;

            this.db.all(sql, [query, `-${days} days`], (err, rows) => {
                if (err) {
                    logger.error('Error fetching eBay history:', err);
                    reject(err);
                } else {
                    // Process the rows to ensure proper data format
                    const processedRows = rows.map(row => {
                        // Extract unique sellers from the concatenated string
                        const sellerIdsArray = row.seller_ids ? row.seller_ids.split(',') : [];
                        const uniqueSellers = [...new Set(sellerIdsArray)];

                        return {
                            ...row,
                            timestamp: row.date, // Add timestamp for compatibility with analytics
                            avg_price: parseFloat(row.avg_price) || 0,
                            max_price: parseFloat(row.max_price) || 0,
                            min_price: parseFloat(row.min_price) || 0,
                            total_sales: parseInt(row.total_sales) || 0,
                            seller_id: uniqueSellers.join(',') // Keep for backward compatibility
                        };
                    });

                    resolve(processedRows);
                }
            });
        });
    }

    async updateMarketTrends(query, inTransaction = false) {
        return new Promise((resolve, reject) => {
            // Get the last 30 days of data
            this.getEbayHistory(query, 30)
                .then(history => {
                    if (!history || history.length < 2) {
                        // Not enough data for trends
                        resolve();
                        return;
                    }

                    try {
                        // Calculate daily trends
                        const stmt = this.db.prepare(`
                            INSERT OR REPLACE INTO market_trends (
                                query, date, volume, price_change_percent, demand_change_percent
                            ) VALUES (?, ?, ?, ?, ?)
                        `);

                        // Sort by date ascending for proper trend calculation
                        const sortedHistory = [...history].sort((a, b) =>
                            new Date(a.date) - new Date(b.date)
                        );

                        // Process trends function - startedTransaction indicates if we started a new transaction
                        const processTrends = (startedTransaction) => {
                            try {
                                for (let i = 1; i < sortedHistory.length; i++) {
                                    const current = sortedHistory[i];
                                    const previous = sortedHistory[i-1];

                                    // Calculate price change percentage
                                    const priceChange = previous.avg_price > 0
                                        ? ((current.avg_price - previous.avg_price) / previous.avg_price) * 100
                                        : 0;

                                    // Calculate demand change percentage
                                    const demandChange = previous.total_sales > 0
                                        ? ((current.total_sales - previous.total_sales) / previous.total_sales) * 100
                                        : 0;

                                    stmt.run(
                                        query,
                                        current.date,
                                        current.total_sales,
                                        priceChange.toFixed(2),
                                        demandChange.toFixed(2)
                                    );
                                }

                                stmt.finalize();

                                // Only commit if we started a transaction ourselves
                                if (startedTransaction) {
                                    this.db.run('COMMIT', (err) => {
                                        if (err) {
                                            logger.error('Error committing transaction:', err);
                                            
                                            // Try to rollback
                                            this.db.run('ROLLBACK', (rollbackErr) => {
                                                if (rollbackErr) {
                                                    logger.error('Error rolling back transaction:', rollbackErr);
                                                }
                                                reject(err);
                                            });
                                        } else {
                                            resolve();
                                        }
                                    });
                                } else {
                                    // We didn't start a transaction, just resolve
                                    resolve();
                                }
                            } catch (processError) {
                                logger.error('Error processing trends:', processError);
                                
                                // Only rollback if we started a transaction ourselves
                                if (startedTransaction) {
                                    try {
                                        this.db.run('ROLLBACK', (rollbackErr) => {
                                            if (rollbackErr) {
                                                logger.error('Error rolling back transaction:', rollbackErr);
                                            }
                                            reject(processError);
                                        });
                                    } catch (rollbackErr) {
                                        logger.error('Exception during rollback:', rollbackErr);
                                        reject(processError);
                                    }
                                } else {
                                    reject(processError);
                                }
                            }
                        };

                        // Only start a transaction if we're not already in one
                        if (!inTransaction) {
                            try {
                                // Try to begin a transaction only if not already in one
                                this.db.run('BEGIN TRANSACTION', (err) => {
                                    if (err) {
                                        logger.error('Error beginning transaction:', err);
                                        reject(err);
                                    } else {
                                        processTrends(true);
                                    }
                                });
                            } catch (error) {
                                logger.error('Exception starting transaction:', error);
                                reject(error);
                            }
                        } else {
                            // Already in a transaction, just process the trends
                            processTrends(false);
                        }
                    } catch (error) {
                        logger.error('Error in updateMarketTrends:', error);
                        reject(error);
                    }
                })
                .catch(err => {
                    logger.error('Error getting history for market trends:', err);
                    reject(err);
                });
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                logger.error('Error closing database:', err);
            } else {
                logger.info('Database connection closed');
            }
        });
    }
}

module.exports = new Database(); 