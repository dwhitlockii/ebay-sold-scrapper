# eBay & Amazon Price Scraper

## Overview

This project allows users to scrape and compare historical price data for products sold on eBay and Amazon. It provides a user-friendly interface to search for products, view historical price data, and manage a wishlist.

## Features

- Search for products on eBay and Amazon
- View historical price data for eBay and Amazon
- Track price changes over time with charts
- Manage a wishlist with target prices
- User authentication and login options

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

## New Features

### Historical Data Section

The historical data section has been moved above the eBay Sold Items Aggregate section for better visibility. It includes two tables:

- **eBay Price History**: Displays historical price data for eBay.
- **Amazon Price History**: Displays historical price data for Amazon.

### Wishlist Management

Users can add products to their wishlist with optional target prices. The wishlist is displayed in a table format with options to remove items.

### User Reviews

Users can submit reviews and ratings for products. Reviews are displayed in a table format.

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


