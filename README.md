
# eBay Sold Items Analyzer

## Overview
This web application scrapes and analyzes eBay sold item listings to provide insights on market values. It helps users research the actual selling prices of items to make informed buying or selling decisions.

## Features
- Search for any item sold on eBay
- View average, highest, and lowest selling prices
- See total number of recent sales
- Visualize sales trends over time with an interactive chart

## Technology Stack
- **Backend**: Node.js with Express
- **Web Scraping**: Axios and Cheerio
- **Frontend**: HTML, CSS, JavaScript with Bootstrap
- **Data Visualization**: Chart.js

## Installation

### Prerequisites
- Node.js (v12 or higher)
- npm (Node Package Manager)

### Steps

1. Clone the repository:
   ```
   git clone <your-repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd ebay-sold-scraper
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the application:
   ```
   npm start
   ```

5. Open your browser and go to:
   ```
   http://localhost:3000
   ```

## Usage
1. Enter the name of an item you want to research in the search box
2. Click "Search" or press Enter
3. View the results showing average price, price range, and sales volume
4. Analyze the sales trend chart to understand market patterns

## Limitations
- This application is for educational and personal use only
- Web scraping may be subject to eBay's terms of service
- Results may vary as eBay's website structure changes

## License
This project is open source and available under the MIT License.
