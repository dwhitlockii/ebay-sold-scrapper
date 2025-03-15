const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

class Settings {
    constructor() {
        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.settingsPath = path.join(__dirname, 'data', 'settings.json');
        this.settings = {
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 100
            },
            proxy: {
                enabled: false,
                list: [],
                rotationStrategy: 'round-robin',
                currentIndex: 0
            },
            search: {
                cacheEnabled: true,
                cacheDuration: 60 * 15, // 15 minutes
                maxResults: 100
            }
        };
        this.initializeSettings();
    }

    async initializeSettings() {
        try {
            await this.loadSettings();
            console.log('Settings initialized successfully');
        } catch (error) {
            console.error('Error initializing settings:', error);
        }
    }

    async loadSettings() {
        try {
            const data = await fsPromises.readFile(this.settingsPath, 'utf8');
            this.settings = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, create it with default settings
            await this.saveSettings();
        }
    }

    async saveSettings() {
        try {
            await fsPromises.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    getRateLimitSettings() {
        return this.settings.rateLimit;
    }

    getProxySettings() {
        return this.settings.proxy;
    }

    getSearchSettings() {
        return this.settings.search;
    }

    async updateRateLimit(settings) {
        try {
            if (typeof settings.windowMs === 'number' && settings.windowMs > 0) {
                this.settings.rateLimit.windowMs = settings.windowMs;
            }
            if (typeof settings.maxRequests === 'number' && settings.maxRequests > 0) {
                this.settings.rateLimit.maxRequests = settings.maxRequests;
            }
            await this.saveSettings();
            return true;
        } catch (error) {
            throw new Error('Failed to update rate limit settings');
        }
    }

    async updateProxy(settings) {
        try {
            if (Array.isArray(settings.list)) {
                this.settings.proxy.list = settings.list;
            }
            if (typeof settings.enabled === 'boolean') {
                this.settings.proxy.enabled = settings.enabled;
            }
            if (settings.rotationStrategy && ['round-robin', 'random'].includes(settings.rotationStrategy)) {
                this.settings.proxy.rotationStrategy = settings.rotationStrategy;
            }
            this.settings.proxy.currentIndex = 0;
            await this.saveSettings();
            return true;
        } catch (error) {
            throw new Error('Failed to update proxy settings');
        }
    }

    async updateSearchSettings(settings) {
        try {
            if (typeof settings.cacheEnabled === 'boolean') {
                this.settings.search.cacheEnabled = settings.cacheEnabled;
            }
            if (typeof settings.cacheDuration === 'number' && settings.cacheDuration > 0) {
                this.settings.search.cacheDuration = settings.cacheDuration;
            }
            if (typeof settings.maxResults === 'number' && settings.maxResults > 0) {
                this.settings.search.maxResults = settings.maxResults;
            }
            await this.saveSettings();
            return true;
        } catch (error) {
            throw new Error('Failed to update search settings');
        }
    }

    getNextProxy() {
        if (!this.settings.proxy.enabled || this.settings.proxy.list.length === 0) {
            return null;
        }

        if (this.settings.proxy.rotationStrategy === 'random') {
            const randomIndex = Math.floor(Math.random() * this.settings.proxy.list.length);
            return this.settings.proxy.list[randomIndex];
        }

        // Round-robin strategy
        const proxy = this.settings.proxy.list[this.settings.proxy.currentIndex];
        this.settings.proxy.currentIndex = (this.settings.proxy.currentIndex + 1) % this.settings.proxy.list.length;
        return proxy;
    }
}

// Export singleton instance
module.exports = new Settings();
