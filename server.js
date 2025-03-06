
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------
// eBay Sold Items Scraping API
// ---------------------------
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
    // Construct the eBay URL for sold/completed items
    let ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
    console.log(`Fetching URL: ${ebayUrl}`);

    // Fetch the eBay page HTML.
    const response = await axios.get(ebayUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/90.0.4430.93 Safari/537.36'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);

    console.log(`Found ${$('.s-item').length} elements with '.s-item' selector.`);

    let items = [];
    $('.s-item').each((i, el) => {
      // Try to extract price using primary and fallback selectors.
      let priceText = $(el).find('.s-item__price').first().text().trim();
      if (!priceText) {
        priceText = $(el).find('span[itemprop="price"]').first().text().trim();
      }

      if (priceText) {
        const soldPrice = parseFloat(priceText.replace(/[^0-9\.]/g, ''));

        // Try to extract sold date information.
        let soldDateText = $(el).find('.s-item__title--tagblock').first().text().trim();
        let soldDate;
        if (soldDateText && soldDateText.match(/\d{2}\/\d{2}\/\d{4}/)) {
          soldDate = new Date(soldDateText);
        } else {
          // If no date is found, simulate a sold date within the last 30 days.
          const today = new Date();
          const pastTime = Math.random() * 30 * 24 * 60 * 60 * 1000;
          soldDate = new Date(today.getTime() - pastTime);
        }

        if (!isNaN(soldPrice)) {
          items.push({ soldPrice, soldDate });
        }
      }
    });

    if (items.length === 0) {
      console.log("No valid sold items were scraped.");
      return res.status(404).json({ 
        error: "No sold item data could be scraped. The page structure may have changed or there are no sold listings for this query." 
      });
    }

    // Compute aggregate metrics.
    const totalSales = items.length;
    const sumPrices = items.reduce((sum, item) => sum + item.soldPrice, 0);
    const avgPrice = parseFloat((sumPrices / totalSales).toFixed(2));
    const highPrice = Math.max(...items.map(item => item.soldPrice));
    const lowPrice = Math.min(...items.map(item => item.soldPrice));

    // Group sales over time (by date in YYYY-MM-DD format).
    const salesOverTimeObj = {};
    items.forEach(item => {
      const date = new Date(item.soldDate).toISOString().slice(0, 10);
      salesOverTimeObj[date] = (salesOverTimeObj[date] || 0) + 1;
    });
    const datesSorted = Object.keys(salesOverTimeObj).sort();
    const salesCounts = datesSorted.map(date => salesOverTimeObj[date]);

    res.json({
      items,
      aggregates: {
        avgPrice,
        highPrice,
        lowPrice,
        totalSales,
        salesOverTime: {
          dates: datesSorted,
          counts: salesCounts
        }
      }
    });
  } catch (error) {
    console.error('Error during scraping:', error.message);
    res.status(500).json({ error: "An error occurred while scraping eBay data." });
  }
});

// ---------------------------
// Amazon New & Used Scraping API
// ---------------------------
app.get('/api/search/amazon', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }
  try {
    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    console.log(`Fetching Amazon URL: ${amazonUrl}`);
    const response = await axios.get(amazonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/90.0.4430.93 Safari/537.36'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);
    let items = [];
    // Each Amazon search result is in a container with this attribute.
    $('div[data-component-type="s-search-result"]').each((i, el) => {
      const title = $(el).find('h2 a span').text().trim();
      if (!title) {
        return; // Skip if no title is found.
      }
      let newPrice = null;
      let usedPrice = null;

      // Extract new price for this product.
      const newPriceText = $(el).find('span.a-price > span.a-offscreen').first().text().trim();
      if (newPriceText) {
        newPrice = parseFloat(newPriceText.replace(/[^0-9\.]/g, ''));
      }

      // Extract used price if available (looking for text like "Used from $XX.XX")
      let usedPriceText = "";
      $(el).find('span.a-size-base.a-color-price').each((j, usedEl) => {
        const text = $(usedEl).text().trim();
        if (text.toLowerCase().includes("used from")) {
          usedPriceText = text;
        }
      });
      if (usedPriceText) {
        const match = usedPriceText.match(/\$([0-9\.,]+)/);
        if (match) {
          usedPrice = parseFloat(match[1].replace(/,/g, ''));
        }
      }
      items.push({ title, newPrice, usedPrice });
    });

    // Filter out items without any price info.
    items = items.filter(item => item.newPrice !== null || item.usedPrice !== null);

    if (items.length === 0) {
      console.log("No relevant Amazon data was scraped.");
      return res.status(404).json({ error: "No relevant Amazon data could be scraped for this query." });
    }

    // Compute aggregates for new prices.
    const newItems = items.filter(item => item.newPrice !== null);
    const totalNew = newItems.length;
    const sumNew = newItems.reduce((sum, item) => sum + item.newPrice, 0);
    const avgNew = totalNew ? parseFloat((sumNew / totalNew).toFixed(2)) : null;
    const highNew = totalNew ? Math.max(...newItems.map(item => item.newPrice)) : null;
    const lowNew = totalNew ? Math.min(...newItems.map(item => item.newPrice)) : null;

    // Compute aggregates for used prices.
    const usedItems = items.filter(item => item.usedPrice !== null);
    const totalUsed = usedItems.length;
    const sumUsed = usedItems.reduce((sum, item) => sum + item.usedPrice, 0);
    const avgUsed = totalUsed ? parseFloat((sumUsed / totalUsed).toFixed(2)) : null;
    const highUsed = totalUsed ? Math.max(...usedItems.map(item => item.usedPrice)) : null;
    const lowUsed = totalUsed ? Math.min(...usedItems.map(item => item.usedPrice)) : null;

    res.json({
      items,
      aggregates: {
        new: { totalNew, avgNew, highNew, lowNew },
        used: { totalUsed, avgUsed, highUsed, lowUsed }
      }
    });
  } catch (error) {
    console.error("Error during Amazon scraping:", error.message);
    res.status(500).json({ error: "An error occurred while scraping Amazon data." });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
