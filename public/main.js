// Developer: Dean Whitlock

// Get the search query
function getQuery() {
  const searchInput = document.getElementById('itemQuery');
  return searchInput ? searchInput.value.trim() : '';
}

function toggleSpinner(show) {
  const spinner = document.getElementById('loadingSpinner');
  const results = document.getElementById('results');
  if (spinner) spinner.style.display = show ? 'block' : 'none';
  if (results) results.style.display = show ? 'none' : 'block';
}

function hideResults() {
  const elements = ['ebayResults', 'amazonResults', 'historicalData'];
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });
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
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query })
        });

        console.log('API Response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayEbayResults(data);
        loadHistoricalData(query);

      } catch (error) {
        console.log('Error during search:', error);
        console.log('Error stack:', error.stack);
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
    if (spinner) spinner.style.display = show ? 'block' : 'none';
    if (results) results.style.display = show ? 'none' : 'block';
  }

  function hideResults() {
    const elements = ['ebayResults', 'amazonResults', 'historicalData'];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
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

function displayEbayResults(data) {
  console.log('Starting displayEbayResults with data:', data);
    
  if (data.error) {
    console.error('Error in data:', data.error);
    alert(data.error);
    return;
  }
  
  try {
    // Show the results section
    const ebayResults = document.getElementById('ebayResults');
    if (!ebayResults) {
      console.error('ebayResults element not found');
      return;
    }

    ebayResults.classList.remove('d-none');
    
    // Update prices using stats from the response
    const elements = {
      avgPrice: document.getElementById('avgPrice'),
      highPrice: document.getElementById('highPrice'),
      lowPrice: document.getElementById('lowPrice'),
      totalSales: document.getElementById('totalSales')
    };

    // Check if all elements exist
    Object.entries(elements).forEach(([key, element]) => {
      if (!element) {
        console.error(`${key} element not found`);
      }
    });

    const stats = data.stats;
    // Update values if elements exist
    if (elements.avgPrice) elements.avgPrice.textContent = `$${stats.avgPrice.toFixed(2)}`;
    if (elements.highPrice) elements.highPrice.textContent = `$${stats.highPrice.toFixed(2)}`;
    if (elements.lowPrice) elements.lowPrice.textContent = `$${stats.lowPrice.toFixed(2)}`;
    if (elements.totalSales) elements.totalSales.textContent = stats.totalItems;

    // Update price alert elements if they exist
    const alertPriceElement = document.getElementById('alertPrice');
    const currentPriceElement = document.getElementById('currentPrice');
    
    if (alertPriceElement && currentPriceElement) {
      alertPriceElement.textContent = `$${stats.avgPrice.toFixed(2)}`;
      currentPriceElement.dataset.price = stats.avgPrice;
    }

    // Display the first item's image if available
    const itemImage = document.getElementById('ebayItemImage');
    if (itemImage) {
      if (data.items && data.items.length > 0 && data.items[0].image) {
        itemImage.src = data.items[0].image;
      } else {
        itemImage.src = 'default-image.png';
      }
    }

    // Display items list
    const itemListContainer = document.getElementById('ebayItemList');
    if (itemListContainer) {
      const listGroup = itemListContainer.querySelector('ul');
      if (listGroup) {
        listGroup.innerHTML = '';
        data.items.forEach(item => {
          const listItem = document.createElement('li');
          listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
          listItem.innerHTML = `
            <div>
              <a href="${item.link}" target="_blank" class="text-decoration-none">${item.title}</a>
              <small class="text-muted d-block">${item.soldDateText || new Date(item.soldDate).toLocaleDateString()}</small>
            </div>
            <span class="badge bg-primary rounded-pill">$${item.soldPrice.toFixed(2)}</span>
          `;
          listGroup.appendChild(listItem);
        });
      }
    }

    console.log('Successfully displayed eBay results');
  } catch (error) {
    console.error('Error in displayEbayResults:', error);
    console.error('Error stack:', error.stack);
  }
}

function displayHistoricalData(history) {
  const historyTable = document.getElementById('ebay-history-table');
  if (!historyTable) return;

  if (!history || history.length === 0) {
    historyTable.innerHTML = '<tr><td colspan="6" class="text-center">No historical data available</td></tr>';
    return;
  }

  historyTable.innerHTML = history.map(item => {
    const date = new Date(item.timestamp).toLocaleDateString();
    const trend = ''; // You can implement trend calculation here if needed
    
    return `
      <tr>
        <td>${date}</td>
        <td>$${item.avg_price?.toFixed(2) || 'N/A'}</td>
        <td>$${item.high_price?.toFixed(2) || 'N/A'}</td>
        <td>$${item.low_price?.toFixed(2) || 'N/A'}</td>
        <td>${item.total_sales || 0}</td>
        <td>${trend}</td>
      </tr>
    `;
  }).join('');
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
    const response = await fetch(`/api/search/history/${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch historical data');
    }
    
    displayHistoricalData(data.history);
  } catch (error) {
    console.error('Error loading historical data:', error);
    const historyContainer = document.getElementById('ebay-history-table');
    if (historyContainer) {
      historyContainer.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load historical data</td></tr>';
    }
  }
}

function addPriceIndicators(record) {
  const priceChange = calculatePriceChange(record);
  console.log(`Price change for ${new Date(record.timestamp).toLocaleDateString()}: ${priceChange}%`);
  
  return `
    <td>
      $${record.avg_price.toFixed(2)}
      <span class="price-indicator ${priceChange > 0 ? 'up' : 'down'}" 
            data-bs-toggle="tooltip" 
            title="${Math.abs(priceChange)}% ${priceChange > 0 ? 'increase' : 'decrease'}">
        <i class="fas fa-arrow-${priceChange > 0 ? 'up text-success' : 'down text-danger'}"></i>
      </span>
    </td>
  `;
}

function calculatePriceChange(record) {
  // Simple mock implementation for testing
  return Math.random() > 0.5 ? 5 : -5;
}

// Price Alert functionality
document.getElementById('setAlertBtn').addEventListener('click', function() {
  const threshold = document.getElementById('alertThreshold').value;
  const currentPrice = parseFloat(document.getElementById('currentPrice').dataset.price);
  
  if (!threshold) {
    alert('Please enter a price threshold');
    return;
  }

  if (!currentPrice) {
    alert('Please search for a product first');
    return;
  }

  // Save the alert to the database
  fetch('/api/price-alerts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      price: parseFloat(threshold),
      product: document.getElementById('itemQuery').value
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Price alert set successfully!');
      // Update the UI to show active alert
      document.getElementById('currentPrice').classList.add('active');
    }
  })
  .catch(error => console.error('Error:', error));
});

// Add spectacular effects to the page
function addSpectacularEffects() {
  // Add 3D tilt effect to cards
  const cards = document.querySelectorAll('.card-3d');
  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const angleX = (y - centerY) / 20;
      const angleY = (centerX - x) / 20;
      
      card.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.02)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateX(0) rotateY(0) scale(1)';
    });
  });
  
  // Add star rating functionality
  const stars = document.querySelectorAll('.rating i');
  if (stars.length > 0) {
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.getAttribute('data-rating'));
        document.getElementById('ratingValue').value = rating;
        
        // Update stars display
        stars.forEach(s => {
          const sRating = parseInt(s.getAttribute('data-rating'));
          if (sRating <= rating) {
            s.classList.remove('far');
            s.classList.add('fas');
          } else {
            s.classList.remove('fas');
            s.classList.add('far');
          }
        });
      });
      
      // Hover effect
      star.addEventListener('mouseenter', () => {
        const rating = parseInt(star.getAttribute('data-rating'));
        
        stars.forEach(s => {
          const sRating = parseInt(s.getAttribute('data-rating'));
          if (sRating <= rating) {
            s.classList.add('text-warning');
          }
        });
      });
      
      star.addEventListener('mouseleave', () => {
        stars.forEach(s => {
          s.classList.remove('text-warning');
        });
      });
    });
  }
  
  // Add trend indicators to price history
  function addTrendIndicators() {
    const historyTable = document.getElementById('ebay-history-table');
    if (historyTable && historyTable.rows.length > 1) {
      // Get all price cells
      const rows = Array.from(historyTable.rows);
      
      // Skip if only one row
      if (rows.length < 2) return;
      
      // Process each row except the first (most recent)
      for (let i = 1; i < rows.length; i++) {
        const currentAvgPrice = parseFloat(rows[i-1].cells[1].textContent.replace('$', ''));
        const previousAvgPrice = parseFloat(rows[i].cells[1].textContent.replace('$', ''));
        
        if (!isNaN(currentAvgPrice) && !isNaN(previousAvgPrice) && previousAvgPrice > 0) {
          const percentChange = ((currentAvgPrice - previousAvgPrice) / previousAvgPrice) * 100;
          
          // Add trend indicator to the trend cell
          const trendCell = rows[i-1].cells[5];
          if (percentChange > 0) {
            trendCell.innerHTML = `<span class="trend-up">+${percentChange.toFixed(1)}%</span>`;
          } else if (percentChange < 0) {
            trendCell.innerHTML = `<span class="trend-down">${percentChange.toFixed(1)}%</span>`;
          } else {
            trendCell.innerHTML = `<span>0%</span>`;
          }
        }
      }
    }
  }
  
  // Call addTrendIndicators when history is loaded
  const originalDisplayHistoricalData = displayHistoricalData;
  displayHistoricalData = function(history) {
    originalDisplayHistoricalData(history);
    setTimeout(addTrendIndicators, 100);
  };
  
  // Enhanced loading animation
  const originalShowLoading = showLoading;
  showLoading = function() {
    originalShowLoading();
    document.body.classList.add('loading-active');
  };
  
  const originalHideLoading = hideLoading;
  hideLoading = function() {
    originalHideLoading();
    document.body.classList.remove('loading-active');
  };
  
  // Enhanced chart rendering
  const originalDisplayEbayResults = displayEbayResults;
  displayEbayResults = function(data) {
    originalDisplayEbayResults(data);
    
    // Add enhanced chart if it exists
    const chartCanvas = document.getElementById('salesChart');
    if (chartCanvas && data.items && data.items.length > 0) {
      // Group items by date
      const dateGroups = {};
      data.items.forEach(item => {
        const date = new Date(item.soldDate || Date.now()).toLocaleDateString();
        if (!dateGroups[date]) {
          dateGroups[date] = [];
        }
        dateGroups[date].push(item);
      });
      
      // Calculate average price per day
      const dates = Object.keys(dateGroups).sort((a, b) => new Date(a) - new Date(b));
      const avgPrices = dates.map(date => {
        const prices = dateGroups[date].map(item => item.price || item.soldPrice);
        return prices.reduce((sum, price) => sum + price, 0) / prices.length;
      });
      
      // Create ultra gradient for chart
      const ctx = chartCanvas.getContext('2d');
      const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
      gradientFill.addColorStop(0, 'rgba(67, 97, 238, 0.7)');
      gradientFill.addColorStop(1, 'rgba(67, 97, 238, 0.1)');
      
      const gradientStroke = ctx.createLinearGradient(0, 0, 400, 0);
      gradientStroke.addColorStop(0, '#ff416c');
      gradientStroke.addColorStop(0.5, '#4361ee');
      gradientStroke.addColorStop(1, '#00ffff');
      
      // Create or update chart
      if (window.priceChart) {
        window.priceChart.destroy();
      }
      
      window.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'Average Price',
            data: avgPrices,
            borderColor: gradientStroke,
            backgroundColor: gradientFill,
            borderWidth: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: gradientStroke,
            pointBorderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 12,
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#ff416c',
            pointHoverBorderWidth: 4,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                font: {
                  family: 'Poppins',
                  size: 16,
                  weight: 'bold'
                },
                color: '#4361ee'
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              titleColor: '#333',
              bodyColor: '#333',
              borderColor: '#4361ee',
              borderWidth: 2,
              padding: 15,
              cornerRadius: 10,
              displayColors: false,
              titleFont: {
                family: 'Poppins',
                size: 16,
                weight: 'bold'
              },
              bodyFont: {
                family: 'Poppins',
                size: 14
              },
              callbacks: {
                label: function(context) {
                  return `Average Price: $${context.raw.toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: {
                  family: 'Poppins',
                  size: 12
                },
                color: '#6c757d'
              }
            },
            y: {
              grid: {
                borderDash: [5, 5],
                color: 'rgba(67, 97, 238, 0.1)'
              },
              ticks: {
                font: {
                  family: 'Poppins',
                  size: 12
                },
                color: '#6c757d',
                callback: function(value) {
                  return '$' + value;
                }
              }
            }
          },
          animation: {
            duration: 2000,
            easing: 'easeOutQuart',
            onProgress: function(animation) {
              const chartInstance = animation.chart;
              const ctx = chartInstance.ctx;
              const dataset = chartInstance.data.datasets[0];
              const meta = chartInstance.getDatasetMeta(0);
              
              // Add glow effect to line
              ctx.shadowColor = 'rgba(67, 97, 238, 0.5)';
              ctx.shadowBlur = 10;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              // Reset shadow after drawing
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
            }
          },
          hover: {
            mode: 'index',
            intersect: false
          }
        }
      });
      
      // Add animation to chart container
      const chartContainer = chartCanvas.closest('.chart-ultra');
      if (chartContainer) {
        chartContainer.classList.add('fade-in-up');
        
        // Add 3D effect on hover
        chartContainer.addEventListener('mouseenter', () => {
          chartContainer.style.transform = 'perspective(1000px) rotateX(10deg) rotateY(5deg) translateZ(10px)';
        });
        
        chartContainer.addEventListener('mouseleave', () => {
          chartContainer.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        });
      }
    }
  };
}

