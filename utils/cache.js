const { logger } = require('./logger');

class Cache {
    constructor() {
        this.store = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    // Get a value from cache
    async get(key) {
        try {
            const item = this.store.get(key);
            
            if (!item) {
                this.stats.misses++;
                return null;
            }

            // Check if expired
            if (item.expiry && item.expiry < Date.now()) {
                this.delete(key);
                this.stats.misses++;
                return null;
            }

            this.stats.hits++;
            return item.value;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    // Set a value in cache with optional expiry in seconds
    async set(key, value, expirySeconds = 3600) {
        try {
            this.store.set(key, {
                value,
                expiry: expirySeconds ? Date.now() + (expirySeconds * 1000) : null
            });
            this.stats.sets++;
            return true;
        } catch (error) {
            logger.error('Cache set error:', error);
            return false;
        }
    }

    // Delete a value from cache
    async delete(key) {
        try {
            const deleted = this.store.delete(key);
            if (deleted) {
                this.stats.deletes++;
            }
            return deleted;
        } catch (error) {
            logger.error('Cache delete error:', error);
            return false;
        }
    }

    // Clear all values from cache
    async clear() {
        try {
            this.store.clear();
            return true;
        } catch (error) {
            logger.error('Cache clear error:', error);
            return false;
        }
    }

    // Get multiple values from cache
    async mget(keys) {
        try {
            return keys.map(key => this.get(key));
        } catch (error) {
            logger.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }

    // Set multiple values in cache
    async mset(keyValuePairs, expirySeconds = 3600) {
        try {
            keyValuePairs.forEach(([key, value]) => {
                this.set(key, value, expirySeconds);
            });
            return true;
        } catch (error) {
            logger.error('Cache mset error:', error);
            return false;
        }
    }

    // Check if key exists in cache
    async exists(key) {
        try {
            return this.store.has(key);
        } catch (error) {
            logger.error('Cache exists error:', error);
            return false;
        }
    }

    // Get time to live for a key in seconds
    async ttl(key) {
        try {
            const item = this.store.get(key);
            if (!item || !item.expiry) {
                return -1;
            }
            const ttl = Math.ceil((item.expiry - Date.now()) / 1000);
            return ttl > 0 ? ttl : -1;
        } catch (error) {
            logger.error('Cache ttl error:', error);
            return -1;
        }
    }

    // Set expiry time for existing key
    async expire(key, seconds) {
        try {
            const item = this.store.get(key);
            if (!item) {
                return false;
            }
            item.expiry = Date.now() + (seconds * 1000);
            return true;
        } catch (error) {
            logger.error('Cache expire error:', error);
            return false;
        }
    }

    // Get cache statistics
    getStats() {
        return {
            ...this.stats,
            size: this.store.size,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }

    // Clean expired entries
    async cleanExpired() {
        try {
            const now = Date.now();
            let cleaned = 0;

            for (const [key, item] of this.store.entries()) {
                if (item.expiry && item.expiry < now) {
                    this.store.delete(key);
                    cleaned++;
                }
            }

            logger.debug('Cache cleanup completed', { 
                cleaned,
                remaining: this.store.size 
            });

            return cleaned;
        } catch (error) {
            logger.error('Cache cleanup error:', error);
            return 0;
        }
    }

    // Start automatic cleanup interval
    startCleanup(intervalSeconds = 300) {
        this.cleanupInterval = setInterval(() => {
            this.cleanExpired();
        }, intervalSeconds * 1000);
    }

    // Stop automatic cleanup
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Export singleton instance
const cache = new Cache();

// Start automatic cleanup every 5 minutes
cache.startCleanup();

module.exports = { cache }; 