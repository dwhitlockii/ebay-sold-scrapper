
document.getElementById('searchForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const query = document.getElementById('itemQuery').value.trim();
  if (!query) {
    alert('Please enter an item name.');
    return;
  }
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => displayResults(data))
    .catch(error => {
      console.error('Error:', error);
      alert('Error fetching data. Check the console for details.');
    });
});

function displayResults(data) {
  // Display aggregate data
  document.getElementById('avgPrice').textContent = `$${data.aggregates.avgPrice}`;
  document.getElementById('highPrice').textContent = `$${data.aggregates.highPrice}`;
  document.getElementById('lowPrice').textContent = `$${data.aggregates.lowPrice}`;
  document.getElementById('totalSales').textContent = data.aggregates.totalSales;
  
  // Show the results section
  document.getElementById('results').style.display = 'block';
  
  // Create a chart if Chart.js is available
  if (typeof Chart !== 'undefined') {
    const ctx = document.getElementById('salesChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.aggregates.salesOverTime.dates,
        datasets: [{
          label: 'Sales per Day',
          data: data.aggregates.salesOverTime.counts,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }
}
