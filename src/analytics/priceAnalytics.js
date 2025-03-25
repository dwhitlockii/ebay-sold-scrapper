const { logger } = require('../../utils/logger');
const { getEbayHistory } = require('../database');

class PriceAnalytics {
    constructor() {
        this.priceHistory = [];
        this.marketTrends = {};
    }

    async analyzePriceTrends(query, days = 30) {
        try {
            logger.info(`Analyzing price trends for query: ${query}, days: ${days}`);
            const history = await getEbayHistory(query, days);

            if (!history || history.length === 0) {
                logger.warn(`No history data found for query: ${query}`);
                return null;
            }

            logger.info(`Found ${history.length} data points for analysis`);

            // Ensure all required fields are present and properly formatted
            const validatedHistory = history.map(item => ({
                avg_price: parseFloat(item.avg_price) || 0,
                max_price: parseFloat(item.max_price) || 0,
                min_price: parseFloat(item.min_price) || 0,
                total_sales: parseInt(item.total_sales) || 0,
                date: item.date || item.timestamp || new Date().toISOString().split('T')[0],
                timestamp: item.timestamp || item.date || new Date().toISOString(),
                seller_id: item.seller_id || 'unknown'
            }));

            // Calculate price trends
            const trends = this.calculatePriceTrends(validatedHistory);

            // Calculate market demand
            const demand = this.calculateMarketDemand(validatedHistory);

            // Generate price predictions
            const predictions = this.generatePricePredictions(validatedHistory);

            // Analyze seasonal patterns
            const seasonalPatterns = this.analyzeSeasonalPatterns(validatedHistory);

            const result = {
                query,
                dataPoints: validatedHistory.length,
                timeRange: `${days} days`,
                trends,
                demand,
                predictions,
                seasonalPatterns,
                confidence: this.calculateConfidence(validatedHistory)
            };

            logger.info(`Analysis completed for query: ${query}`);
            return result;
        } catch (error) {
            logger.error('Error analyzing price trends:', error);
            throw error;
        }
    }

    calculatePriceTrends(history) {
        const prices = history.map(h => h.avg_price);
        const dates = history.map(h => new Date(h.timestamp));
        
        // Calculate moving averages
        const movingAverages = this.calculateMovingAverages(prices);
        
        // Calculate price volatility
        const volatility = this.calculateVolatility(prices);
        
        // Identify price patterns
        const patterns = this.identifyPricePatterns(prices);

        return {
            movingAverages,
            volatility,
            patterns,
            currentTrend: this.determineCurrentTrend(prices)
        };
    }

    calculateMarketDemand(history) {
        const sales = history.map(h => h.total_sales);
        const prices = history.map(h => h.avg_price);
        
        // Calculate demand elasticity
        const elasticity = this.calculateDemandElasticity(prices, sales);
        
        // Analyze sales velocity
        const salesVelocity = this.calculateSalesVelocity(sales);
        
        // Determine market saturation
        const saturation = this.calculateMarketSaturation(history);

        return {
            elasticity,
            salesVelocity,
            saturation,
            demandScore: this.calculateDemandScore(history)
        };
    }

    generatePricePredictions(history) {
        const prices = history.map(h => h.avg_price);
        
        // Simple linear regression for price prediction
        const regression = this.performLinearRegression(prices);
        
        // Calculate confidence intervals
        const confidenceIntervals = this.calculateConfidenceIntervals(regression);
        
        // Generate short-term and long-term predictions
        const predictions = {
            shortTerm: this.predictShortTerm(regression),
            longTerm: this.predictLongTerm(regression),
            confidenceIntervals
        };

        return predictions;
    }

    analyzeSeasonalPatterns(history) {
        const monthlyData = this.groupByMonth(history);
        
        // Identify seasonal trends
        const seasonalTrends = this.identifySeasonalTrends(monthlyData);
        
        // Calculate seasonal indices
        const seasonalIndices = this.calculateSeasonalIndices(monthlyData);
        
        // Predict seasonal peaks
        const seasonalPeaks = this.predictSeasonalPeaks(seasonalIndices);

        return {
            trends: seasonalTrends,
            indices: seasonalIndices,
            peaks: seasonalPeaks
        };
    }

