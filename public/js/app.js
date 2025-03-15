// Main search function
async function searchEbay(query) {
    try {
        showLoading();
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();
        displayResults(data);
        
        // After displaying results, fetch and display history
        await fetchAndDisplayHistory(query);
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to search eBay');
        hideLoading();
    }
}

// Function to fetch search history
async function fetchAndDisplayHistory(query = '') {
    try {
        const response = await fetch(`/api/search/history/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch search history');
        }
        
        displayHistory(data.history);
    } catch (error) {
        console.error('Error fetching history:', error);
        const historyContainer = document.getElementById('searchHistory');
        if (historyContainer) {
            historyContainer.innerHTML = '<p class="error">Failed to load search history</p>';
        }
    }
}

// Function to display search history
function displayHistory(history) {
    const historyContainer = document.getElementById('searchHistory');
    if (!historyContainer) return;

    historyContainer.innerHTML = '';
    if (!history || history.length === 0) {
        historyContainer.innerHTML = '<p>No search history available.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'history-table';
    
    // Create table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Query</th>
            <th>Average Price</th>
            <th>High Price</th>
            <th>Low Price</th>
            <th>Total Sales</th>
            <th>Date</th>
        </tr>
    `;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    history.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.query}</td>
            <td>$${item.avg_price?.toFixed(2) || 'N/A'}</td>
            <td>$${item.high_price?.toFixed(2) || 'N/A'}</td>
            <td>$${item.low_price?.toFixed(2) || 'N/A'}</td>
            <td>${item.total_sales || 0}</td>
            <td>${new Date(item.timestamp).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    historyContainer.appendChild(table);
}

// Function to display search results
function displayResults(data) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';
    if (!data.items || data.items.length === 0) {
        resultsContainer.innerHTML = '<p>No results found.</p>';
        return;
    }

    // Display statistics
    const statsHtml = `
        <div class="stats">
            <h3>Statistics</h3>
            <p>Total Items: ${data.stats.count}</p>
            <p>Average Price: $${data.stats.average.toFixed(2)}</p>
            <p>Highest Price: $${data.stats.max.toFixed(2)}</p>
            <p>Lowest Price: $${data.stats.min.toFixed(2)}</p>
            <p>Median Price: $${data.stats.median.toFixed(2)}</p>
        </div>
    `;
    resultsContainer.innerHTML = statsHtml;

    // Display items
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'items-grid';
    
    data.items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <img src="${item.imageUrl || '/images/placeholder.png'}" alt="${item.title}" onerror="this.src='/images/placeholder.png'">
            <h4>${item.title}</h4>
            <p class="price">$${item.price.toFixed(2)}</p>
            <p class="sold-date">${item.soldDate}</p>
            <a href="${item.link}" target="_blank" rel="noopener noreferrer">View on eBay</a>
        `;
        itemsContainer.appendChild(itemCard);
    });
    
    resultsContainer.appendChild(itemsContainer);
}

// Function to display error messages
function displayError(message) {
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="error">${message}</div>`;
    }
}

// Function to show loading indicator
function showLoading() {
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="loading">Searching eBay...</div>';
    }
}

// Function to hide loading indicator
function hideLoading() {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput && searchInput.value.trim()) {
                await searchEbay(searchInput.value.trim());
            }
        });
    }

    // Load initial history
    fetchAndDisplayHistory();
}); 