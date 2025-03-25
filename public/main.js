// Developer: Dean Whitlock

// Get the search query
function getQuery() {
  const searchInput = document.getElementById('itemQuery');
  return searchInput ? searchInput.value.trim() : '';
}

function toggleSpinner(show) {
  const spinner = document.getElementById('loadingSpinner');
  const results = document.getElementById('results');
  if (spinner) {
    spinner.classList.toggle('d-none', !show);
    spinner.style.removeProperty('display');
  }
  if (results) {
    results.classList.toggle('d-none', show);
    results.style.removeProperty('display');
  }
}

function hideResults() {
  const elements = ['ebayResults', 'amazonResults', 'historicalData'];
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.add('d-none');
      // Reset any inline display style that might interfere
      element.style.removeProperty('display');
    }
  });
}

// Function to show results
function showResults(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove('d-none');
    // Reset any inline display style that might interfere
    element.style.removeProperty('display');
  }
}

// Authentication helper functions
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function isAuthenticated() {
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  return !!(token && refreshToken);
}

async function refreshAuthToken() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('/api/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
}

async function handleAuthError(response) {
  if (response.status === 401 || response.status === 403) {
    const success = await refreshAuthToken();
    if (!success) {
      localStorage.clear();
      window.location.href = '/login.html';
      return null;
    }
    return true;
  }
  return false;
}

// Update the checkLoginStatus function
async function checkLoginStatus() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const response = await fetch('/api/protected', {
      headers: getAuthHeaders()
    });

    if (await handleAuthError(response)) {
      return checkLoginStatus();
    }

    const data = await response.json();
    if (data.user) {
      // Update UI with user info
      const userInfo = document.getElementById('userInfo');
      if (userInfo) {
        userInfo.innerHTML = `
          <span class="text-white">Welcome, ${data.user.firstName || data.user.username}</span>
        `;
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
}

// Update the logout handler
document.getElementById('logoutBtn').addEventListener('click', async function() {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();
    if (data.success) {
      localStorage.clear();
      window.location.href = '/login.html';
    } else {
      console.error('Logout failed:', data.error);
      alert('Failed to logout. Please try again.');
    }
  } catch (error) {
    console.error('Error during logout:', error);
    localStorage.clear();
    window.location.href = '/login.html';
  }
});

// Add authentication to API calls
async function makeAuthenticatedRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...getAuthHeaders()
      }
    });

    if (await handleAuthError(response)) {
      return makeAuthenticatedRequest(url, options);
    }

    return response;
  } catch (error) {
    console.error('Request error:', error);
    throw error;
  }
}

