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

function displayHistoricalData(data) {
  console.group('Historical Data Debug');
  console.log('Full data received:', data);
  console.log('eBay Records:', data.data.length);
  
  // Update debug badges if they exist
  const ebayDebugBadge = document.getElementById('ebayHistoryDebug');
  if (ebayDebugBadge) {
    ebayDebugBadge.textContent = `Records: ${data.data.length}`;
  }

  // Clear existing table content
  const ebayTableBody = document.getElementById('ebay-history-table');
  if (!ebayTableBody) {
    console.error('eBay history table not found');
    return;
  }
  ebayTableBody.innerHTML = '';

  // Display eBay historical data
  data.data.forEach(record => {
    console.log('Processing eBay record:', record);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(record.timestamp).toLocaleDateString()}</td>
      <td>$${record.avg_price.toFixed(2)}</td>
      <td>$${record.high_price.toFixed(2)}</td>
      <td>$${record.low_price.toFixed(2)}</td>
      <td>${record.total_sales}</td>
      <td>
        <canvas class="sparkline" width="100" height="30"></canvas>
      </td>
    `;
    ebayTableBody.appendChild(row);
    
    // Draw sparkline
    const ctx = row.querySelector('.sparkline').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.data.slice(-7).map(h => new Date(h.timestamp).toLocaleDateString()),
        datasets: [{
          data: data.data.slice(-7).map(h => h.avg_price),
          borderColor: '#007bff',
          borderWidth: 1,
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { display: false }, y: { display: false } },
        plugins: { legend: { display: false } }
      }
    });
  });

  console.groupEnd();
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

function loadHistoricalData(query) {
  console.log('Requesting historical data for:', query);
  
  fetch(`/api/history/${encodeURIComponent(query)}`)
    .then(response => {
      console.log('Historical data response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Historical data received:', data);
      
      if (!data.success) {
        console.error('Error in historical data:', data.error);
        return;
      }
      
      if (!data.data || !data.data.length) {
        console.log('No historical data available yet');
        return;
      }

      displayHistoricalData(data);
    })
    .catch(error => {
      console.error('Error fetching historical data:', error);
    });
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