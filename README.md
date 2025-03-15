# eBay Sold Items Scraper

A Node.js application that tracks and analyzes eBay sold items data, providing insights into pricing trends and market values.

## Features

- Search and track eBay sold items
- User authentication and authorization
- Wishlist management
- Price alerts
- Historical price tracking
- Rate limiting and security measures
- Caching for improved performance
- Comprehensive logging and monitoring

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- SQLite3

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ebay-sold-scraper.git
   cd ebay-sold-scraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=your_session_secret
   EBAY_APP_ID=your_ebay_app_id
   EBAY_CERT_ID=your_ebay_cert_id
   EBAY_DEV_ID=your_ebay_dev_id
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX_REQUESTS=100
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh access token

### Search
- `GET /search` - Search for sold items
- `GET /search/history` - Get user's search history
- `GET /search/stats` - Get search statistics

### Wishlist
- `GET /wishlist` - Get user's wishlist
- `POST /wishlist` - Add item to wishlist
- `DELETE /wishlist/:id` - Remove item from wishlist
- `PUT /wishlist/:id` - Update wishlist item

### Price Alerts
- `GET /alerts` - Get user's price alerts
- `POST /alerts` - Create new price alert
- `DELETE /alerts/:id` - Delete price alert
- `PUT /alerts/:id` - Update price alert

## Security Features

- CORS protection
- Helmet security headers
- Rate limiting
- Input sanitization
- SQL injection prevention
- Session management
- Token blacklisting

## Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure
```
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
├── tests/
└── server.js
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- eBay API Documentation
- Node.js community
- Express.js team