// -------------------------
// eBay Search and Display
// -------------------------
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded');
    
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Search button click handler
  const searchBtn = document.getElementById('ebaySearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', async function() {
    console.log('Search button clicked');
      const query = getQuery();
    console.log('Search query:', query);

    if (!query) {
        alert('Please enter an item name.');
      return;
    }

      hideResults();
      toggleSpinner(true);
      console.log('Fetching data from API...');

      try {
        // First fetch the items from eBay
        const ebayResponse = await fetch(`/api/ebay/sold/${encodeURIComponent(query)}`);
        console.log('API Response status:', ebayResponse.status);
        console.log('API Response headers:', Object.fromEntries(ebayResponse.headers.entries()));
        
        if (!ebayResponse.ok) {
          throw new Error(`HTTP error! status: ${ebayResponse.status}`);
        }
        
        const ebayData = await ebayResponse.json();
        console.log('Full API Response data:', ebayData);
        console.log('Items count:', ebayData.items?.length);
        console.log('Analytics data:', ebayData.analytics);
        
        displayEbayResults(ebayData);

        // Then save the search
        const searchResponse = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query })
        });

        if (!searchResponse.ok) {
          console.warn('Failed to save search history');
        }

        // Load historical data
        loadHistoricalData(query);

    } catch (error) {
      console.error('Error during search:', error);
      console.error('Error stack:', error.stack);
        alert('An error occurred while searching. Please try again.');
    } finally {
        toggleSpinner(false);
      console.log('Search operation completed');
      }
    });
  }

  // Amazon search button click handler
  const amazonSearchBtn = document.getElementById('amazonSearchBtn');
  if (amazonSearchBtn) {
    amazonSearchBtn.addEventListener('click', async function() {
      const query = getQuery();
      if (!query) {
        alert('Please enter an item name.');
    return;
  }

      hideResults();
      toggleSpinner(true);

      try {
        const response = await fetch('/api/search/amazon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayAmazonResults(data);

      } catch (error) {
        console.error('Error during Amazon search:', error);
        alert('An error occurred while searching Amazon. Please try again.');
      } finally {
        toggleSpinner(false);
      }
    });
  }

  // Helper functions
  function getQuery() {
    const searchInput = document.getElementById('itemQuery');
    return searchInput ? searchInput.value.trim() : '';
  }

  function toggleSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    const results = document.getElementById('results');
    if (spinner) {
      spinner.classList.toggle('d-none', !show);
      spinner.style.removeProperty('display');
    }
    if (results) {
      results.classList.toggle('d-none', show);
      results.style.removeProperty('display');
    }
  }

  function hideResults() {
    const elements = ['ebayResults', 'amazonResults', 'historicalData'];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('d-none');
        // Reset any inline display style that might interfere
        element.style.removeProperty('display');
      }
    });
  }

  // Load historical data
  const historicalData = document.getElementById('historicalData');
  if (historicalData) {
    historicalData.addEventListener('click', function() {
      const query = getQuery();
      if (query) {
        loadHistoricalData(query);
      }
    });
  }

  // Load wishlist when page loads
  loadWishlist();

  // Initialize all tooltips
  const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));

  initParticles();
  
  // Initialize counters when elements become visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        const value = parseInt(entry.target.textContent);
        animateValue(entry.target, 0, value, 1500);
        entry.target.dataset.counted = true;
      }
    });
  });

  document.querySelectorAll('.fs-4.fw-bold').forEach(el => observer.observe(el));

  // Add spectacular effects
  addSpectacularEffects();
  
  // Add ultra stunning effects
  addUltraStunningEffects();
  
  // Add typing effect to headings
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5');
  headings.forEach(heading => {
    if (!heading.classList.contains('glitch-text') && !heading.classList.contains('cyberpunk-glow')) {
      const text = heading.textContent;
      heading.textContent = '';
      
      let i = 0;
      const typeWriter = () => {
        if (i < text.length) {
          heading.textContent += text.charAt(i);
          i++;
          setTimeout(typeWriter, 50);
        }
      };
      
      // Start typing effect when element is in viewport
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            typeWriter();
            observer.unobserve(heading);
          }
        });
      });
      
      observer.observe(heading);
    }
  });

  // Fix any scrolling issues that might occur after loading
  setTimeout(fixScrollingIssues, 1000);
});

