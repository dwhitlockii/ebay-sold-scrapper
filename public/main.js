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
    const listItem = document