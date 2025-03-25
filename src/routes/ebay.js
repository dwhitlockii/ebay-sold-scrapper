const express = require('express');
const router = express.Router();
const { logger } = require('../../utils/logger');
const database = require('../database');
const ebayScraper = require('../services/ebayScraper');

// Get eBay sold items
router.get('/sold/:query', async (req, res) => {
    try {
        const { query } = req.params;
        logger.info(`Fetching sold items for query: ${query}`);

        // Validate query
        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                error: 'Search query is required'
            });
        }

        // Fetch items from eBay with timeout
        let items;
        try {
            items = await Promise.race([
                ebayScraper.fetchSoldItems(query),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 30000)
                )
            ]);
        } catch (fetchError) {
            logger.error('Error fetching items from eBay:', fetchError);

            // Try to get items from database as fallback
            try {
                const sql = `
                    SELECT * FROM ebay_sold_items
                    WHERE query = ?
                    ORDER BY sold_date DESC
                    LIMIT 50
                `;

                const dbItems = await new Promise((resolve, reject) => {
                    database.db.all(sql, [query], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                if (dbItems && dbItems.length > 0) {
                    logger.info(`Returning ${dbItems.length} cached items from database`);

                    // Format the items to match the expected structure
                    items = dbItems.map(item => ({
                        itemId: item.item_id,
                        title: item.title,
                        price: parseFloat(item.price),
                        soldDate: item.sold_date,
                        sellerId: item.seller_id,
                        url: `https://www.ebay.com/itm/${item.item_id}`
                    }));
                } else {
                    // No cached items, re-throw the original error
                    throw fetchError;
                }
            } catch (dbError) {
                logger.error('Error fetching cached items:', dbError);
                throw fetchError; // Re-throw the original error
            }
        }

        if (!items || items.length === 0) {
            return res.status(404).json({
                error: 'No sold items found for this query'
            });
        }

        // Calculate aggregates for the items
        const aggregates = {
            avgPrice: items.reduce((sum, item) => sum + item.price, 0) / items.length,
            highPrice: Math.max(...items.map(item => item.price)),
            lowPrice: Math.min(...items.map(item => item.price)),
            totalSales: items.length
        };

        // Save items to database (don't wait for this to complete)
        database.saveEbayResults(query, { items, aggregates })
            .catch(saveError => {
                logger.error('Error saving items to database:', saveError);
                // Continue execution even if save fails
            });

        // Get analytics (with a timeout)
        let analytics;
        try {
            analytics = await Promise.race([
                database.getAnalytics(query),
                new Promise((resolve) => setTimeout(() => resolve(null), 5000))
            ]);
        } catch (analyticsError) {
            logger.error('Error fetching analytics:', analyticsError);
            analytics = null; // Continue without analytics
        }

        res.json({
            items,
            analytics,
            total: items.length
        });
    } catch (error) {
        logger.error('Error fetching eBay sold items:', error);
        res.status(500).json({
            error: 'Failed to fetch eBay sold items',
            message: error.message
        });
    }
});

// Get eBay item details
router.get('/item/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const sql = `
            SELECT *
            FROM ebay_sold_items
            WHERE item_id = ?
        `;

        // Use a promise-based approach for consistency
        new Promise((resolve, reject) => {
            database.db.get(sql, [itemId], (err, item) => {
                if (err) {
                    logger.error('Error fetching item details:', err);
                    reject(err);
                } else {
                    resolve(item);
                }
            });
        })
        .then(item => {
            if (!item) {
                return res.status(404).json({
                    error: 'Item not found'
                });
            }
            res.json(item);
        })
        .catch(err => {
            logger.error('Database error:', err);
            res.status(500).json({
                error: 'Failed to fetch item details'
            });
        });
    } catch (error) {
        logger.error('Error fetching eBay item details:', error);
        res.status(500).json({
            error: 'Failed to fetch item details'
        });
    }
});

module.exports = router; 