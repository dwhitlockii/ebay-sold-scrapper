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
  document.getElementById('priceHistoryCard').classList.add('d-none');
}

// Load price history for a query
function loadPriceHistory(query) {
  fetch(`/api/price-history?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      if (data.error || !data.history || data.history.length === 0) {
        console.log('No price history available yet');
        return;
      }
      
      displayPriceHistory(data.history);
    })
    .catch(error => {
      console.error('Error fetching price history:', error);
    });
}

// Display price history data
function displayPriceHistory(historyData) {
  const priceHistoryCard = document.getElementById('priceHistoryCard');
  priceHistoryCard.classList.remove('d-none');
  
  // Prepare data for chart
  const labels = historyData.map(item => {
    const date = new Date(item.search_date);
    return date.toLocaleDateString();
  });
  
  const ebayData = historyData.map(item => item.ebay_avg_price || null);
  const amazonNewData = historyData.map(item => item.amazon_avg_new_price || null);
  const amazonUsedData = historyData.map(item => item.amazon_avg_used_price || null);
  
  // Reverse arrays to show oldest to newest
  labels.reverse();
  ebayData.reverse();
  amazonNewData.reverse();
  amazonUsedData.reverse();
  
  // Create history chart
  const ctx = document.getElementById('historyChart').getContext('2d');
  
  if (window.historyChartInstance) {
    window.historyChartInstance.destroy();
  }
  
  window.historyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'eBay Avg Price',
          data: ebayData,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1,
          fill: false
        },
        {
          label: 'Amazon New Avg',
          data: amazonNewData,
          borderColor: 'rgba(40, 167, 69, 1)',
          backgroundColor: 'rgba(40, 167, 69, 0.2)',
          tension: 0.1,
          fill: false
        },
        {
          label: 'Amazon Used Avg',
          data: amazonUsedData,
          borderColor: 'rgba(255, 193, 7, 1)',
          backgroundColor: 'rgba(255, 193, 7, 0.2)',
          tension: 0.1,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return '$' + value;
            }
          }
        }
      }
    }
  });
  
  // Populate history table
  const tableBody = document.getElementById('historyTableBody');
  tableBody.innerHTML = '';
  
  historyData.forEach(item => {
    const row = document.createElement('tr');
    
    const dateCell = document.createElement('td');
    dateCell.textContent = new Date(item.search_date).toLocaleDateString();
    
    const ebayCell = document.createElement('td');
    ebayCell.textContent = item.ebay_avg_price ? `$${item.ebay_avg_price}` : 'N/A';
    
    const amazonNewCell = document.createElement('td');
    amazonNewCell.textContent = item.amazon_avg_new_price ? `$${item.amazon_avg_new_price}` : 'N/A';
    
    const amazonUsedCell = document.createElement('td');
    amazonUsedCell.textContent = item.amazon_avg_used_price ? `$${item.amazon_avg_used_price}` : 'N/A';
    
    row.appendChild(dateCell);
    row.appendChild(ebayCell);
    row.appendChild(amazonNewCell);
    row.appendChild(amazonUsedCell);
    
    tableBody.appendChild(row);
  });
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
      
      // Load price history after successful search
      loadPriceHistory(query);
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
      
      // Load price history after successful search
      loadPriceHistory(query);
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
}