// Function to display eBay results
function displayEbayResults(data) {
    try {
        console.log('displayEbayResults called with data:', data);
        
        if (!data || !data.items) {
            console.error('No items found in data');
            return;
        }

        console.log('Items array length:', data.items.length);
        console.log('First item example:', data.items[0]);

        // Show the results container
        showResults('ebayResults');
        
        // Calculate analytics if not provided
        const analytics = data.analytics || calculateAnalytics(data.items);
        console.log('Analytics data:', analytics);

        // Update analytics display
        const analyticsElements = {
            totalItems: { id: 'totalItems', value: data.items.length },
            avgPrice: { 
                id: 'avgPrice', 
                value: analytics.avg_price, 
                format: (v) => `$${v.toFixed(2)}` 
            },
            priceRange: { 
                id: 'priceRange', 
                value: analytics.min_price && analytics.max_price ? 
                    `$${analytics.min_price.toFixed(2)} - $${analytics.max_price.toFixed(2)}` : 
                    'N/A' 
            },
            priceStdDev: { 
                id: 'priceStdDev', 
                value: analytics.price_std_dev, 
                format: (v) => `$${v.toFixed(2)}` 
            },
            demandScore: { 
                id: 'demandScore', 
                value: analytics.demand_score, 
                format: (v) => v.toFixed(2) 
            },
            marketSaturation: { 
                id: 'marketSaturation', 
                value: analytics.market_saturation, 
                format: (v) => v.toFixed(2) 
            },
            priceTrend: { 
                id: 'priceTrend', 
                value: analytics.price_trend, 
                format: (v) => `${v.toFixed(2)}%` 
            },
            confidenceScore: { 
                id: 'confidenceScore', 
                value: analytics.confidence_score, 
                format: (v) => `${(v * 100).toFixed(2)}%` 
            }
        };

        // Update each analytics element
        Object.entries(analyticsElements).forEach(([key, config]) => {
            const element = document.getElementById(config.id);
            if (element) {
                const value = config.value;
                if (value !== undefined && value !== null) {
                    const displayValue = config.format ? config.format(value) : value;
                    element.textContent = displayValue;
                    console.log(`Updated ${key}:`, displayValue);
                } else {
                    element.textContent = 'N/A';
                    console.log(`${key} value not available`);
                }
            } else {
                console.error(`Element not found: ${config.id}`);
            }
        });

        // Update items list
        const itemsList = document.querySelector('#ebayItemList ul');
        if (itemsList) {
            console.log('Updating items list');
            itemsList.innerHTML = ''; // Clear existing items
            data.items.forEach((item, index) => {
                console.log(`Processing item ${index}:`, item);
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <div>
                        <h6 class="mb-0">${item.title}</h6>
                        <small class="text-muted">Sold on: ${new Date(item.soldDate).toLocaleDateString()}</small>
                    </div>
                    <span class="badge bg-primary rounded-pill">$${item.price.toFixed(2)}</span>
                `;
                itemsList.appendChild(li);
            });
        } else {
            console.error('Items list container not found');
        }

        // Update chart
        console.log('Updating sales chart with items:', data.items);
        updateSalesChart(data.items);

  } catch (error) {
    console.error('Error in displayEbayResults:', error);
    console.error('Error stack:', error.stack);
  }
}

// Helper function to calculate analytics if not provided by the API
function calculateAnalytics(items) {
    const prices = items.map(item => item.price);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    // Calculate standard deviation
    const squareDiffs = prices.map(price => Math.pow(price - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    // Simple demand score based on number of sales
    const demand_score = Math.min(items.length / 100, 1);
    
    // Market saturation based on price spread
    const market_saturation = (max - min) / max;
    
    // Price trend (mock calculation)
    const price_trend = ((avg - min) / min) * 100;
    
    // Confidence score based on number of items
    const confidence_score = Math.min(items.length / 50, 1);

    return {
        avg_price: avg,
        min_price: min,
        max_price: max,
        price_std_dev: stdDev,
        demand_score,
        market_saturation,
        price_trend,
        confidence_score
    };
}

// Helper function to calculate standard deviation
function calculateStandardDeviation(values) {
    const n = values.length;
    if (n < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    return Math.sqrt(variance);
}

// Function to update sales chart
function updateSalesChart(items) {
    try {
        // Wait for Chart.js to be available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }

        const ctx = document.getElementById('salesChart');
        if (!ctx) {
            console.error('Sales chart canvas not found');
            return;
        }

        console.log('Chart items:', items);

        // Group items by date and calculate average price
        const groupedData = items.reduce((acc, item) => {
            // Ensure sold_date is valid
            let dateObj;
            try {
                // Try to parse the date
                if (item.soldDate) {
                    dateObj = new Date(item.soldDate);
                } else if (item.sold_date) {
                    dateObj = new Date(item.sold_date);
                }

                // Check if date is valid
                if (!dateObj || isNaN(dateObj.getTime())) {
                    // Use current date if invalid
                    dateObj = new Date();
                }
            } catch (error) {
                console.warn('Date parsing error:', error);
                dateObj = new Date();
            }

            // Format the date string
            const date = dateObj.toLocaleDateString();
            
            // Get the price (handle different property names)
            const price = parseFloat(item.price) || 0;
            
            if (!acc[date]) {
                acc[date] = { total: price, count: 1 };
            } else {
                acc[date].total += price;
                acc[date].count += 1;
            }
            return acc;
        }, {});

        const dates = Object.keys(groupedData).sort((a, b) => {
            // Sort dates chronologically
            return new Date(a) - new Date(b);
        });
        const avgPrices = dates.map(date => groupedData[date].total / groupedData[date].count);

        // Add debugging
        console.log('Grouped data:', groupedData);
        console.log('Dates for chart:', dates);
        console.log('Average prices for chart:', avgPrices);

        // Destroy existing chart if it exists and is a valid Chart instance
        if (window.salesChart && window.salesChart instanceof Chart) {
            window.salesChart.destroy();
        }

        // Create new chart
        window.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Average Price',
                    data: avgPrices,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => `$${value.toFixed(2)}`
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: context => `$${context.parsed.y.toFixed(2)}`
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating sales chart:', error);
    }
}

// Function to show loading state
function showLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.classList.remove('d-none');
    }
}

// Function to hide loading state
function hideLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.classList.add('d-none');
    }
}

function displayHistoricalData(history) {
  const historyTable = document.getElementById('ebay-history-table');
  if (!historyTable) {
    console.error('History table element not found');
    return;
  }

  if (!history || history.length === 0) {
    historyTable.innerHTML = '<tr><td colspan="6" class="text-center">No historical data available</td></tr>';
    return;
  }

  console.log('Displaying historical data:', history);

  historyTable.innerHTML = history.map(item => {
    // Ensure we have a valid date
    let dateStr = 'N/A';
    try {
      const date = item.timestamp ? new Date(item.timestamp) : null;
      if (date && !isNaN(date.getTime())) {
        dateStr = date.toLocaleDateString();
      } else if (item.date) {
        const altDate = new Date(item.date);
        if (!isNaN(altDate.getTime())) {
          dateStr = altDate.toLocaleDateString();
        }
      }
    } catch (error) {
      console.warn('Error formatting date:', error);
    }
    
    const trend = calculatePriceChange(item);
    
    console.log('Processing history item:', {
      date: dateStr,
      avg_price: item.avg_price,
      high_price: item.high_price || item.max_price,
      low_price: item.low_price || item.min_price,
      total_sales: item.total_sales,
      trend
    });
    
    // Handle different property names (avg_price vs average_price, etc.)
    const avgPrice = item.avg_price !== undefined ? item.avg_price : (item.average_price || 0);
    const highPrice = item.high_price !== undefined ? item.high_price : (item.max_price || 0);
    const lowPrice = item.low_price !== undefined ? item.low_price : (item.min_price || 0);
    const totalSales = item.total_sales || 0;
    
    return `
      <tr>
        <td>${dateStr}</td>
        <td>$${avgPrice.toFixed(2)}</td>
        <td>$${highPrice.toFixed(2)}</td>
        <td>$${lowPrice.toFixed(2)}</td>
        <td>${totalSales}</td>
        <td>${trend}</td>
      </tr>
    `;
  }).join('');
}

// Helper function to calculate price change
function calculatePriceChange(item) {
  if (!item.avg_price || !item.previous_price) return '';
  
  const priceChange = ((item.avg_price - item.previous_price) / item.previous_price) * 100;
  
  if (priceChange === 0) return '→';
  if (priceChange > 0) return `<span class="text-success">↑ ${priceChange.toFixed(1)}%</span>`;
  return `<span class="text-danger">↓ ${Math.abs(priceChange).toFixed(1)}%</span>`;
}

// -------------------------
// Amazon Search and Display
// -------------------------
function displayAmazonResults(data) {
  if (data.error) {
    alert(data.error);
    return;
  }
  
  const amazonResults = document.getElementById('amazonResults');
  amazonResults.classList.remove('d-none');

  // Update the Amazon results section with simpler display
  document.getElementById('amazonItemImage').src = data.result.image || 'default-image.png';
  
  const resultDiv = document.createElement('div');
  resultDiv.className = 'p-3';
  resultDiv.innerHTML = `
    <h5>${data.result.title}</h5>
    <p class="fs-4">Price: $${data.result.price}</p>
    <a href="${data.result.link}" target="_blank" class="btn btn-primary">
      <i class="fab fa-amazon"></i> View on Amazon
    </a>
  `;

  // Clear previous content
  const contentArea = amazonResults.querySelector('.card-body');
  contentArea.innerHTML = '';
  contentArea.appendChild(resultDiv);
}

// -----------------------------
// Wishlist functionality
// -----------------------------

// Load wishlist from server
function loadWishlist() {
  fetch('/api/wishlist')
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById('wishlistTable');
      tableBody.innerHTML = '';

      if (!data.wishlist || data.wishlist.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Your wishlist is empty</td></tr>';
        return;
      }

      data.wishlist.forEach(item => {
        const row = document.createElement('tr');

        // Product name column - make it clickable to search
        const nameCell = document.createElement('td');
        const nameLink = document.createElement('a');
        nameLink.href = '#';
        nameLink.textContent = item.product_name;
        nameLink.addEventListener('click', (e) => {
          e.preventDefault();
          document.getElementById('itemQuery').value = item.product_name;
          document.getElementById('ebaySearchBtn').click();
        });
        nameCell.appendChild(nameLink);

        // Target price column
        const priceCell = document.createElement('td');
        priceCell.textContent = item.target_price ? `$${item.target_price}` : 'Not set';

        // Date added column
        const dateCell = document.createElement('td');
        const date = new Date(item.created_at);
        dateCell.textContent = date.toLocaleDateString();

        // Actions column
        const actionsCell = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => removeFromWishlist(item.id));
        actionsCell.appendChild(deleteBtn);

        // Add all cells to the row
        row.appendChild(nameCell);
        row.appendChild(priceCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);

        // Add row to table
        tableBody.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error loading wishlist:', error);
    });
}

// Add an item to the wishlist
function addToWishlist(event) {
  event.preventDefault();

  const productName = document.getElementById('productNameInput').value.trim();
  const targetPrice = document.getElementById('targetPriceInput').value;

  if (!productName) {
    alert('Please enter a product name.');
    return;
  }

  fetch('/api/wishlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productName,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Clear form
      document.getElementById('productNameInput').value = '';
      document.getElementById('targetPriceInput').value = '';

      // Reload wishlist
      loadWishlist();
    } else {
      alert(data.error || 'Failed to add item to wishlist.');
    }
  })
  .catch(error => {
    console.error('Error adding to wishlist:', error);
    alert('An error occurred while adding to wishlist.');
  });
}

// Remove an item from the wishlist
function removeFromWishlist(id) {
  if (!confirm('Are you sure you want to remove this item from your wishlist?')) {
    return;
  }

  fetch(`/api/wishlist/${id}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      loadWishlist();
    } else {
      alert(data.error || 'Failed to remove item from wishlist.');
    }
  })
  .catch(error => {
    console.error('Error removing from wishlist:', error);
    alert('An error occurred while removing from wishlist.');
  });
}

// Initialize particle background
function initParticles() {
  const background = document.createElement('div');
  background.className = 'particle-background';
  document.body.appendChild(background);

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 15}s`;
    background.appendChild(particle);
  }
}

// Animate number counters
function animateValue(element, start, end, duration) {
  element.classList.add('counter-value');
  let current = start;
  const range = end - start;
  const increment = range / (duration / 16);
  const timer = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current).toLocaleString();
  }, 16);
}

async function loadHistoricalData(query) {
  try {
    console.log('Loading historical data for query:', query);
    const response = await fetch(`/api/search/history/${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch historical data');
    }
    
    console.log('Historical data received:', data);
    
    if (!data.history || data.history.length === 0) {
      console.log('No historical data found');
      const historyTable = document.getElementById('ebay-history-table');
      if (historyTable) {
        historyTable.innerHTML = '<tr><td colspan="6" class="text-center">No historical data available</td></tr>';
      }
    return;
  }

    // Sort history by date in descending order
    data.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Add previous_price for trend calculation
    data.history.forEach((item, index) => {
      if (index < data.history.length - 1) {
        item.previous_price = data.history[index + 1].avg_price;
      }
    });
    
    displayHistoricalData(data.history);
  } catch (error) {
    console.error('Error loading historical data:', error);
    const historyContainer = document.getElementById('ebay-history-table');
    if (historyContainer) {
      historyContainer.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load historical data</td></tr>';
    }
  }
}

