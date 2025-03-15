# eBay Sold Items Price Tracker

A powerful web application that tracks and analyzes eBay sold item prices, providing historical data analysis and price alerts.

## Features

- **eBay Price Analysis**
  - Search sold item listings with real-time results
  - View comprehensive price statistics:
    - Average price
    - Highest price
    - Lowest price
    - Total sales volume
  - Interactive price history charts with sparklines
  - Detailed sold item listings with direct eBay links
  - Product images with fallback support

- **Historical Data Tracking**
  - Automated price tracking over time
  - Trend visualization with sparkline charts
  - Price movement indicators
  - Detailed historical records with:
    - Date-wise price aggregation
    - Sales volume tracking
    - High/low price points

- **User Features**
  - User authentication with multiple options:
    - Email/password registration
    - Google login
    - Apple login
    - Facebook login
  - Personalized wishlist management
  - Price alert system with email notifications
  - User reviews and ratings

- **Advanced Features**
  - Rate limiting for API protection
  - Proxy support with rotation
  - Caching system for improved performance
  - Responsive design for all devices
  - Real-time price alerts
  - Duplicate entry prevention

## Technical Stack

- **Frontend**
  - HTML5/CSS3/JavaScript
  - Bootstrap 5 for responsive design
  - Font Awesome icons
  - Chart.js for data visualization
  - Custom animations and transitions

- **Backend**
  - Node.js with Express
  - SQLite3 for data persistence
  - Better-SQLite3 for improved performance
  - JWT for authentication
  - Cheerio for web scraping
  - Winston for logging

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ebay-sold-scrapper.git
   cd ebay-sold-scrapper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with required environment variables:
   ```env
   PORT=3001
   JWT_SECRET=your_jwt_secret
   REFRESH_SECRET=your_refresh_secret
   EMAIL_SERVICE_API_KEY=your_email_api_key
   ```

4. Initialize the database:
   ```bash
   node database.js
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Access the application at `http://localhost:3001`
2. Create an account or log in
3. Enter a product name in the search bar
4. View real-time price analysis and historical data
5. Set up price alerts for tracked items
6. Add items to your wishlist for easy tracking

## API Endpoints

- **Search**
  - `POST /api/search` - Search for eBay sold items
  - `GET /api/history/:query` - Get historical price data

- **Authentication**
  - `POST /api/auth/register` - Register new user
  - `POST /api/auth/login` - User login
  - `POST /api/auth/refresh` - Refresh access token

- **Wishlist**
  - `GET /api/wishlist` - Get user's wishlist
  - `POST /api/wishlist` - Add item to wishlist
  - `DELETE /api/wishlist/:id` - Remove item from wishlist

- **Price Alerts**
  - `POST /api/price-alerts` - Create price alert
  - `GET /api/price-alerts` - Get user's price alerts

## Security Features

- JWT-based authentication
- Rate limiting protection
- SQL injection prevention
- XSS protection
- CORS configuration
- Secure password hashing

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- eBay for product data
- Bootstrap team for UI components
- Chart.js for visualization tools
- Open source community for various tools and libraries


