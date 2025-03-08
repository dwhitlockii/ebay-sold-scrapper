// Developer: Dean Whitlock

// Get the search query
function getQuery() {
  return document.getElementById('itemQuery').value.trim();
}

function toggleSpinner(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (show) {
    spinner.classList.remove('d-none');
  } else {
    spinner.classList.add('d-none');
  }
}

function hideResults() {
  document.getElementById('ebayResults').classList.add('d-none');
  document.getElementById('amazonResults').classList.add('d-none');
}

// -------------------------
// eBay Search and Display
// -------------------------
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded');
    
  const ebaySearchBtn = document.getElementById('ebaySearchBtn');
  if (!ebaySearchBtn) {
    console.error('ebaySearchBtn not found in DOM');
    return;
  }

  ebaySearchBtn.addEventListener('click', async function() {
    console.log('Search button clicked');
    const query = document.getElementById('itemQuery').value;
    console.log('Search query:', query);

    if (!query) {
      console.warn('Empty query - aborting search');
      return;
    }

    const loadingSpinner = document.getElementById('loadingSpinner');
    if (!loadingSpinner) {
      console.error('Loading spinner element not found');
    }
    loadingSpinner.classList.remove('d-none');
    
    try {
      console.log('Fetching data from API...');
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      console.log('API Response status:', response.status);
      
      const data = await response.json();
      console.log('API Response data:', data);

      if (data.error) {
        console.error('API returned error:', data.error);
        alert(data.error);
        return;
      }

      // Display current results
      console.log('Displaying eBay results');
      displayEbayResults(data);

      // Get historical data
      console.log('Fetching historical data...');
      const historyResponse = await fetch(`/api/historical-data?q=${encodeURIComponent(query)}`);
      console.log('Historical data response status:', historyResponse.status);
      
      const historyData = await historyResponse.json();
      console.log('Historical data:', historyData);
      
      // Display historical data
      console.log('Displaying historical data');
      displayHistoricalData(historyData);

    } catch (error) {
      console.error('Error during search:', error);
      console.error('Error stack:', error.stack);
      alert('Error fetching data. Check the console for details.');
    } finally {
      console.log('Search operation completed');
      loadingSpinner.classList.add('d-none');
    }
  });
});

function displayEbayResults(data) {
  console.log('Starting displayEbayResults with data:', data);
    
  if (data.error) {
    console.error('Error in data:', data.error);
    alert(data.error);
    return;
  }
  
  try {
    // Update price alert elements
    const currentPrice = data.aggregates.avgPrice;
    console.log('Current average price:', currentPrice);
    
    const alertPriceElement = document.getElementById('alertPrice');
    const currentPriceElement = document.getElementById('currentPrice');
    
    if (!alertPriceElement || !currentPriceElement) {
      console.error('Price alert elements not found');
    } else {
      alertPriceElement.textContent = `$${currentPrice.toFixed(2)}`;
      currentPriceElement.dataset.price = currentPrice;
    }

    // Update results display
    const ebayResults = document.getElementById('ebayResults');
    if (!ebayResults) {
      console.error('ebayResults element not found');
      return;
    }

    ebayResults.classList.remove('d-none');
    
    // Update prices
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

    // Update values if elements exist
    if (elements.avgPrice) elements.avgPrice.textContent = `$${data.aggregates.avgPrice}`;
    if (elements.highPrice) elements.highPrice.textContent = `$${data.aggregates.highPrice}`;
    if (elements.lowPrice) elements.lowPrice.textContent = `$${data.aggregates.lowPrice}`;
    if (elements.totalSales) elements.totalSales.textContent = data.aggregates.totalSales;

    const ctx = document.getElementById('salesChart').getContext('2d');
    const chartData = data.aggregates.salesOverTime;

    if (window.salesChartInstance) {
      window.salesChartInstance.destroy();
    }

    window.salesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.dates,
        datasets: [{
          label: 'Daily Sales Count',
          data: chartData.counts,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });

    // NEW: Display the list of sold items with title and link.
    const itemListContainer = document.getElementById('ebayItemList');
    const listGroup = itemListContainer.querySelector('ul');
    listGroup.innerHTML = '';
    data.items.forEach(item => {
      const listItem = document.createElement('li');
      listItem.className = 'list-group-item';
      listItem.innerHTML = `<a href="${item.link}" target="_blank">${item.title}</a> - $${item.soldPrice}`;
      listGroup.appendChild(listItem);
    });

    // New: Display item image
    document.getElementById('ebayItemImage').src = data.itemImage;

    console.log('Successfully displayed eBay results');
  } catch (error) {
    console.error('Error in displayEbayResults:', error);
    console.error('Error stack:', error.stack);
  }
}

function displayHistoricalData(data) {
  console.group('Historical Data Debug');
  console.log('Full data received:', data);
  console.log('eBay Records:', data.ebayHistory.length);
  
  // Update debug badges if they exist
  const ebayDebugBadge = document.getElementById('ebayHistoryDebug');
  if (ebayDebugBadge) {
    ebayDebugBadge.textContent = `Records: ${data.ebayHistory.length}`;
  }

  // Clear existing table content
  const ebayTableBody = document.getElementById('ebay-history-table');
  if (!ebayTableBody) {
    console.error('eBay history table not found');
    return;
  }
  ebayTableBody.innerHTML = '';

  // Display eBay historical data
  data.ebayHistory.forEach(record => {
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
        labels: data.ebayHistory.slice(-7).map(h => new Date(h.timestamp).toLocaleDateString()),
        datasets: [{
          data: data.ebayHistory.slice(-7).map(h => h.avg_price),
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
document.getElementById('amazonSearchBtn').addEventListener('click', function () {
  const query = getQuery();
  if (!query) {
    alert('Please enter an item name.');
    return;
  }
  hideResults();
  toggleSpinner(true);
  fetch(`/api/search/amazon?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      toggleSpinner(false);
      displayAmazonResults(data);
      loadHistoricalData(query);
    })
    .catch(error => {
      toggleSpinner(false);
      console.error('Error:', error);
      alert('Error fetching Amazon data. Check the console for details.');
    });
});

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

// Check if user is logged in
function checkLoginStatus() {
  const token = localStorage.getItem('token');
  if (token) {
    document.getElementById('loginOptionsSection').classList.add('d-none');
  }
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

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  checkLoginStatus();

  document.getElementById('wishlistForm').addEventListener('submit', addToWishlist);

  document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  });

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

function loadHistoricalData(query) {
  console.log('Requesting historical data for:', query);
  
  fetch(`/api/historical-data?q=${encodeURIComponent(query)}`)
    .then(response => {
      console.log('Historical data response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Historical data received:', data);
      
      if (data.error) {
        console.error('Error in historical data:', data.error);
        return;
      }
      
      if (!data.ebayHistory.length) {
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