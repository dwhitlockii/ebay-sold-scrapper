const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { rateLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');
const { db } = require('../database');

// Array of rotating user agents
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/92.0.902.73',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15'
];

// Search endpoint
router.post('/', rateLimiter, async (req, res) => {
    const query = req.body.query;
    
    logger.debug('Search request received', { query });

    if (!query) {
        logger.warn('Search request missing query parameter');
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        // Construct eBay URL
        const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
        logger.debug('Constructed eBay URL', { url: ebayUrl });

        // Get a random user agent
        const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        logger.debug('Selected user agent', { userAgent });

        // Make request to eBay
        logger.debug('Making request to eBay');
        const response = await axios.get(ebayUrl, {
            headers: {
                'User-Agent': userAgent
            }
        });

        logger.debug('Received response from eBay', {
            status: response.status,
            contentLength: response.data.length
        });

        // Parse HTML with cheerio
        logger.debug('Parsing HTML response');
        const $ = cheerio.load(response.data);
        const items = [];
        let validItemCount = 0;

        // Find all search result items
        $('.s-item').each((i, element) => {
            // Skip the first element as it's usually a template
            if (i === 0) return;

            try {
                const title = $(element).find('.s-item__title').text().trim();
                const priceText = $(element).find('.s-item__price').text().trim();
                const soldDateText = $(element).find('.s-item__title--tag').text().trim();
                const condition = $(element).find('.SECONDARY_INFO').text().trim();
                const link = $(element).find('a.s-item__link').attr('href');
                const imageUrl = $(element).find('.s-item__image-img').attr('src');

                // Extract the numeric price
                const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

                // Parse the sold date
                const soldDate = new Date();
                if (soldDateText.includes('Sold')) {
                    const dateMatch = soldDateText.match(/Sold\s+([A-Za-z]+)\s+(\d+)/);
                    if (dateMatch) {
                        const month = dateMatch[1];
                        const day = parseInt(dateMatch[2]);
                        soldDate.setMonth(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month));
                        soldDate.setDate(day);
                    }
                }

                // Only add items with valid prices
                if (!isNaN(price)) {
                    validItemCount++;
                    logger.debug('Found valid item', {
                        itemNumber: validItemCount,
                        title: title.substring(0, 50),
                        price,
                        soldDate: soldDate.toISOString()
                    });

                    items.push({
                        title,
                        link,
                        image: imageUrl,
                        soldPrice: price,
                        soldDate,
                        condition,
                        soldDateText
                    });
                }
            } catch (error) {
                logger.warn('Error parsing item', {
                    itemIndex: i,
                    error: error.message
                });
            }
        });

        // If no items were found
        if (items.length === 0) {
            logger.warn('No items found for query', { query });
            return res.status(404).json({
                error: "No sold items found for your search query."
            });
        }

        // Calculate statistics
        logger.debug('Calculating statistics');
        const prices = items.map(item => item.soldPrice);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const highPrice = Math.max(...prices);
        const lowPrice = Math.min(...prices);

        // Save results to database
        logger.debug('Saving results to database', {
            itemCount: items.length,
            avgPrice,
            highPrice,
            lowPrice
        });

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
            avgPrice,
            highPrice,
            lowPrice,
            items.length
        );

        logger.info('Search completed successfully', {
            query,
            itemsFound: items.length,
            avgPrice: avgPrice.toFixed(2),
            searchId
        });

        // Return results
        res.json({
            success: true,
            items,
            stats: {
                totalItems: items.length,
                avgPrice,
                highPrice,
                lowPrice
            }
        });

    } catch (error) {
        logger.error('Search error', {
            query,
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            error: 'An error occurred while searching. Please try again.'
        });
    }
});

// Historical data endpoint
router.get('/history/:query', rateLimiter, async (req, res) => {
    const query = req.params.query;
    
    logger.debug('Historical data request received', { query });

    try {
        logger.debug('Querying database for historical data');
        const results = db.prepare(`
            SELECT 
                ebay_prices.timestamp, 
                ebay_prices.avg_price, 
                ebay_prices.high_price, 
                ebay_prices.low_price, 
                ebay_prices.total_sales
            FROM ebay_prices
            JOIN searches ON ebay_prices.search_id = searches.id
            WHERE searches.query = ?
            ORDER BY ebay_prices.timestamp DESC
        `).all(query);

        logger.debug('Historical data retrieved', {
            query,
            recordCount: results.length
        });

        if (results.length === 0) {
            logger.warn('No historical data found', { query });
            return res.status(404).json({
                success: false,
                error: 'No historical data found for this search query.'
            });
        }

        logger.info('Historical data request completed', {
            query,
            recordCount: results.length
        });

        res.json({
            success: true,
            data: results
        });

    } catch (error) {
        logger.error('Historical data error', {
            query,
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching historical data.'
        });
    }
});

module.exports = router; 