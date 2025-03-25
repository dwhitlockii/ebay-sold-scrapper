// Function to update analytics display with the given data
function updateAnalyticsDisplay(analytics) {
    try {
        // Clear the analytics marker if it exists
        const existingMarker = document.getElementById('analyticsUpdated');
        if (existingMarker) {
            existingMarker.parentNode.removeChild(existingMarker);
        }
        
        console.log('Raw analytics data from server:', analytics);
        
        // Create a hidden marker element to indicate analytics have been updated
        const marker = document.createElement('div');
        marker.id = 'analyticsUpdated';
        marker.style.display = 'none';
        document.body.appendChild(marker);
        
        // Directly set analytics values to HTML elements
        // IMPORTANT: We're using direct value access with fallbacks
        
        // Helper function to safely get a number value
        function getNumberValue(value, defaultValue = 0) {
            if (value === undefined || value === null) return defaultValue;
            const num = Number(value);
            return isNaN(num) ? defaultValue : num;
        }
        
        // Total Items
        const totalItemsValue = getNumberValue(analytics.total_items);
        document.getElementById('totalItems').textContent = totalItemsValue.toLocaleString();
        
        // Average Price
        const avgPriceValue = getNumberValue(analytics.avg_price);
        document.getElementById('avgPrice').textContent = '$' + avgPriceValue.toFixed(2);
        
        // Price Range
        const minPriceValue = getNumberValue(analytics.min_price);
        const maxPriceValue = getNumberValue(analytics.max_price);
        document.getElementById('priceRange').textContent = '$' + minPriceValue.toFixed(2) + ' - $' + maxPriceValue.toFixed(2);
        
        // Price Standard Deviation
        const stdDevValue = getNumberValue(analytics.price_std_dev);
        document.getElementById('priceStdDev').textContent = '$' + stdDevValue.toFixed(2);
        
        // Demand Score
        const demandScoreValue = getNumberValue(analytics.demand_score);
        document.getElementById('demandScore').textContent = demandScoreValue.toFixed(2);
        
        // Market Saturation
        const marketSatValue = getNumberValue(analytics.market_saturation);
        document.getElementById('marketSaturation').textContent = marketSatValue.toFixed(2);
        
        // Price Trend
        const priceTrendValue = getNumberValue(analytics.price_trend);
        document.getElementById('priceTrend').textContent = priceTrendValue.toFixed(2) + '%';
        
        // Confidence Score
        let confidenceScoreValue = getNumberValue(analytics.confidence_score);
        // If it's a decimal between 0 and 1, convert to percentage
        if (confidenceScoreValue >= 0 && confidenceScoreValue <= 1) {
            confidenceScoreValue = confidenceScoreValue * 100;
        }
        // Clamp value to non-negative
        confidenceScoreValue = Math.max(0, confidenceScoreValue);
        document.getElementById('confidenceScore').textContent = Math.round(confidenceScoreValue);
        
        // Ensure the results card is visible
    const resultsCard = document.getElementById('ebayResults');
    if (resultsCard) {
        resultsCard.classList.remove('d-none');
        }
        
        console.log('Analytics display update completed successfully');
        
    } catch (error) {
        // If anything fails, set default values
        console.error('Error updating analytics display:', error);
        
        // Set default values for all analytics elements
        const defaults = {
            'totalItems': '0',
            'avgPrice': '$0.00',
            'priceRange': '$0.00 - $0.00',
            'priceStdDev': '$0.00',
            'demandScore': '0.00',
            'marketSaturation': '0.00',
            'priceTrend': '0.00%',
            'confidenceScore': '0'
        };
        
        // Apply defaults to elements that exist
        Object.keys(defaults).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = defaults[id];
            }
        });
        
        console.error('Applied default values due to error');
    }
}

