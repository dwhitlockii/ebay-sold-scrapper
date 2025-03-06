
// Get the search query
function getQuery() {
  return document.getElementById('itemQuery').value.trim();
}

// -------------------------
// eBay Search and Display
// -------------------------
document.getElementById('ebaySearchBtn').addEventListener('click', function() {
  const query = getQuery();
  if (!query) {
    alert('Please enter an item name.');
    return;
  }
  // Hide Amazon results in case they were previously shown
  document.getElementById('amazonResults').style.display = 'none';

  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => displayEbayResults(data))
    .catch(error => {
      console.error('Error:', error);
      alert('Error fetching eBay data. Check the console for details.');
    });
});

function displayEbayResults(data) {
  if (data.error) {
    alert(data.error);
    return;
  }
  document.getElementById('ebayResults').style.display = 'block';
  document.getElementById('avgPrice').textContent = `$${data.aggregates.avgPrice}`;
  document.getElementById('highPrice').textContent = `$${data.aggregates.highPrice}`;
  document.getElementById('lowPrice').textContent = `$${data.aggregates.lowPrice}`;
  document.getElementById('totalSales').textContent = data.aggregates.totalSales;

  const ctx = document.getElementById('salesChart').getContext('2d');
  const chartData = data.aggregates.salesOverTime;

  // Destroy any previous chart instance
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
}

// -------------------------
// Amazon Search and Display
// -------------------------
document.getElementById('amazonSearchBtn').addEventListener('click', function() {
  const query = getQuery();
  if (!query) {
    alert('Please enter an item name.');
    return;
  }
  // Hide eBay results when searching Amazon
  document.getElementById('ebayResults').style.display = 'none';

  fetch(`/api/search/amazon?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => displayAmazonResults(data))
    .catch(error => {
      console.error('Error:', error);
      alert('Error fetching Amazon data. Check the console for details.');
    });
});

function displayAmazonResults(data) {
  if (data.error) {
    alert(data.error);
    return;
  }
  document.getElementById('amazonResults').style.display = 'block';
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

  // Create a simple bar chart comparing average prices.
  const ctx = document.getElementById('amazonChart').getContext('2d');
  const newAvg = data.aggregates.new.avgNew || 0;
  const usedAvg = data.aggregates.used.avgUsed || 0;

  // Destroy any previous chart instance
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
