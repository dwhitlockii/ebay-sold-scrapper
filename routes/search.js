const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { searchEbay, parseEbayResults } = require('../services/ebay');
const { cache } = require('../utils/cache');
const { handleError } = require('../utils/errorHandler');

// Validation middleware
const validateSearch = [
    body('query').trim().notEmpty().withMessage('Search query is required')
        .isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters')
        .escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Search eBay sold items
router.post('/', validateSearch, async (req, res) => {
    try {
        const { query } = req.body;
        logger.info('Processing search request', { query });

        // Create the eBay URL for sold items
        const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;

        // Fetch the eBay page
        const response = await axios.get(ebayUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const items = [];

        // Extract sold items data
        $('.s-item').each((i, el) => {
            // Skip the first element as it's usually a template
            if (i === 0) return;

            const $item = $(el);
            const title = $item.find('.s-item__title').text().trim();
            const priceText = $item.find('.s-item__price').text().trim();
            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            const link = $item.find('.s-item__link').attr('href');
            const imageUrl = $item.find('.s-item__image-img').attr('src');
            const soldDate = $item.find('.s-item__title--tag').text().trim();

            if (!isNaN(price) && title && link) {
                items.push({
                    title,
                    price,
                    link,
                    imageUrl,
                    soldDate
                });
            }
        });

        if (items.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No sold items found for this search query'
            });
        }

        // Calculate statistics
        const prices = items.map(item => item.price);
        const stats = {
            count: items.length,
            average: prices.reduce((a, b) => a + b, 0) / prices.length,
            min: Math.min(...prices),
            max: Math.max(...prices),
            median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
        };

        // Save search results to database
        const searchId = await db.saveEbayResults(query, {
            aggregates: {
                avgPrice: stats.average,
                highPrice: stats.max,
                lowPrice: stats.min,
                totalSales: stats.count
            }
        });

        logger.info('Search completed successfully', {
            query,
            itemsFound: items.length,
            searchId
        });

        res.json({
            success: true,
            searchId,
            items,
            stats
        });

    } catch (error) {
        logger.error('Search error:', error);
        handleError(error, res);
    }
});

// Get search history
router.get('/history/:query?', async (req, res) => {
    try {
        // Get query from either path parameter or query parameter
        const query = req.params.query || req.query.query || '';
        logger.info('Fetching search history', { query });
        
        const history = await db.getEbayHistory(query);
        res.json({
            success: true,
            history
        });
    } catch (error) {
        logger.error('Error fetching search history:', error);
        handleError(error, res);
    }
});

// Get trending searches
router.get('/trending', async (req, res) => {
    try {
        const { period = '24h', limit = 10 } = req.query;
        
        // Get the most frequent searches in the last period
        const sql = `
            SELECT query, COUNT(*) as count
            FROM searches
            WHERE timestamp > datetime('now', '-1 day')
            GROUP BY query
            ORDER BY count DESC
            LIMIT ?
        `;
        
        const trending = await db.all(sql, [parseInt(limit)]);

        res.json({
            success: true,
            trending
        });
    } catch (error) {
        logger.error('Error fetching trending searches:', error);
        handleError(error, res);
    }
});

// Get related searches
router.get('/related', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        // Find searches that contain similar words
        const sql = `
            SELECT DISTINCT query
            FROM searches
            WHERE query LIKE ?
            AND query != ?
            ORDER BY timestamp DESC
            LIMIT 5
        `;
        
        const related = await db.all(sql, [`%${query}%`, query]);

        res.json({
            success: true,
            related
        });
    } catch (error) {
        logger.error('Error fetching related searches:', error);
        handleError(error, res);
    }
});

// Helper function to calculate statistics from search results
function calculateStats(results) {
    if (!results || results.length === 0) {
        return {
            averagePrice: 0,
            highestPrice: 0,
            lowestPrice: 0,
            totalSales: 0,
            itemCount: 0
        };
    }

    const prices = results.map(item => parseFloat(item.price));
    
    return {
        averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        highestPrice: Math.max(...prices),
        lowestPrice: Math.min(...prices),
        totalSales: prices.reduce((a, b) => a + b, 0),
        itemCount: results.length
    };
}

module.exports = router; 