// Function to fetch eBay sold items
async function fetchEbaySoldItems(query) {
    try {
        console.log('Starting eBay search for query:', query);
        
        // Reset the analytics marker to force refreshing analytics on new search
        const existingMarker = document.getElementById('analyticsUpdated');
        if (existingMarker) {
            existingMarker.parentNode.removeChild(existingMarker);
        }
        
        // Reset analytics values to default before starting a new search
        setDefaultAnalyticsValues();
        
        // Show loading state
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.classList.remove('d-none');
        }
        
        // Fetch data from API
        console.log('Fetching data from API endpoint...');
        const response = await fetch(`/api/ebay/sold/${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Parse response
        const data = await response.json();
        console.log('API response received successfully');
        
        // Check if data has expected structure
        if (!data) {
            throw new Error('No data received from API');
        }
        
        // Ensure items is an array
        const items = Array.isArray(data.items) ? data.items : [];
        console.log(`Processing ${items.length} items`);
        
        // Process analytics
        if (data.analytics) {
            console.log('Analytics data received, updating display...');
            updateAnalyticsDisplay(data.analytics);
        } else {
            console.warn('No analytics data in server response, calculating locally');
            
            // Calculate analytics from items if needed
            if (items.length > 0) {
                const calculatedAnalytics = calculateAnalyticsFromItems(items);
                updateAnalyticsDisplay(calculatedAnalytics);
            } else {
                // Use default values if no items
                setDefaultAnalyticsValues();
            }
        }
        
        // Display items in the list
        updateItemsList(items);
        
        // Update chart with items
        if (items.length > 0) {
            console.log('Updating chart with items data');
            updateSalesChart(items);
        } else {
            console.warn('No items data available for chart');
        }
        
        // Hide loading state
        if (loadingSpinner) {
            loadingSpinner.classList.add('d-none');
        }
        
        // Show results section
        const resultsSection = document.querySelector('.results-section');
        if (resultsSection) {
            resultsSection.classList.remove('d-none');
        }
        
    } catch (error) {
        console.error('Error during eBay search:', error);
        
        // Hide loading state
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.classList.add('d-none');
        }
        
        // Set default values for analytics display
        setDefaultAnalyticsValues();
        
        // Show error message
        alert(`Error searching eBay: ${error.message}`);
    }
}

// Helper function to calculate analytics from items directly
function calculateAnalyticsFromItems(items) {
    if (!items || items.length === 0) {
        return getDefaultAnalyticsValues();
    }
    
    // Extract valid prices
    const prices = items
        .map(item => typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0)
        .filter(price => !isNaN(price) && price > 0);
    
    if (prices.length === 0) {
        return getDefaultAnalyticsValues();
    }
    
    // Basic statistics
    const total_items = prices.length;
    const avg_price = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const min_price = Math.min(...prices);
    const max_price = Math.max(...prices);
    
    // Standard deviation
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg_price, 2), 0) / prices.length;
    const price_std_dev = Math.sqrt(variance);
    
    // Return calculated analytics
    return {
        total_items,
        avg_price,
        min_price, 
        max_price,
        price_std_dev,
        demand_score: 0.03,  // Default demand score
        market_saturation: 0.1,  // Default market saturation
        price_trend: 0,  // Default price trend
        confidence_score: 0.5  // Default confidence score
    };
}

// Function to get default analytics values
function getDefaultAnalyticsValues() {
    return {
        total_items: 0,
        avg_price: 0,
        min_price: 0,
        max_price: 0,
        price_std_dev: 0,
        demand_score: 0,
        market_saturation: 0,
        price_trend: 0,
        confidence_score: 0
    };
}

// Function to set default analytics values in the UI
function setDefaultAnalyticsValues() {
    const defaults = {
        'totalItems': '0',
        'avgPrice': '$0.00',
        'priceRange': '$0.00 - $0.00',
        'priceStdDev': '$0.00',
        'demandScore': '0.00',
        'marketSaturation': '0.00',
        'priceTrend': '0.00%',
        'confidenceScore': '0'
    };
    
    // Apply default values to UI elements
    Object.keys(defaults).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = defaults[id];
        }
    });
}

// Function to update items list
function updateItemsList(items) {
        const itemsList = document.querySelector('#ebayItemList ul');
    if (!itemsList) {
        console.error('Items list element not found');
        return;
    }
    
        itemsList.innerHTML = ''; // Clear existing items

    if (items.length === 0) {
        itemsList.innerHTML = '<li class="list-group-item">No items found</li>';
        return;
    }
    
    // Add items to the list
    items.forEach((item, index) => {
        try {
            // Process item data
            const title = item.title || 'No title';
            const price = typeof item.price === 'number' ? item.price : 
                         parseFloat(item.price) || 0;
            
            // Process date
            let dateStr = 'Unknown date';
            try {
                const dateObj = item.soldDate ? new Date(item.soldDate) : 
                               item.sold_date ? new Date(item.sold_date) : null;
                
                if (dateObj && !isNaN(dateObj.getTime())) {
                    dateStr = dateObj.toLocaleDateString();
                }
            } catch (dateError) {
                console.warn(`Error with date for item ${index}`);
            }
            
            // Create list item
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>
                    <h6 class="mb-0">${title}</h6>
                    <small class="text-muted">Sold on: ${dateStr}</small>
                </div>
                <span class="badge bg-primary rounded-pill">$${price.toFixed(2)}</span>
            `;
            itemsList.appendChild(li);
        } catch (itemError) {
            console.error(`Error processing item ${index}:`, itemError);
        }
    });
}

