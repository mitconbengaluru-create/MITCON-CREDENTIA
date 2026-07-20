// In-memory mapping to track active connections per User ID
// Key: userId, Value: Set of socketIds
const connectionRegistry = new Map();

/**
 * Registers an active socket connection for a User ID.
 * Supports multiple tabs and multiple active devices.
 * 
 * @function registerSocketConnection
 * @param {string} userId - User identifier
 * @param {string} socketId - Socket identifier
 */
export function registerSocketConnection(userId, socketId) {
  if (!connectionRegistry.has(userId)) {
    connectionRegistry.set(userId, new Set());
  }
  connectionRegistry.get(userId).add(socketId);
  console.log(`[Socket Registry] Registered user ${userId} with socket ${socketId}. Active connections count: ${connectionRegistry.get(userId).size}`);
}

/**
 * Deregisters a disconnected socket session.
 * 
 * @function unregisterSocketConnection
 * @param {string} userId - User identifier
 * @param {string} socketId - Socket identifier
 */
export function unregisterSocketConnection(userId, socketId) {
  if (connectionRegistry.has(userId)) {
    const socketsSet = connectionRegistry.get(userId);
    socketsSet.delete(socketId);
    if (socketsSet.size === 0) {
      connectionRegistry.delete(userId);
    }
    console.log(`[Socket Registry] Deregistered socket ${socketId} for user ${userId}. Connections remaining: ${socketsSet.size}`);
  }
}

/**
 * Returns all active socket IDs mapped to a User ID.
 * 
 * @function getSocketIdsForUser
 * @param {string} userId - User identifier
 * @returns {string[]} Array of active socket IDs
 */
export function getSocketIdsForUser(userId) {
  const socketsSet = connectionRegistry.get(userId);
  return socketsSet ? Array.from(socketsSet) : [];
}

/**
 * Checks if a user has at least one active connection.
 * 
 * @function isUserOnline
 * @param {string} userId - User identifier
 * @returns {boolean} True if online
 */
export function isUserOnline(userId) {
  return connectionRegistry.has(userId) && connectionRegistry.get(userId).size > 0;
}

export default {
  registerSocketConnection,
  unregisterSocketConnection,
  getSocketIdsForUser,
  isUserOnline,
};