    // Helper methods
    calculateMovingAverages(prices, periods = [7, 14, 30]) {
        return periods.map(period => {
            const ma = [];
            for (let i = 0; i < prices.length; i++) {
                if (i < period - 1) {
                    ma.push(null);
                    continue;
                }
                const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                ma.push(sum / period);
            }
            return ma;
        });
    }

    calculateVolatility(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    calculateDemandElasticity(prices, sales) {
        const priceChanges = [];
        const salesChanges = [];
        
        for (let i = 1; i < prices.length; i++) {
            priceChanges.push((prices[i] - prices[i-1]) / prices[i-1]);
            salesChanges.push((sales[i] - sales[i-1]) / sales[i-1]);
        }
        
        const elasticity = priceChanges.map((priceChange, i) => 
            salesChanges[i] / priceChange
        );
        
        return elasticity.reduce((a, b) => a + b, 0) / elasticity.length;
    }

    calculateSalesVelocity(sales) {
        const velocity = [];
        for (let i = 1; i < sales.length; i++) {
            velocity.push(sales[i] - sales[i-1]);
        }
        return velocity.reduce((a, b) => a + b, 0) / velocity.length;
    }

    calculateMarketSaturation(history) {
        // Extract all seller IDs, handling comma-separated lists
        const allSellerIds = history.flatMap(h => {
            if (typeof h.seller_id === 'string' && h.seller_id.includes(',')) {
                return h.seller_id.split(',').map(id => id.trim());
            }
            return h.seller_id || 'unknown';
        });

        // Count unique sellers
        const uniqueSellers = new Set(allSellerIds).size;

        // Calculate total listings
        const totalListings = history.reduce((sum, h) => sum + h.total_sales, 0);

        // Prevent division by zero
        const saturationScore = totalListings > 0 ? uniqueSellers / totalListings : 0;

        return {
            uniqueSellers,
            totalListings,
            saturationScore: parseFloat(saturationScore.toFixed(4))
        };
    }

    performLinearRegression(prices) {
        const n = prices.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = prices;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return { slope, intercept };
    }

    calculateConfidenceIntervals(regression) {
        // Implement confidence interval calculations
        return {
            upper: regression.slope * 1.96,
            lower: regression.slope * -1.96
        };
    }

    predictShortTerm(regression) {
        // Predict next 7 days
        return Array.from({length: 7}, (_, i) => 
            regression.slope * (i + 1) + regression.intercept
        );
    }

    predictLongTerm(regression) {
        // Predict next 30 days
        return Array.from({length: 30}, (_, i) => 
            regression.slope * (i + 1) + regression.intercept
        );
    }

    groupByMonth(history) {
        const monthlyData = {};
        history.forEach(h => {
            const date = new Date(h.timestamp);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    prices: [],
                    sales: []
                };
            }
            monthlyData[monthKey].prices.push(h.avg_price);
            monthlyData[monthKey].sales.push(h.total_sales);
        });
        return monthlyData;
    }

    identifySeasonalTrends(monthlyData) {
        const trends = [];
        Object.entries(monthlyData).forEach(([month, data]) => {
            const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
            const avgSales = data.sales.reduce((a, b) => a + b, 0) / data.sales.length;
            trends.push({
                month,
                avgPrice,
                avgSales
            });
        });
        return trends;
    }

    calculateSeasonalIndices(monthlyData) {
        const indices = {};
        Object.entries(monthlyData).forEach(([month, data]) => {
            const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
            indices[month] = avgPrice;
        });
        return indices;
    }

    predictSeasonalPeaks(seasonalIndices) {
        const peaks = [];
        const values = Object.values(seasonalIndices);
        const months = Object.keys(seasonalIndices);
        
        for (let i = 1; i < values.length - 1; i++) {
            if (values[i] > values[i-1] && values[i] > values[i+1]) {
                peaks.push({
                    month: months[i],
                    value: values[i]
                });
            }
        }
        
        return peaks;
    }

    calculateConfidence(history) {
        // Calculate confidence score based on data quality and quantity
        const dataPoints = history.length;
        const priceVariance = this.calculateVolatility(history.map(h => h.avg_price));
        const salesConsistency = this.calculateSalesVelocity(history.map(h => h.total_sales));
        
        return {
            dataPoints,
            priceVariance,
            salesConsistency,
            overallScore: (dataPoints / 100) * (1 - priceVariance) * (1 + salesConsistency)
        };
    }
}

module.exports = new PriceAnalytics(); 