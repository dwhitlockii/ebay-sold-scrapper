const express = require('express');
const router = express.Router();
const { logger } = require('../../utils/logger');
const database = require('../database');
const priceAnalytics = require('../analytics/priceAnalytics');

// Get market trends for a query - this route needs to be defined BEFORE the /:query route
router.get('/trends/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { days = 30 } = req.query;
        const history = await database.getEbayHistory(query, parseInt(days));

        if (!history || history.length === 0) {
            return res.status(404).json({
                error: 'No trend data found for this query'
            });
        }

        res.json(history);
    } catch (error) {
        logger.error('Error fetching market trends:', error);
        res.status(500).json({
            error: 'Failed to fetch market trends'
        });
    }
});

// Get advanced analytics for a query
router.get('/advanced/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { days = 30 } = req.query;

        const advancedAnalytics = await priceAnalytics.analyzePriceTrends(query, parseInt(days));

        if (!advancedAnalytics) {
            return res.status(404).json({
                error: 'No advanced analytics data found for this query'
            });
        }

        res.json(advancedAnalytics);
    } catch (error) {
        logger.error('Error fetching advanced analytics:', error);
        res.status(500).json({
            error: 'Failed to fetch advanced analytics data'
        });
    }
});

// Get analytics for a query
router.get('/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const analytics = await database.getAnalytics(query);

        if (!analytics) {
            return res.status(404).json({
                error: 'No analytics data found for this query'
            });
        }

        res.json(analytics);
    } catch (error) {
        logger.error('Error fetching analytics:', error);
        res.status(500).json({
            error: 'Failed to fetch analytics data'
        });
    }
});

// Force update analytics for a query
router.post('/update/:query', async (req, res) => {
    try {
        const { query } = req.params;
        await database.updateAnalytics(query);
        const analytics = await database.getAnalytics(query);
        
        res.json(analytics);
    } catch (error) {
        logger.error('Error updating analytics:', error);
        res.status(500).json({
            error: 'Failed to update analytics'
        });
    }
});

module.exports = router; 