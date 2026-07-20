import { Server } from 'socket.io';
import { socketAuthMiddleware } from '../middleware/socket.middleware.js';
import { notificationService } from '../services/notification.service.js';
import { registerSocketConnection, unregisterSocketConnection } from '../utils/socket.util.js';

let io = null;

/**
 * Initializes the Socket.IO Server singleton.
 * 
 * @function initSocketServer
 * @param {import('http').Server} httpServer - HTTP Server instance
 * @returns {import('socket.io').Server} Initialized server instance
 */
export function initSocketServer(httpServer) {
  if (io) {
    return io;
  }

  // Load RealtimeService dynamically to bind event bus listeners without circular dependency
  import('../services/realtime.service.js').catch((err) => {
    console.error('[Socket.IO] Failed to load Realtime Service:', err);
  });

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Attach token authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket.IO] Client connected: Socket ID ${socket.id}, User ID ${user.id}, Role ${user.role}`);

    // Join target user-specific, role-specific, and department-specific rooms
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    if (user.departmentId) {
      socket.join(`department:${user.departmentId}`);
    }

    // Register socket session mapping
    registerSocketConnection(user.id, socket.id);

    // --- Client Event Listeners ---
    socket.on('mark_notification_read', async (data) => {
      try {
        const { notificationId } = data || {};
        if (notificationId) {
          await notificationService.markAsRead(notificationId);
          // Emit update count event to client
          const count = await notificationService.notificationRepository.getUnreadCount(user.id);
          socket.emit('notification:count:update', { unreadCount: count });
          socket.emit('notification:updated', { id: notificationId, status: 'READ' });
        }
      } catch (err) {
        console.error(`[Socket.IO] Error on mark_notification_read:`, err.message);
      }
    });

    socket.on('mark_all_notifications_read', async () => {
      try {
        await notificationService.markAllAsRead(user.id);
        socket.emit('notification:count:update', { unreadCount: 0 });
        socket.emit('notification:read', { allRead: true });
      } catch (err) {
        console.error(`[Socket.IO] Error on mark_all_notifications_read:`, err.message);
      }
    });

    socket.on('notification_acknowledged', async (data) => {
      try {
        const { notificationId } = data || {};
        console.log(`[Socket.IO] Client acknowledged notification ID ${notificationId}`);
        // Optionally update delivery logs or status
      } catch (err) {
        console.error(`[Socket.IO] Error on notification_acknowledged:`, err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: Socket ID ${socket.id}, User ID ${user.id}`);
      unregisterSocketConnection(user.id, socket.id);
    });
  });

  return io;
}

/**
 * Returns the Socket.IO Server singleton.
 * 
 * @function getIO
 * @returns {import('socket.io').Server|null} Socket.IO Server instance or null
 */
export function getIO() {
  return io;
}

export default {
  initSocketServer,
  getIO,
};
