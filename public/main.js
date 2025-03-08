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
document.getElementById('ebaySearchBtn').addEventListener('click', function () {
  const query = getQuery();
  if (!query) {
    alert('Please enter an item name.');
    return;
  }
  hideResults();
  toggleSpinner(true);
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      toggleSpinner(false);
      displayEbayResults(data);
      loadHistoricalData(query);
    })
    .catch(error => {
      toggleSpinner(false);
      console.error('Error:', error);
      alert('Error fetching eBay data. Check the console for details.');
    });
});

function displayEbayResults(data) {
  if (data.error) {
    alert(data.error);
    return;
  }
  const ebayResults = document.getElementById('ebayResults');
  ebayResults.classList.remove('d-none');
  document.getElementById('avgPrice').textContent = `$${data.aggregates.avgPrice}`;
  document.getElementById('highPrice').textContent = `$${data.aggregates.highPrice}`;
  document.getElementById('lowPrice').textContent = `$${data.aggregates.lowPrice}`;
  document.getElementById('totalSales').textContent = data.aggregates.totalSales;

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
  // New Items aggregates
  document.getElementById('avgNewPrice').textContent = data.aggregates.new.avgNew ? `$${data.aggregates.new.avgNew}` : "N/A";
  document.getElementById('highNewPrice').textContent = data.aggregates.new.highNew ? `$${data.aggregates.new.highNew}` : "N/A";
  document.getElementById('lowNewPrice').textContent = data.aggregates.new.lowNew ? `$${data.aggregates.new.lowNew}` : "N/A";
  document.getElementById('totalNew').textContent = data.aggregates.new.totalNew || 0;

  // Used Items aggregates
  document.getElementById('avgUsedPrice').textContent = data.aggregates.used.avgUsed ? `$${data.aggregates.used.avgUsed}` : "N/A";
  document.getElementById('highUsedPrice').textContent = data.aggregates.used.highUsed ? `$${data.aggregates.used.highUsed}` : "N/A";
  document.getElementById('lowUsedPrice').textContent = data.aggregates.used.lowUsed ? `$${data.aggregates.used.lowUsed}` : "N/A";
  document.getElementById('totalUsed').textContent = data.aggregates.used.totalUsed || 0;

  const ctx = document.getElementById('amazonChart').getContext('2d');
  const newAvg = data.aggregates.new.avgNew || 0;
  const usedAvg = data.aggregates.used.avgUsed || 0;

  if (window.amazonChartInstance) {
    window.amazonChartInstance.destroy();
  }

  window.amazonChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['New', 'Used'],
      datasets: [{
        label: 'Average Price',
        data: [newAvg, usedAvg],
        backgroundColor: ['rgba(40, 167, 69, 0.6)', 'rgba(255, 193, 7, 0.6)'],
        borderColor: ['rgba(40,167,69,1)', 'rgba(255,193,7,1)'],
        borderWidth: 1
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

  // New: Display item image
  document.getElementById('amazonItemImage').src = data.itemImage;
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
      
      if (!data.ebayHistory.length && !data.amazonHistory.length) {
        console.log('No historical data available yet');
        return;
      }

      displayHistoricalData(data);
    })
    .catch(error => {
      console.error('Error fetching historical data:', error);
    });
}

function displayHistoricalData(data) {
  console.log('Displaying historical data:', data);
  const ebayHistory = data.ebayHistory;
  const amazonHistory = data.amazonHistory;

  // Display eBay historical data
  const ebayTableBody = document.getElementById('ebay-history-table');
  ebayTableBody.innerHTML = '';
  ebayHistory.forEach(record => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(record.timestamp).toLocaleDateString()}</td>
      <td>$${record.avg_price.toFixed(2)}</td>
      <td>$${record.high_price.toFixed(2)}</td>
      <td>$${record.low_price.toFixed(2)}</td>
      <td>${record.total_sales}</td>
    `;
    ebayTableBody.appendChild(row);
  });

  // Display Amazon historical data
  const amazonTableBody = document.getElementById('amazon-history-table');
  amazonTableBody.innerHTML = '';
  
  if (amazonHistory.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="9" class="text-center">No Amazon price history available</td>';
    amazonTableBody.appendChild(row);
  } else {
    amazonHistory.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(record.timestamp).toLocaleDateString()}</td>
        <td>${record.avg_new_price ? `$${record.avg_new_price.toFixed(2)}` : 'N/A'}</td>
        <td>${record.high_new_price ? `$${record.high_new_price.toFixed(2)}` : 'N/A'}</td>
        <td>${record.low_new_price ? `$${record.low_new_price.toFixed(2)}` : 'N/A'}</td>
        <td>${record.total_new || 0}</td>
        <td>${record.avg_used_price ? `$${record.avg_used_price.toFixed(2)}` : 'N/A'}</td>
        <td>${record.high_used_price ? `$${record.high_used_price.toFixed(2)}` : 'N/A'}</td>
        <td>${record.low_used_price ? `$${record.low_used_price.toFixed(2)}` : 'N/A'}</td>
        <td>${record.total_used || 0}</td>
      `;
      amazonTableBody.appendChild(row);
    });
  }
}