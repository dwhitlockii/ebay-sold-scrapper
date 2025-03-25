class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.currentQuery = '';
        this.initializeCharts();
        this.setupEventListeners();
    }

    initializeCharts() {
        // Price Trends Chart
        this.charts.priceTrends = new Chart(
            document.getElementById('priceTrendsChart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Price',
                        data: [],
                        borderColor: '#00ff00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        tension: 0.4
                    }, {
                        label: '7-Day MA',
                        data: [],
                        borderColor: '#ff00ff',
                        backgroundColor: 'rgba(255, 0, 255, 0.1)',
                        tension: 0.4
                    }, {
                        label: '30-Day MA',
                        data: [],
                        borderColor: '#00ffff',
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Price Trends'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            }
        );

        // Market Demand Chart
        this.charts.marketDemand = new Chart(
            document.getElementById('marketDemandChart'),
            {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Sales Volume',
                        data: [],
                        backgroundColor: 'rgba(0, 255, 0, 0.5)',
                        borderColor: '#00ff00',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Market Demand'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }
        );

        // Price Predictions Chart
        this.charts.predictions = new Chart(
            document.getElementById('predictionsChart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Historical',
                        data: [],
                        borderColor: '#00ff00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Prediction',
                        data: [],
                        borderColor: '#ff00ff',
                        backgroundColor: 'rgba(255, 0, 255, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Price Predictions'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            }
        );

        // Seasonal Patterns Chart
        this.charts.seasonal = new Chart(
            document.getElementById('seasonalChart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Average Price',
                        data: [],
                        borderColor: '#00ff00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Sales Volume',
                        data: [],
                        borderColor: '#ff00ff',
                        backgroundColor: 'rgba(255, 0, 255, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Seasonal Patterns'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }
        );
    }

    setupEventListeners() {
        // Listen for search results
        document.addEventListener('searchComplete', (event) => {
            this.currentQuery = event.detail.query;
            this.updateAnalytics();
        });

        // Listen for tab changes
        document.querySelectorAll('.nav-link').forEach(tab => {
            tab.addEventListener('click', (event) => {
                if (event.target.getAttribute('data-bs-target') === '#analytics') {
                    this.updateAnalytics();
                }
            });
        });
    }

    async updateAnalytics() {
        if (!this.currentQuery) return;

        try {
            // Show loading state
            this.showLoading();

            // Fetch all analytics data
            const [trends, demand, predictions, seasonal] = await Promise.all([
                this.fetchTrends(),
                this.fetchDemand(),
                this.fetchPredictions(),
                this.fetchSeasonal()
            ]);

            // Update charts
            this.updatePriceTrendsChart(trends);
            this.updateMarketDemandChart(demand);
            this.updatePredictionsChart(predictions);
            this.updateSeasonalChart(seasonal);

            // Update stats
            this.updateStats(trends, demand, predictions, seasonal);

            // Hide loading state
            this.hideLoading();
        } catch (error) {
            console.error('Error updating analytics:', error);
            this.showError('Failed to load analytics data');
        }
    }

    async fetchTrends() {
        const response = await fetch(`/api/analytics/trends/${encodeURIComponent(this.currentQuery)}`);
        if (!response.ok) throw new Error('Failed to fetch trends');
        return await response.json();
    }

    async fetchDemand() {
        const response = await fetch(`/api/analytics/demand/${encodeURIComponent(this.currentQuery)}`);
        if (!response.ok) throw new Error('Failed to fetch demand data');
        return await response.json();
    }

    async fetchPredictions() {
        const response = await fetch(`/api/analytics/predictions/${encodeURIComponent(this.currentQuery)}`);
        if (!response.ok) throw new Error('Failed to fetch predictions');
        return await response.json();
    }

    async fetchSeasonal() {
        const response = await fetch(`/api/analytics/seasonal/${encodeURIComponent(this.currentQuery)}`);
        if (!response.ok) throw new Error('Failed to fetch seasonal data');
        return await response.json();
    }

    updatePriceTrendsChart(trends) {
        const { movingAverages, patterns } = trends;
        const dates = patterns.map(p => new Date(p.date).toLocaleDateString());
        const prices = patterns.map(p => p.price);

        this.charts.priceTrends.data.labels = dates;
        this.charts.priceTrends.data.datasets[0].data = prices;
        this.charts.priceTrends.data.datasets[1].data = movingAverages[0];
        this.charts.priceTrends.data.datasets[2].data = movingAverages[2];
        this.charts.priceTrends.update();
    }

    updateMarketDemandChart(demand) {
        const { salesVelocity, saturation } = demand;
        const labels = Array.from({ length: 12 }, (_, i) => 
            new Date(2024, i).toLocaleString('default', { month: 'short' })
        );

        this.charts.marketDemand.data.labels = labels;
        this.charts.marketDemand.data.datasets[0].data = Array(12).fill(salesVelocity);
        this.charts.marketDemand.update();
    }

    updatePredictionsChart(predictions) {
        const { shortTerm, longTerm } = predictions;
        const historicalLabels = Array.from({ length: 30 }, (_, i) => 
            new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString()
        );
        const predictionLabels = Array.from({ length: 7 }, (_, i) => 
            new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString()
        );

        this.charts.predictions.data.labels = [...historicalLabels, ...predictionLabels];
        this.charts.predictions.data.datasets[0].data = [...Array(30).fill(null), ...shortTerm];
        this.charts.predictions.data.datasets[1].data = [...Array(30).fill(null), ...shortTerm];
        this.charts.predictions.update();
    }

    updateSeasonalChart(seasonal) {
        const { trends } = seasonal;
        const labels = trends.map(t => t.month);
        const prices = trends.map(t => t.avgPrice);
        const sales = trends.map(t => t.avgSales);

        this.charts.seasonal.data.labels = labels;
        this.charts.seasonal.data.datasets[0].data = prices;
        this.charts.seasonal.data.datasets[1].data = sales;
        this.charts.seasonal.update();
    }

    updateStats(trends, demand, predictions, seasonal) {
        // Update price trend stats
        document.getElementById('currentPrice').textContent = 
            `$${trends.patterns[trends.patterns.length - 1].price.toFixed(2)}`;
        document.getElementById('priceChange').textContent = 
            `${trends.patterns[trends.patterns.length - 1].change.toFixed(2)}%`;
        document.getElementById('priceChange').className = 
            trends.patterns[trends.patterns.length - 1].change >= 0 ? 'text-success' : 'text-danger';

        // Update market demand stats
        document.getElementById('demandScore').textContent = 
            `${(demand.demandScore * 100).toFixed(1)}%`;
        document.getElementById('marketSaturation').textContent = 
            `${(demand.saturation.saturationScore * 100).toFixed(1)}%`;

        // Update prediction stats
        const nextPrediction = predictions.shortTerm[0];
        document.getElementById('nextPrediction').textContent = 
            `$${nextPrediction.toFixed(2)}`;
        document.getElementById('predictionConfidence').textContent = 
            `${(predictions.confidenceIntervals.confidence * 100).toFixed(1)}%`;

        // Update seasonal stats
        const currentMonth = new Date().getMonth() + 1;
        const seasonalTrend = seasonal.trends.find(t => 
            parseInt(t.month.split('-')[1]) === currentMonth
        );
        if (seasonalTrend) {
            document.getElementById('seasonalTrend').textContent = 
                `${seasonalTrend.avgSales > seasonalTrend.avgPrice ? 'High' : 'Low'} Season`;
        }
    }

    showLoading() {
        document.querySelectorAll('.analytics-chart').forEach(chart => {
            chart.classList.add('loading');
        });
    }

    hideLoading() {
        document.querySelectorAll('.analytics-chart').forEach(chart => {
            chart.classList.remove('loading');
        });
    }

    showError(message) {
        // Implement error display
        console.error(message);
    }
}

// Initialize analytics dashboard
const analyticsDashboard = new AnalyticsDashboard(); 