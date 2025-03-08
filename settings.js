
const fs = require('fs').promises;
const path = require('path');

class Settings {
    constructor() {
        this.settingsPath = path.join(__dirname, 'data', 'settings.json');
        this.settings = {
            rateLimit: {
                maxRequests: 30,
                windowMs: 15 * 60 * 1000 // 15 minutes
            },
            proxy: {
                proxyList: [],
                rotationStrategy: 'round-robin',
                currentIndex: 0
            }
        };
        this.loadSettings();
    }

    async loadSettings() {
        try {
            const data = await fs.readFile(this.settingsPath, 'utf8');
            this.settings = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, create it with default settings
            await this.saveSettings();
        }
    }

    async saveSettings() {
        try {
            await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
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

    async updateRateLimit(settings) {
        this.settings.rateLimit = {
            maxRequests: parseInt(settings.maxRequests),
            windowMs: parseInt(settings.windowMs)
        };
        await this.saveSettings();
    }

    async updateProxy(settings) {
        this.settings.proxy = {
            proxyList: settings.proxyList,
            rotationStrategy: settings.rotationStrategy,
            currentIndex: 0
        };
        await this.saveSettings();
    }

    getNextProxy() {
        if (!this.settings.proxy.proxyList.length) return null;

        if (this.settings.proxy.rotationStrategy === 'random') {
            const randomIndex = Math.floor(Math.random() * this.settings.proxy.proxyList.length);
            return this.settings.proxy.proxyList[randomIndex];
        }

        // Round-robin strategy
        const proxy = this.settings.proxy.proxyList[this.settings.proxy.currentIndex];
        this.settings.proxy.currentIndex = (this.settings.proxy.currentIndex + 1) % this.settings.proxy.proxyList.length;
        return proxy;
    }
}

module.exports = new Settings();
