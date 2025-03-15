const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../utils/logger');

// Array of rotating user agents for scraping
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/92.0.902.73',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36'
];

// Get a random user agent
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Search eBay for sold items
async function searchEbay(query) {
    try {
        // Construct eBay URL
        const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
        logger.debug('Constructed eBay URL', { url: ebayUrl });

        // Get a random user agent
        const userAgent = getRandomUserAgent();
        logger.debug('Selected user agent', { userAgent });

        // Make request to eBay
        logger.debug('Making request to eBay');
        const response = await axios.get(ebayUrl, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 10000 // 10 second timeout
        });

        logger.debug('Received response from eBay', {
            status: response.status,
            contentLength: response.data.length
        });

        return response.data;
    } catch (error) {
        logger.error('Error searching eBay:', error);
        throw new Error('Failed to search eBay');
    }
}

// Parse eBay search results HTML
async function parseEbayResults(html) {
    try {
        const $ = cheerio.load(html);
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
                const itemId = extractItemId(link);

                // Extract the numeric price
                const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

                // Parse the sold date
                const soldDate = parseSoldDate(soldDateText);

                // Only add items with valid prices and dates
                if (!isNaN(price) && soldDate) {
                    validItemCount++;
                    logger.debug('Found valid item', {
                        itemNumber: validItemCount,
                        title: title.substring(0, 50),
                        price,
                        soldDate: soldDate.toISOString()
                    });

                    items.push({
                        itemId,
                        title,
                        link,
                        image: imageUrl,
                        price,
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

        if (items.length === 0) {
            logger.warn('No valid items found in search results');
            throw new Error('No sold items found');
        }

        return items;
    } catch (error) {
        logger.error('Error parsing eBay results:', error);
        throw new Error('Failed to parse eBay results');
    }
}

// Helper function to parse sold date from text
function parseSoldDate(soldDateText) {
    try {
        if (!soldDateText.includes('Sold')) {
            return null;
        }

        const dateMatch = soldDateText.match(/Sold\s+([A-Za-z]+)\s+(\d+)/);
        if (!dateMatch) {
            return null;
        }

        const month = dateMatch[1];
        const day = parseInt(dateMatch[2]);
        const date = new Date();

        const monthIndex = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ].indexOf(month.substring(0, 3));

        if (monthIndex === -1) {
            return null;
        }

        date.setMonth(monthIndex);
        date.setDate(day);

        // If the date is in the future, subtract a year
        if (date > new Date()) {
            date.setFullYear(date.getFullYear() - 1);
        }

        return date;
    } catch (error) {
        logger.warn('Error parsing sold date:', error);
        return null;
    }
}

// Helper function to extract item ID from URL
function extractItemId(url) {
    try {
        if (!url) return null;
        
        const match = url.match(/itm\/(\d+)/);
        return match ? match[1] : null;
    } catch (error) {
        logger.warn('Error extracting item ID:', error);
        return null;
    }
}

module.exports = {
    searchEbay,
    parseEbayResults
}; 