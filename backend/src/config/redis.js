import Redis from 'ioredis';
import env from './env.js';

let mainRedisInstance = null;
let hasWarnedOfConnectionFailure = false;

/**
 * Registers standard event listeners on a Redis client.
 * Catches connection errors and logs a single warning to avoid console spam in local development.
 * 
 * @param {Redis} client - The Redis client instance
 * @returns {Redis} The same client instance
 */
function configureClientListeners(client) {
  client.on('error', (err) => {
    if (!hasWarnedOfConnectionFailure) {
      console.warn(`\nRedis] Connection failed: ${err.message || 'ECONNREFUSED'}.`);
      console.warn('   The server will run, but background jobs/real-time state locks will be offline.\n');
      hasWarnedOfConnectionFailure = true;
    }
  });
  return client;
}

/**
 * Creates a new, configured Redis connection client instance.
 * Suitable for queues and workers that require dedicated client channels.
 * 
 * @function createRedisClient
 * @returns {Redis|Object} A configured Redis connection client instance (or mock if disabled)
 */
export function createRedisClient() {
  if (!env.REDIS_ENABLED) {
    // Return mock Redis client if disabled for local development runs
    return {
      connect: async () => {},
      disconnect: async () => {},
      quit: async () => {},
      ping: async () => 'PONG',
      on: () => {},
      off: () => {},
      emit: () => {},
      duplicate: () => createRedisClient(), // Important: support client duplication for BullMQ
    };
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  });
  return configureClientListeners(client);
}

/**
 * Retrieves the singleton Redis Cache client.
 * Ensures only one general cache connection exists.
 * 
 * @function getRedisClient
 * @returns {Redis|Object} Singleton Redis Client connection instance (or mock if disabled)
 */
export function getRedisClient() {
  if (!mainRedisInstance) {
    mainRedisInstance = createRedisClient();
  }
  return mainRedisInstance;
}

export const redis = getRedisClient();
export default redis;