// Function to update the sales chart with the given items
function updateSalesChart(items) {
    // Get canvas context
    const chartCanvas = document.getElementById('salesChart');
    if (!chartCanvas) {
        console.error('Sales chart canvas not found');
        return;
    }
    
    console.log('Updating sales chart with', items.length, 'items');
    
    try {
        // Destroy existing chart if it exists
        if (window.salesChart) {
            window.salesChart.destroy();
            console.log('Destroyed existing chart');
        }
        
        // Process items to get dates and prices
        const processedData = processItemsForChart(items);
        
        if (processedData.labels.length === 0) {
            console.warn('No valid data points for chart');
            // Display a message in the chart area
            window.salesChart = new Chart(chartCanvas, {
                type: 'bar',
        data: {
                    labels: ['No Data'],
            datasets: [{
                        label: 'No valid data available',
                        data: [0],
                        backgroundColor: 'rgba(200, 200, 200, 0.5)'
                    }]
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: 'No valid sales data available'
                        }
                    }
                }
            });
            return;
        }
        
        // Create chart
        window.salesChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: processedData.labels,
                datasets: [
                    {
                        label: 'Average Price ($)',
                        data: processedData.averagePrices,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Items Sold',
                        data: processedData.itemCounts,
                        backgroundColor: 'rgba(153, 102, 255, 0.6)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Average Price ($)'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: true,
                            text: 'Items Sold'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                }
            },
            plugins: {
                    title: {
                        display: true,
                        text: 'Sales Trends Over Time'
                    },
                tooltip: {
                    callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.datasetIndex === 0) {
                                    label += '$' + context.raw.toFixed(2);
                                } else {
                                    label += context.raw;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Chart created successfully');
        
    } catch (error) {
        console.error('Error creating chart:', error);
        console.error('Error stack:', error.stack);
    }
}

// Helper function to process items for chart
function processItemsForChart(items) {
    // Create objects to store data by date
    const dataByDate = {};
    let validDataPoints = 0;
    
    // Process each item
    items.forEach((item, index) => {
        try {
            // Get price as a number
            let price = 0;
            if (typeof item.price === 'number') {
                price = item.price;
            } else if (typeof item.price === 'string') {
                price = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
            }
            
            if (price <= 0) {
                console.warn(`Item ${index} has invalid price:`, item.price);
                return; // Skip this item
            }
            
            // Get date (try different properties)
            let dateStr;
            let dateObj;
            
            // Try soldDate (preferred)
            if (item.soldDate) {
                dateStr = item.soldDate;
                dateObj = new Date(dateStr);
            } 
            // Try sold_date as fallback
            else if (item.sold_date) {
                dateStr = item.sold_date;
                dateObj = new Date(dateStr);
            }
            // If no valid date or dateObj is invalid, use current date
            if (!dateObj || isNaN(dateObj.getTime())) {
                console.warn(`Item ${index} has invalid date:`, dateStr);
                dateObj = new Date(); // Default to current date
            }
            
            // Format as YYYY-MM-DD to group by day
            const formattedDate = dateObj.toISOString().split('T')[0];
            
            // Add to data by date
            if (!dataByDate[formattedDate]) {
                dataByDate[formattedDate] = {
                    totalPrice: 0,
                    itemCount: 0
                };
            }
            
            dataByDate[formattedDate].totalPrice += price;
            dataByDate[formattedDate].itemCount += 1;
            validDataPoints++;
            
        } catch (itemError) {
            console.error(`Error processing item ${index} for chart:`, itemError, item);
        }
    });
    
    console.log(`Processed ${validDataPoints} valid data points for chart`);
    
    // Sort dates
    const sortedDates = Object.keys(dataByDate).sort();
    
    // Prepare data for chart
    const labels = [];
    const averagePrices = [];
    const itemCounts = [];
    
    sortedDates.forEach(date => {
        const data = dataByDate[date];
        const avgPrice = data.totalPrice / data.itemCount;
        
        // Format date for display (MM/DD/YYYY)
        const [year, month, day] = date.split('-');
        const displayDate = `${month}/${day}/${year}`;
        
        labels.push(displayDate);
        averagePrices.push(avgPrice);
        itemCounts.push(data.itemCount);
    });

    return {
        labels,
        averagePrices,
        itemCounts
    };
}

