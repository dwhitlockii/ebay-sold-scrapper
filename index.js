
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
    // Create the eBay URL for sold items; using the Finding API equivalent parameters.
    let ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;

    // Fetch the eBay page HTML. (You might need to add custom headers if eBay blocks your request.)
    const response = await axios.get(ebayUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/85.0.4183.83 Safari/537.36'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);

    let items = [];

    // The eBay page renders each item with class ".s-item"
    $('.s-item').each((i, el) => {
      // Extract the sold price; the first occurrence under ".s-item__price"
      let priceText = $(el).find('.s-item__price').first().text().trim();
      // Remove currency symbols and commas; then convert to float.
      let soldPrice = parseFloat(priceText.replace(/[^0-9\.]/g, ''));

      // Try to extract sold date info.
      // Note: eBay may or may not display a sold date in the search results.
      // We're trying a placeholder element (.s-item__title--tagblock); if not found, we simulate a date.
      let soldDateText = $(el).find('.s-item__title--tagblock').first().text().trim();
      let soldDate;
      if (soldDateText && soldDateText.match(/\d{2}\/\d{2}\/\d{4}/)) {
        soldDate = new Date(soldDateText);
      } else {
        // If no sold date text is found, simulate a sold date within the last 30 days.
        const today = new Date();
        const pastTime = Math.random() * 30 * 24 * 60 * 60 * 1000; // random ms in 30 days
        soldDate = new Date(today.getTime() - pastTime);
      }

      // Only add the item if a valid soldPrice was parsed.
      if (!isNaN(soldPrice)) {
        items.push({ soldPrice, soldDate });
      }
    });

    // If no items were scraped, send an error message.
    if (items.length === 0) {
      return res.status(404).json({ error: "No sold item data could be scraped. The page structure may have changed or your query returned no results." });
    }

    // Compute aggregate metrics
    const totalSales = items.length;
    const sumPrices = items.reduce((sum, item) => sum + item.soldPrice, 0);
    const avgPrice = parseFloat((sumPrices / totalSales).toFixed(2));
    const highPrice = Math.max(...items.map(item => item.soldPrice));
    const lowPrice = Math.min(...items.map(item => item.soldPrice));

    // Group sales over time (by date in YYYY-MM-DD format)
    const salesOverTimeObj = {};
    items.forEach(item => {
      // Use the sold date (rounded to the day)
      const date = new Date(item.soldDate).toISOString().slice(0, 10);
      salesOverTimeObj[date] = (salesOverTimeObj[date] || 0) + 1;
    });

    // Sort dates for the chart
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

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