// Add spectacular effects to the page
function addSpectacularEffects() {
  try {
    // Initialize particles.js
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#ffffff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: false },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.4, width: 1 },
            move: { enable: true, speed: 6, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: { enable: true, mode: 'repulse' },
                onclick: { enable: true, mode: 'push' },
                resize: true
            }
        },
        retina_detect: true
    });
  } catch (error) {
    console.error('Error adding spectacular effects:', error);
  }
}

// Enhanced scrolling fix function
function fixScrollingIssues() {
  // Ensure body scrolling is not blocked
  document.body.style.overflow = 'auto';
  document.documentElement.style.overflow = 'auto';
  document.body.style.height = 'auto';
  document.documentElement.style.height = 'auto';
  
  // Fix potential issues with the neon grid background
  const body = document.body;
  if (body.classList.contains('neon-grid')) {
    // Remove any existing mousemove event listeners
    document.removeEventListener('mousemove', handleBackgroundEffect);
    
    // Add a throttled version of the background effect to improve performance
    let lastExecution = 0;
    document.addEventListener('mousemove', function(e) {
      const now = Date.now();
      if (now - lastExecution > 50) { // Only run every 50ms
        handleBackgroundEffect(e);
        lastExecution = now;
      }
    }, { passive: true });
  }
  
  // Fix any potential issues with holographic cards
  const holographicCards = document.querySelectorAll('.holographic-card');
  holographicCards.forEach(card => {
    // Remove any existing mousemove event listeners
    const oldMouseMove = card.onmousemove;
    card.onmousemove = null;
    
    // Add a throttled version of the mousemove event
    if (oldMouseMove) {
      card.addEventListener('mousemove', function(e) {
        if (!card.throttleTimer) {
          card.throttleTimer = setTimeout(function() {
            oldMouseMove.call(card, e);
            card.throttleTimer = null;
          }, 30);
        }
      }, { passive: true });
    }
  });
  
  // Ensure particles don't block scrolling
  const particlesContainer = document.getElementById('particles-js');
  if (particlesContainer) {
    particlesContainer.style.pointerEvents = 'none';
    particlesContainer.style.position = 'fixed';
    particlesContainer.style.zIndex = '-1';
  }
  
  // Fix any potential issues with fixed position elements
  const fixedElements = document.querySelectorAll('.fixed-position, .navbar, .footer-ultra');
  fixedElements.forEach(el => {
    el.style.willChange = 'transform';
  });
  
  // Fix any issues with transform-style: preserve-3d
  const preserve3dElements = document.querySelectorAll('.float-3d, .table-ultra tbody tr, .chart-ultra');
  preserve3dElements.forEach(el => {
    el.style.transformStyle = 'flat';
  });
  
  // Fix any issues with backdrop-filter
  const backdropElements = document.querySelectorAll('.holographic-card, .stat-ultra, .chart-ultra');
  backdropElements.forEach(el => {
    // Check if backdrop-filter is causing issues
    const computedStyle = window.getComputedStyle(el);
    if (computedStyle.backdropFilter && navigator.userAgent.indexOf('Firefox') > -1) {
      el.style.backdropFilter = 'none';
    }
  });
  
  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, { passive: false });
  });
  
  // Fix scrolling on mobile devices
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    document.body.style.webkitOverflowScrolling = 'touch';
    
    // Reduce animation intensity on mobile
    const animatedElements = document.querySelectorAll('.animated-border, .float-3d, .glitch-text');
    animatedElements.forEach(el => {
      el.style.animationDuration = '50%';
    });
  }
}

