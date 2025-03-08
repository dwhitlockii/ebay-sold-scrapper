# eBay & Amazon Price Tracker

A web application that tracks sold item prices on eBay and Amazon, with historical data analysis and price alerts.

## Features

- **eBay Price Tracking**
  - Search sold item listings
  - View average, high, and low prices
  - Track total sales volume
  - Interactive price history charts
  - Detailed sold item listings with links

- **Amazon Price Tracking**
  - Current product price lookup
  - Product images and links
  - Price history tracking

- **Historical Data Analysis**
  - Price trends over time
  - Sales volume trends
  - Sparkline visualizations
  - Daily price aggregates

- **User Features**
  - User authentication
  - Wishlist management
  - Price alerts
  - Email notifications

- **Data Visualization**
  - Interactive charts using Chart.js
  - Sales trend analysis
  - Price movement indicators
  - Historical comparisons

## Technical Stack

- **Frontend**
  - HTML5/CSS3/JavaScript
  - Bootstrap 5
  - Chart.js for visualizations
  - Responsive design

- **Backend**
  - Node.js with Express
  - SQLite3 database
  - JWT authentication
  - Web scraping with Cheerio

- **Features**
  - Rate limiting
  - Proxy support
  - User agent rotation
  - Error logging
  - Caching system

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


