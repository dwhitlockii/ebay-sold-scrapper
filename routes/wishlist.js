const express = require('express');
const router = express.Router();
const { validate, validations } = require('../utils/validator');
const { security } = require('../utils/security');
const { logger } = require('../utils/logger');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all wishlist items for a user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const items = await db.getWishlistItems(req.user.id);
        
        res.json({
            success: true,
            items
        });
    } catch (error) {
        logger.error('Error fetching wishlist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wishlist items'
        });
    }
});

// Add item to wishlist
router.post('/', [
    body('productName').trim().notEmpty().withMessage('Product name is required'),
    body('targetPrice').isFloat({ min: 0 }).withMessage('Target price must be a positive number')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { productName, targetPrice } = req.body;
        const id = await db.addToWishlist(productName, targetPrice);
        res.status(201).json({
            success: true,
            id,
            message: 'Item added to wishlist'
        });
    } catch (error) {
        logger.error('Error adding to wishlist:', error);
        res.status(500).json({ error: 'Failed to add item to wishlist' });
    }
});

// Update wishlist item
router.put('/:id', authenticateToken, validate(validations.wishlist.update), async (req, res) => {
    try {
        const { id } = req.params;
        const { targetPrice, notifyOnPriceBelow } = req.body;

        // Verify ownership
        const item = await db.getWishlistItem(id);
        if (!item || item.user_id !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist item not found'
            });
        }

        // Update item
        const updatedItem = await db.updateWishlistItem(id, {
            targetPrice,
            notifyOnPriceBelow
        });

        logger.info('Wishlist item updated', { 
            userId: req.user.id, 
            itemId: id 
        });

        res.json({
            success: true,
            item: updatedItem
        });
    } catch (error) {
        logger.error('Error updating wishlist item:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update wishlist item'
        });
    }
});

// Delete wishlist item
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const item = await db.getWishlistItem(id);
        if (!item || item.user_id !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist item not found'
            });
        }

        // Delete item and associated price alerts
        await db.deleteWishlistItem(id);

        logger.info('Wishlist item deleted', { 
            userId: req.user.id, 
            itemId: id 
        });

        res.json({
            success: true,
            message: 'Wishlist item deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting wishlist item:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete wishlist item'
        });
    }
});

// Get price history for wishlist item
router.get('/:id/history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { days = 30 } = req.query;

        // Verify ownership
        const item = await db.getWishlistItem(id);
        if (!item || item.user_id !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist item not found'
            });
        }

        // Get price history
        const history = await db.getItemPriceHistory(id, days);

        res.json({
            success: true,
            history
        });
    } catch (error) {
        logger.error('Error fetching price history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch price history'
        });
    }
});

// Get price alerts for wishlist item
router.get('/:id/alerts', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const item = await db.getWishlistItem(id);
        if (!item || item.user_id !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist item not found'
            });
        }

        // Get alerts
        const alerts = await db.getItemPriceAlerts(id);

        res.json({
            success: true,
            alerts
        });
    } catch (error) {
        logger.error('Error fetching price alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch price alerts'
        });
    }
});

// Create price alert for wishlist item
router.post('/:id/alerts', authenticateToken, validate(validations.alerts.create), async (req, res) => {
    try {
        const { id } = req.params;
        const { targetPrice, notificationType } = req.body;

        // Verify ownership
        const item = await db.getWishlistItem(id);
        if (!item || item.user_id !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist item not found'
            });
        }

        // Create alert
        const alert = await db.createPriceAlert({
            wishlistItemId: id,
            targetPrice,
            notificationType
        });

        logger.info('Price alert created', { 
            userId: req.user.id, 
            itemId: id,
            alertId: alert.id
        });

        res.status(201).json({
            success: true,
            alert
        });
    } catch (error) {
        logger.error('Error creating price alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create price alert'
        });
    }
});

// Delete price alert
router.delete('/:itemId/alerts/:alertId', authenticateToken, async (req, res) => {
    try {
        const { itemId, alertId } = req.params;

        // Verify ownership
        const item = await db.getWishlistItem(itemId);
        if (!item || item.user_id !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist item not found'
            });
        }

        // Delete alert
        await db.deletePriceAlert(alertId);

        logger.info('Price alert deleted', { 
            userId: req.user.id, 
            itemId,
            alertId
        });

        res.json({
            success: true,
            message: 'Price alert deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting price alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete price alert'
        });
    }
});

// Remove item from wishlist
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.removeFromWishlist(req.params.id);
        if (result.changes > 0) {
            res.json({
                success: true,
                message: 'Item removed from wishlist'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Item not found in wishlist'
            });
        }
    } catch (error) {
        logger.error('Error removing from wishlist:', error);
        res.status(500).json({ error: 'Failed to remove item from wishlist' });
    }
});

module.exports = router; 