import redis from '../config/redis.js';
import cacheConfig from '../config/cache.js';
import logUtil from '../utils/logger.util.js';

class InMemoryCache {
  constructor() {
    this.store = new Map();
  }
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, ttlSeconds) {
    const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expires });
  }
  delete(key) {
    this.store.delete(key);
  }
  keys(pattern) {
    // Basic mock key matching
    const cleanPattern = pattern.replace('*', '');
    const keys = [];
    for (const key of this.store.keys()) {
      if (key.includes(cleanPattern)) {
        keys.push(key);
      }
    }
    return keys;
  }
}

export class CacheService {
  constructor() {
    this.localCache = new InMemoryCache();
    this.redisEnabled = cacheConfig.enabled;
  }

  /**
   * Fetch item from cache.
   */
  async get(key) {
    try {
      if (this.redisEnabled) {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
      }
      return this.localCache.get(key);
    } catch (err) {
      logUtil.error(`Cache Read Error for key ${key}:`, err);
      return this.localCache.get(key); // Fallback
    }
  }

  /**
   * Write item to cache with custom TTL.
   */
  async set(key, value, ttlSeconds = 300) {
    try {
      if (this.redisEnabled) {
        const stringified = JSON.stringify(value);
        await redis.setex(key, ttlSeconds, stringified);
      } else {
        this.localCache.set(key, value, ttlSeconds);
      }
    } catch (err) {
      logUtil.error(`Cache Write Error for key ${key}:`, err);
      this.localCache.set(key, value, ttlSeconds);
    }
  }

  /**
   * Delete specific key.
   */
  async delete(key) {
    try {
      if (this.redisEnabled) {
        await redis.del(key);
      } else {
        this.localCache.delete(key);
      }
    } catch (err) {
      logUtil.error(`Cache Delete Error for key ${key}:`, err);
      this.localCache.delete(key);
    }
  }

  /**
   * Invalidate all keys matching prefix/pattern namespace.
   */
  async invalidate(pattern) {
    try {
      if (this.redisEnabled) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(keys);
        }
      } else {
        const keys = this.localCache.keys(pattern);
        keys.forEach(k => this.localCache.delete(k));
      }
    } catch (err) {
      logUtil.error(`Cache Invalidation Error for pattern ${pattern}:`, err);
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
