const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../../utils/logger');

class EbayScraper {
    constructor() {
        this.baseUrl = 'https://www.ebay.com/sch/i.html';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        };
        
        // Define possible selectors for sold date
        this.possibleSelectors = [
            '.s-item__title--tag',
            '.s-item__title--tagblock',
            '.s-item__detail--secondary',
            '.s-item__detail--secondary span',
            '.s-item__detail--secondary .s-item__title--tag',
            '.s-item__detail--secondary .s-item__title--tagblock',
            '.s-item__detail--secondary .s-item__detail--secondary',
            '.s-item__detail--secondary .s-item__detail--secondary span',
            '.s-item__detail--secondary .s-item__detail--secondary .s-item__title--tag',
            '.s-item__detail--secondary .s-item__detail--secondary .s-item__title--tagblock'
        ];

        // Define date patterns for regex matching
        this.datePatterns = [
            /Sold\s+([A-Za-z]+\s+\d+)/i,
            /Ended\s+([A-Za-z]+\s+\d+)/i,
            /Completed\s+([A-Za-z]+\s+\d+)/i,
            /([A-Za-z]+\s+\d+)\s+Sold/i,
            /([A-Za-z]+\s+\d+)\s+Ended/i,
            /([A-Za-z]+\s+\d+)\s+Completed/i,
            /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
            /(\d{1,2}-\d{1,2}-\d{2,4})/,
            /(\d{1,2}\.\d{1,2}\.\d{2,4})/,
            /(\d{4}-\d{1,2}-\d{1,2})/
        ];
    }

    async fetchSoldItems(query) {
        const maxRetries = 3;
        let retryCount = 0;
        let lastError = null;

        while (retryCount < maxRetries) {
            try {
                // Remove exact matching quotes and add more flexible search parameters
                const url = `${this.baseUrl}?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_Complete=1&LH_Sold=1&_ipg=240&_sop=12&_stpos=0&_fss=1&_fsradio=%26LH_SpecificSeller%3D1&_saslop=1&_sasl=`;
                logger.info(`Fetching eBay data from: ${url} (Attempt ${retryCount + 1}/${maxRetries})`);

                // Add a delay before making the request (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));

                let response;
                try {
                    response = await axios.get(url, {
                        headers: this.headers,
                        timeout: 10000,
                        validateStatus: function (status) {
                            return status >= 200 && status < 500;
                        }
                    });
                } catch (axiosError) {
                    logger.error('Axios request failed:', {
                        message: axiosError.message,
                        code: axiosError.code,
                        stack: axiosError.stack
                    });
                    throw new Error(`Failed to fetch data from eBay: ${axiosError.message}`);
                }

                // Log response details for debugging
                logger.debug('Response details:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    dataLength: response.data?.length,
                    hasData: !!response.data
                });

                // Check for various error conditions
                if (response.status !== 200) {
                    logger.error(`eBay returned non-200 status code: ${response.status}`, {
                        statusText: response.statusText,
                        headers: response.headers
                    });
                    throw new Error(`eBay returned status code: ${response.status}`);
                }

                // Check for empty response
                if (!response.data || response.data.trim().length === 0) {
                    logger.error('Empty response received from eBay');
                    throw new Error('Empty response received from eBay');
                }

                const $ = cheerio.load(response.data);

                // Enhanced security check with detailed logging
                const securityChecks = [
                    { check: $('title').text().includes('Robot Check'), name: 'Robot Check' },
                    { check: $('title').text().includes('Security Measure'), name: 'Security Measure' },
                    { check: $('title').text().includes('Access Denied'), name: 'Access Denied' },
                    { check: $('title').text().includes('Blocked'), name: 'Blocked' },
                    { check: $('.srp-results').length === 0, name: 'No Results' },
                    { check: $('.captcha').length > 0, name: 'Captcha' },
                    { check: $('.security-check').length > 0, name: 'Security Check' }
                ];

                const failedChecks = securityChecks.filter(check => check.check);
                if (failedChecks.length > 0) {
                    logger.error('eBay security measures detected', {
                        failedChecks: failedChecks.map(check => check.name),
                        title: $('title').text(),
                        hasResults: $('.srp-results').length > 0,
                        hasItems: $('.s-item').length > 0
                    });
                    throw new Error(`eBay security measures detected: ${failedChecks.map(check => check.name).join(', ')}`);
                }

                // Log the HTML structure for debugging
                logger.debug('HTML Structure:', {
                    hasResults: $('.srp-results').length > 0,
                    hasItems: $('.s-item').length > 0,
                    title: $('title').text(),
                    html: response.data
                });

                // Log the first item's HTML for debugging
                const firstItem = $('.s-item').first();
                logger.debug('First item HTML:', firstItem.html());

                // Process items
                const items = [];
                $('.s-item').each((index, element) => {
                    try {
                        const $item = $(element);
                        
                        // Skip the first item as it's usually a template
                        if (index === 0) return;

                        // Extract and validate title
                        const title = $item.find('.s-item__title').text()
                            .replace('New Listing', '')
                            .replace('Sold', '')
                            .trim();
                        
                        if (!title) {
                            logger.warn('Skipping item: No title found', {
                                itemIndex: index,
                                html: $item.html()
                            });
                            return;
                        }

                        // Extract and validate price
                        const priceText = $item.find('.s-item__price').text()
                            .replace(/[^0-9.]/g, '');
                        const price = parseFloat(priceText);
                        
                        if (isNaN(price) || price <= 0) {
                            logger.warn(`Skipping item: Invalid price ${priceText}`, {
                                itemIndex: index,
                                title: title,
                                html: $item.html()
                            });
                            return;
                        }

                        // Extract and validate item URL and ID
                        const itemUrl = $item.find('.s-item__link').attr('href');
                        if (!itemUrl) {
                            logger.warn('Skipping item: No URL found', {
                                itemIndex: index,
                                title: title,
                                html: $item.html()
                            });
                            return;
                        }
                        
                        const itemId = this.extractItemId(itemUrl);
                        if (!itemId) {
                            logger.warn('Skipping item: No item ID found', {
                                itemIndex: index,
                                title: title,
                                url: itemUrl,
                                html: $item.html()
                            });
                            return;
                        }

                        // Extract sold date with enhanced validation
                        let soldDateText = null;
                        let soldDate = null;

                        // Try all possible selectors for sold date
                        for (const selector of this.possibleSelectors) {
                            const element = $item.find(selector)
                                .filter((i, el) => {
                                    const text = $(el).text().toLowerCase();
                                    return text.includes('sold') || 
                                           text.includes('ended') || 
                                           text.includes('completed') ||
                                           text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
                                })
                                .first();

                            if (element.length > 0) {
                                soldDateText = element.text()
                                    .replace(/Sold|Ended|Completed/i, '')
                                    .replace('Item', '')
                                    .replace('on', '')
                                    .replace(/^[^A-Za-z0-9]+/, '')
                                    .replace(/[^A-Za-z0-9]+$/, '')
                                    .trim();
                                
                                soldDate = this.parseSoldDate(soldDateText);
                                if (soldDate && !isNaN(soldDate.getTime())) {
                                    break;
                                }
                            }
                        }

                        // If still no valid date, try pattern matching
                        if (!soldDate || isNaN(soldDate.getTime())) {
                            const allText = $item.text();
                            for (const pattern of this.datePatterns) {
                                const match = allText.match(pattern);
                                if (match) {
                                    soldDateText = match[1] || match[0];
                                    soldDate = this.parseSoldDate(soldDateText);
                                    if (soldDate && !isNaN(soldDate.getTime())) {
                                        break;
                                    }
                                }
                            }
                        }

                        // If no valid sold date, use current date but log a warning
                        if (!soldDate || isNaN(soldDate.getTime())) {
                            logger.warn('No valid sold date found, using current date', {
                                itemIndex: index,
                                title: title,
                                price: price,
                                url: itemUrl
                            });
                            soldDate = new Date(); // Use current date as fallback
                        }

                        // Extract seller ID with validation
                        const sellerId = this.extractSellerId(itemUrl);

                        items.push({
                            itemId,
                            title,
                            price,
                            soldDate: soldDate.toISOString(),
                            sellerId,
                            url: itemUrl
                        });
                    } catch (error) {
                        logger.error(`Error parsing item: ${error.message}`, {
                            itemIndex: index,
                            error: error.stack,
                            html: $item.html()
                        });
                    }
                });

                // Validate results
                if (items.length === 0) {
                    logger.warn('No valid items found in the response', {
                        html: response.data,
                        hasResults: $('.srp-results').length > 0,
                        hasItems: $('.s-item').length > 0,
                        title: $('title').text()
                    });
                    return [];
                }

                logger.info(`Successfully scraped ${items.length} items for query: ${query}`);
                return items;

            } catch (error) {
                lastError = error;
                retryCount++;
                logger.warn(`Attempt ${retryCount} failed: ${error.message}`, {
                    error: error.stack,
                    retryCount,
                    maxRetries
                });
                
                if (retryCount < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    logger.info(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // If all retries failed, throw the last error
        logger.error(`All ${maxRetries} attempts failed`, {
            lastError: lastError?.message,
            stack: lastError?.stack,
            query
        });
        throw lastError;
    }

    extractItemId(url) {
        try {
            if (!url) return null;

            // Try multiple patterns for item ID extraction
            const patterns = [
                /itm\/(\d+)/,                // Standard pattern
                /\/(\d{12})\?/,              // 12-digit ID with query parameter
                /\/(\d{12})$/,               // 12-digit ID at end of URL
                /item=(\d+)/,                // item parameter
                /ItemId=(\d+)/i,             // ItemId parameter
                /\/(\d{9,12})(?:[/?#]|$)/    // Any 9-12 digit number in URL path
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }

            // If no match found, generate a unique ID based on the URL
            if (url.length > 0) {
                return 'gen-' + this.hashString(url).toString();
            }

            return null;
        } catch (error) {
            logger.error('Error extracting item ID:', error);
            return null;
        }
    }

    // Simple hash function for generating IDs
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    extractSellerId(url) {
        try {
            if (!url) return 'unknown';

            // Try multiple patterns for seller ID extraction
            const patterns = [
                /usr\/([^?/]+)/,             // Standard pattern
                /seller=([^&]+)/,            // seller parameter
                /seller\/([^?/]+)/,          // seller path
                /shop\/([^?/]+)/,            // shop path
                /stores\/([^?/]+)/           // stores path
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return decodeURIComponent(match[1]).replace(/\+/g, ' ');
                }
            }

            return 'unknown';
        } catch (error) {
            logger.error('Error extracting seller ID:', error);
            return 'unknown';
        }
    }

    parseSoldDate(dateText) {
        try {
            if (!dateText) {
                logger.warn('Empty date text received');
                return null;
            }

            const now = new Date();
            dateText = dateText.toLowerCase().trim();

            // Handle "X days ago" format
            if (dateText.includes('ago')) {
                const days = parseInt(dateText.match(/\d+/)?.[0] || '0');
                const date = new Date();
                date.setDate(date.getDate() - days);
                return date;
            }

            // Handle "X hours ago" format
            if (dateText.includes('hours')) {
                const hours = parseInt(dateText.match(/\d+/)?.[0] || '0');
                const date = new Date();
                date.setHours(date.getHours() - hours);
                return date;
            }

            // Handle "X minutes ago" format
            if (dateText.includes('minutes')) {
                const minutes = parseInt(dateText.match(/\d+/)?.[0] || '0');
                const date = new Date();
                date.setMinutes(date.getMinutes() - minutes);
                return date;
            }

            // Handle "Just now" format
            if (dateText.includes('just now')) {
                return new Date();
            }

            // Handle "Today" format
            if (dateText.includes('today')) {
                return new Date();
            }

            // Handle "Yesterday" format
            if (dateText.includes('yesterday')) {
                const date = new Date();
                date.setDate(date.getDate() - 1);
                return date;
            }

            // Handle "MMM DD, YYYY" format
            const parsedDate = new Date(dateText);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
            }

            // Try to parse date with various formats
            const formats = [
                /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY or MM/DD/YY
                /(\d{1,2})-(\d{1,2})-(\d{2,4})/, // MM-DD-YYYY or MM-DD-YY
                /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/, // MM.DD.YYYY or MM.DD.YY
                /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
                /(\d{4})\/(\d{1,2})\/(\d{1,2})/, // YYYY/MM/DD
                /(\d{4})\.(\d{1,2})\.(\d{1,2})/ // YYYY.MM.DD
            ];

            for (const format of formats) {
                const match = dateText.match(format);
                if (match) {
                    const [_, month, day, year] = match;
                    const fullYear = year.length === 2 ? (parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year)) : parseInt(year);
                    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }

            // Try to parse month names
            const monthMap = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
                'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
            };

            const monthMatch = dateText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i);
            if (monthMatch) {
                const month = monthMap[monthMatch[1].toLowerCase()];
                const dayMatch = dateText.match(/\b(\d{1,2})\b/);
                if (dayMatch) {
                    const day = parseInt(dayMatch[1]);
                    const yearMatch = dateText.match(/\b(20\d{2})\b/);
                    const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();
                    const date = new Date(year, month, day);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }

            // If all parsing attempts fail, return null instead of current date
            logger.warn(`Could not parse date: ${dateText}`);
            return null;
        } catch (error) {
            logger.warn(`Error parsing date: ${error.message}`);
            return null;
        }
    }
}

module.exports = new EbayScraper(); 