// Handle background effect with passive event listener
function handleBackgroundEffect(e) {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  
  // Create dynamic radial gradient that follows cursor
  document.body.style.backgroundImage = `
    linear-gradient(rgba(67, 97, 238, 0.2) 1px, transparent 1px),
    linear-gradient(90deg, rgba(67, 97, 238, 0.2) 1px, transparent 1px),
    radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255, 65, 108, 0.1) 0%, transparent 50%)
  `;
}

// Update the addUltraStunningEffects function to include scrolling fixes
function addUltraStunningEffects() {
  // Add 3D holographic effect to cards
  const holographicCards = document.querySelectorAll('.holographic-card');
  holographicCards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate angle and distance from center
      const angleX = (y - centerY) / 15;
      const angleY = (centerX - x) / 15;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const intensity = Math.min(distance / Math.max(centerX, centerY) * 0.8, 0.8);
      
      // Apply transform
      card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.03)`;
      
      // Create dynamic light reflection effect
      const shine = card.querySelector('.shine') || document.createElement('div');
      if (!card.querySelector('.shine')) {
        shine.classList.add('shine');
        shine.style.position = 'absolute';
        shine.style.top = '0';
        shine.style.left = '0';
        shine.style.right = '0';
        shine.style.bottom = '0';
        shine.style.pointerEvents = 'none';
        shine.style.background = 'radial-gradient(circle at ' + 
          (x / rect.width * 100) + '% ' + 
          (y / rect.height * 100) + '%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 80%)';
        shine.style.opacity = intensity;
        shine.style.zIndex = '1';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        card.appendChild(shine);
      } else {
        shine.style.background = 'radial-gradient(circle at ' + 
          (x / rect.width * 100) + '% ' + 
          (y / rect.height * 100) + '%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 80%)';
        shine.style.opacity = intensity;
      }
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
      const shine = card.querySelector('.shine');
      if (shine) {
        shine.style.opacity = '0';
      }
    });
  });
  
  // Add glitch effect to glitch-text elements
  const glitchTexts = document.querySelectorAll('.glitch-text');
  glitchTexts.forEach(text => {
    if (!text.hasAttribute('data-text')) {
      text.setAttribute('data-text', text.textContent);
    }
    
    // Add click effect for extra glitch
    text.addEventListener('click', () => {
      text.classList.add('glitch-click');
      setTimeout(() => {
        text.classList.remove('glitch-click');
      }, 1000);
    });
  });
  
  // Add ultra button effects
  const ultraButtons = document.querySelectorAll('.btn-ultra');
  ultraButtons.forEach(button => {
    button.addEventListener('mouseenter', () => {
      // Create ripple effect
      const ripple = document.createElement('div');
      ripple.classList.add('btn-ripple');
      ripple.style.position = 'absolute';
      ripple.style.top = '0';
      ripple.style.left = '0';
      ripple.style.width = '100%';
      ripple.style.height = '100%';
      ripple.style.background = 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%)';
      ripple.style.transform = 'scale(0)';
      ripple.style.transition = 'transform 0.6s, opacity 0.6s';
      ripple.style.opacity = '1';
      ripple.style.borderRadius = '50px';
      ripple.style.pointerEvents = 'none';
      ripple.style.zIndex = '0';
      
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);
      
      setTimeout(() => {
        ripple.style.transform = 'scale(2.5)';
        ripple.style.opacity = '0';
      }, 10);
      
      setTimeout(() => {
        button.removeChild(ripple);
      }, 600);
    });
    
    // Add click effect
    button.addEventListener('click', e => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const circle = document.createElement('div');
      circle.classList.add('btn-click-effect');
      circle.style.position = 'absolute';
      circle.style.top = y + 'px';
      circle.style.left = x + 'px';
      circle.style.width = '0';
      circle.style.height = '0';
      circle.style.background = 'rgba(255,255,255,0.4)';
      circle.style.borderRadius = '50%';
      circle.style.transform = 'translate(-50%, -50%)';
      circle.style.transition = 'width 0.5s, height 0.5s';
      circle.style.pointerEvents = 'none';
      circle.style.zIndex = '0';
      
      button.appendChild(circle);
      
      const size = Math.max(rect.width, rect.height) * 2;
      circle.style.width = size + 'px';
      circle.style.height = size + 'px';
      
      setTimeout(() => {
        circle.style.opacity = '0';
      }, 300);
      
      setTimeout(() => {
        button.removeChild(circle);
      }, 500);
    });
  });
  
  // Add floating 3D effect
  const float3dElements = document.querySelectorAll('.float-3d');
  float3dElements.forEach(element => {
    element.addEventListener('mousemove', e => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const angleX = (y - centerY) / 30;
      const angleY = (centerX - x) / 30;
      
      element.style.transform = `translateZ(20px) rotateX(${angleX}deg) rotateY(${angleY}deg)`;
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.transform = 'translateZ(0) rotateX(0) rotateY(0)';
    });
  });
  
  // Add animated border effect
  const animatedBorders = document.querySelectorAll('.animated-border');
  animatedBorders.forEach(border => {
    border.addEventListener('mouseenter', () => {
      border.style.animationPlayState = 'running';
    });
    
    border.addEventListener('mouseleave', () => {
      border.style.animationPlayState = 'paused';
    });
  });
  
  // Add ultra table row effects
  const tableRows = document.querySelectorAll('.table-ultra tbody tr');
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      // Add glow effect
      row.style.boxShadow = '0 0 15px rgba(67, 97, 238, 0.5)';
      
      // Highlight cells
      const cells = row.querySelectorAll('td');
      cells.forEach((cell, index) => {
        cell.style.transition = 'transform 0.3s ease ' + (index * 0.05) + 's';
        cell.style.transform = 'translateY(-5px)';
      });
    });
    
    row.addEventListener('mouseleave', () => {
      row.style.boxShadow = '';
      
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        cell.style.transform = 'translateY(0)';
      });
    });
  });
  
  // Add cyberpunk glow effect on hover
  const cyberpunkElements = document.querySelectorAll('.cyberpunk-glow');
  cyberpunkElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
      element.style.animationDuration = '0.5s';
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.animationDuration = '2s';
    });
  });
  
  // Add ultra chart effects
  const chartContainers = document.querySelectorAll('.chart-ultra');
  chartContainers.forEach(container => {
    container.addEventListener('mouseenter', () => {
      container.style.transform = 'perspective(1000px) rotateX(10deg) rotateY(5deg) translateZ(10px)';
      container.style.boxShadow = '0 20px 40px rgba(31,38,135,0.4), 0 0 20px rgba(255,255,255,0.6) inset';
    });
    
    container.addEventListener('mouseleave', () => {
      container.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
      container.style.boxShadow = '0 10px 30px rgba(31,38,135,0.3), 0 0 10px rgba(255,255,255,0.5) inset';
    });
  });
  
  // Add ultra stat card effects
  const statCards = document.querySelectorAll('.stat-ultra');
  statCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-10px) scale(1.05)';
      
      // Animate the number
      const numberElement = card.querySelector('p');
      if (numberElement && numberElement.textContent) {
        const value = parseFloat(numberElement.textContent.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(value)) {
          const startValue = value * 0.7;
          const endValue = value;
          let currentValue = startValue;
          const duration = 500;
          const startTime = performance.now();
          
          const updateNumber = (timestamp) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            currentValue = startValue + (endValue - startValue) * progress;
            
            if (numberElement.textContent.includes('$')) {
              numberElement.textContent = '$' + currentValue.toFixed(2);
            } else {
              numberElement.textContent = Math.round(currentValue);
            }
            
            if (progress < 1) {
              requestAnimationFrame(updateNumber);
            }
          };
          
          requestAnimationFrame(updateNumber);
        }
      }
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) scale(1)';
    });
  });
  
  // Add dynamic background effect with passive event listener
  const body = document.body;
  if (body.classList.contains('neon-grid')) {
    document.addEventListener('mousemove', handleBackgroundEffect, { passive: true });
  }
  
  // Add glitch effect to images on hover
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('mouseenter', () => {
      // Create glitch container
      const container = document.createElement('div');
      container.classList.add('glitch-img-container');
      container.style.position = 'relative';
      container.style.display = 'inline-block';
      container.style.overflow = 'hidden';
      
      // Create glitch layers
      for (let i = 1; i <= 2; i++) {
        const glitchLayer = document.createElement('div');
        glitchLayer.classList.add('glitch-img-layer');
        glitchLayer.style.position = 'absolute';
        glitchLayer.style.top = '0';
        glitchLayer.style.left = '0';
        glitchLayer.style.width = '100%';
        glitchLayer.style.height = '100%';
        glitchLayer.style.backgroundImage = `url(${img.src})`;
        glitchLayer.style.backgroundSize = 'cover';
        glitchLayer.style.backgroundPosition = 'center';
        glitchLayer.style.mixBlendMode = 'none';
        glitchLayer.style.animation = `glitch-img-${i} 0.5s infinite linear alternate-reverse`;
        
        container.appendChild(glitchLayer);
      }
      
      // Add keyframes for glitch effect
      if (!document.querySelector('#glitch-img-keyframes')) {
        const style = document.createElement('style');
        style.id = 'glitch-img-keyframes';
        style.textContent = `
          @keyframes glitch-img-1 {
            0% { transform: translate(0, 0); filter: hue-rotate(0deg); }
            20% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
            40% { transform: translate(-2px, -2px); filter: hue-rotate(180deg); }
            60% { transform: translate(2px, 2px); filter: hue-rotate(270deg); }
            80% { transform: translate(2px, -2px); filter: hue-rotate(360deg); }
            100% { transform: translate(0, 0); filter: hue-rotate(0deg); }
          }
          @keyframes glitch-img-2 {
            0% { transform: translate(0, 0); filter: hue-rotate(180deg); }
            25% { transform: translate(2px, -2px); filter: hue-rotate(270deg); }
            50% { transform: translate(-2px, -2px); filter: hue-rotate(0deg); }
            75% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
            100% { transform: translate(0, 0); filter: hue-rotate(180deg); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Replace image with glitch container
      const parent = img.parentNode;
      parent.replaceChild(container, img);
      container.appendChild(img);
      img.style.position = 'relative';
      img.style.zIndex = '2';
      
      // Remove glitch effect on mouseleave
      container.addEventListener('mouseleave', () => {
        parent.replaceChild(img, container);
        img.style.position = '';
        img.style.zIndex = '';
      });
    });
  });

  // Fix scrolling issues
  fixScrollingIssues();
  
  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}