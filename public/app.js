// Replace the init function to remove Amazon parts
async function init() {
    // Add event listener for Enter key
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchEbay();
        }
    });
}

// Keep only eBay search function
async function searchEbay() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.error) {
            document.getElementById('ebayStats').innerHTML = `<p class="error">${data.error}</p>`;
            return;
        }

        displayEbayResults(data);
    } catch (error) {
        console.error('Error fetching eBay data:', error);
        document.getElementById('ebayStats').innerHTML = '<p class="error">Error fetching eBay data</p>';
    }
}

// Keep existing eBay display functions
// ...rest of the existing eBay-related code...