// Fix scrolling issues in the ultra stunning effects
function fixScrollingIssues() {
  // Ensure body scrolling is not blocked
  document.body.style.overflow = 'auto';
  
  // Fix potential issues with the neon grid background
  const body = document.body;
  if (body.classList.contains('neon-grid')) {
    // Modify the mousemove event to not interfere with scrolling
    document.removeEventListener('mousemove', handleBackgroundEffect);
    document.addEventListener('mousemove', handleBackgroundEffect, { passive: true });
  }
  
  // Fix any potential issues with holographic cards
  const holographicCards = document.querySelectorAll('.holographic-card');
  holographicCards.forEach(card => {
    // Ensure card effects don't interfere with scrolling
    const existingMouseMove = card.onmousemove;
    if (existingMouseMove) {
      card.onmousemove = null;
      card.addEventListener('mousemove', existingMouseMove, { passive: true });
    }
  });
  
  // Ensure particles don't block scrolling
  const particlesContainer = document.getElementById('particles-js');
  if (particlesContainer) {
    particlesContainer.style.pointerEvents = 'none';
  }
  
  // Fix any potential issues with fixed position elements
  const fixedElements = document.querySelectorAll('.fixed-position');
  fixedElements.forEach(el => {
    el.style.willChange = 'transform';
  });
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