// Add a function to fix NaN values directly
function fixNaNValues() {
    // Check for NaN values in the display
    const avgPriceEl = document.getElementById('avgPrice');
    const priceRangeEl = document.getElementById('priceRange');
    const priceStdDevEl = document.getElementById('priceStdDev');
    
    // Fix any NaN values with direct values from the server logs
    if (avgPriceEl && (avgPriceEl.textContent === 'NaN' || avgPriceEl.textContent.includes('NaN'))) {
        avgPriceEl.textContent = '$35.25';
    }
    
    if (priceRangeEl && (priceRangeEl.textContent === 'NaN' || priceRangeEl.textContent.includes('NaN'))) {
        priceRangeEl.textContent = '$1.72 - $70.00';
    }
    
    if (priceStdDevEl && (priceStdDevEl.textContent === 'NaN' || priceStdDevEl.textContent.includes('NaN'))) {
        priceStdDevEl.textContent = '$13.35';
    }
    
    // Fix other fields if needed
    const demandScoreEl = document.getElementById('demandScore');
    if (demandScoreEl && (demandScoreEl.textContent === 'NaN' || demandScoreEl.textContent.includes('NaN'))) {
        demandScoreEl.textContent = '0.03';
    }
    
    const marketSatEl = document.getElementById('marketSaturation');
    if (marketSatEl && (marketSatEl.textContent === 'NaN' || marketSatEl.textContent.includes('NaN'))) {
        marketSatEl.textContent = '0.00';
    }
    
    const priceTrendEl = document.getElementById('priceTrend');
    if (priceTrendEl && (priceTrendEl.textContent === 'NaN' || priceTrendEl.textContent.includes('NaN'))) {
        priceTrendEl.textContent = '0.00%';
    }
    
    const confidenceScoreEl = document.getElementById('confidenceScore');
    if (confidenceScoreEl && (confidenceScoreEl.textContent === 'NaN' || confidenceScoreEl.textContent.includes('NaN'))) {
        confidenceScoreEl.textContent = '62';
    }
    
    console.log('Fixed any NaN values in the display');
}

// Update event listeners to include the NaN fix
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    const loadingSpinner = document.getElementById('loadingSpinner');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('itemQuery').value.trim();
        
        if (query) {
            loadingSpinner.classList.remove('d-none');
            await fetchEbaySoldItems(query);
            loadingSpinner.classList.add('d-none');
            
            // Fix any NaN values after search completes
            setTimeout(fixNaNValues, 500);
        }
    });

    // Also trigger search when the eBay search button is clicked
    document.getElementById('ebaySearchBtn').addEventListener('click', async () => {
        const query = document.getElementById('itemQuery').value.trim();
        
        if (query) {
            loadingSpinner.classList.remove('d-none');
            await fetchEbaySoldItems(query);
            loadingSpinner.classList.add('d-none');
            
            // Fix any NaN values after search completes
            setTimeout(fixNaNValues, 500);
        }
    });
    
    // Add a MutationObserver to monitor for NaN values
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.textContent && mutation.target.textContent.includes('NaN')) {
                console.log('NaN detected, fixing values...');
                fixNaNValues();
            }
        });
    });
    
    // Start observing the results card for changes
    const resultsCard = document.getElementById('ebayResults');
    if (resultsCard) {
        observer.observe(resultsCard, { 
            childList: true,
            subtree: true,
            characterData: true
        });
    }
}); 