# eBay & Amazon Price Scraper

## Overview

This project allows users to track and compare price history for products on eBay and Amazon. It features a responsive interface that displays historical price data, real-time price comparisons, and price tracking capabilities.

## Key Features

- **Historical Price Data**
  - View detailed price history for both eBay and Amazon
  - Compare trends between platforms
  - Analyze price fluctuations over time
  - Data presented in easy-to-read tables

- **Real-Time Price Tracking**
  - Search eBay sold listings
  - Track Amazon new/used prices
  - Visual price comparisons with charts
  - Daily sales tracking

- **User Features**
  - Wishlist management
  - Price alerts
  - User authentication
  - Customizable notifications

## Recent Updates

### 1. Enhanced Historical Data Display
- Historical data tables moved above product results for better visibility
- Separate tables for eBay and Amazon price history
- Improved data formatting and readability
- Automatic data refresh on new searches

### 2. Data Tables Structure

**eBay Price History Table:**
- Date
- Average Price
- Highest Price
- Lowest Price
- Total Sales

**Amazon Price History Table:**
- Date
- New Item Prices (Avg/High/Low)
- Used Item Prices (Avg/High/Low)
- Total Items (New/Used)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ebay-amazon-scraper.git
   cd ebay-amazon-scraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   node database.js
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`.

## File Structure

- `public/`
  - `index.html`: Main HTML file with the user interface
  - `style.css`: Custom CSS for styling
  - `main.js`: Client-side JavaScript for handling user interactions
  - `login.html`: HTML file for the login page
  - `login.js`: Client-side JavaScript for handling login interactions

- `database.js`: Database setup and functions
- `notifications.js`: Notification handling functions
- `.gitignore`: Git ignore file

## API Endpoints

- `/api/search/ebay`: Search for products on eBay
- `/api/search/amazon`: Search for products on Amazon
- `/api/wishlist`: Manage wishlist items
- `/api/reviews`: Submit and view user reviews

## Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Make your changes
4. Commit your changes (`git commit -am 'Add new feature'`)
5. Push to the branch (`git push origin feature-branch`)
6. Create a new Pull Request

## License

This project is licensed under the MIT License.


