import { getIO } from '../config/socket.js';
import { isUserOnline } from '../utils/socket.util.js';
import { eventBus } from '../shared/event-bus.js';
import { NotificationRepository } from '../repositories/notification.repository.js';

export class RealtimeService {
  constructor() {
    this.notificationRepository = new NotificationRepository();
    
    // Register event listener on the global eventBus for automatic delivery orchestration
    this.initializeEventListener();
  }

  /**
   * Automatically intercepts newly created notifications and attempts real-time socket dispatch.
   */
  initializeEventListener() {
    eventBus.on('notification:created', async (notification) => {
      try {
        const userId = notification.userId;
        const deliveries = notification.deliveries || [];

        // Check if there is a REAL_TIME delivery record registered
        const rtDelivery = deliveries.find(d => d.channel === 'REAL_TIME');
        if (!rtDelivery) {
          return;
        }

        const online = isUserOnline(userId);
        if (online) {
          // Send notification:new event to the user's private socket room
          const delivered = this.sendToUser(userId, 'notification:new', notification);
          
          if (delivered) {
            // Update delivery log in DB
            await this.notificationRepository.updateDeliveryAttempt(
              rtDelivery.id,
              'DELIVERED',
              rtDelivery.attemptCount + 1,
              null
            );

            // Update main notification status from PENDING to DELIVERED
            if (notification.status === 'PENDING') {
              await this.notificationRepository.markAsDelivered(notification.id);
            }

            // Push an unread counter update
            const count = await this.notificationRepository.getUnreadCount(userId);
            this.sendToUser(userId, 'notification:count:update', { unreadCount: count });
          } else {
            await this.notificationRepository.updateDeliveryAttempt(
              rtDelivery.id,
              'FAILED',
              rtDelivery.attemptCount + 1,
              'Failed to emit socket packet to user room.'
            );
          }
        } else {
          // User is offline. Leave delivery log as PENDING (will retrieve on reconnect)
          await this.notificationRepository.updateDeliveryAttempt(
            rtDelivery.id,
            'PENDING',
            rtDelivery.attemptCount,
            'User offline. Held for reconnection delivery.'
          );
        }
      } catch (err) {
        console.error('[RealtimeService] Auto-delivery handler failed:', err.message);
      }
    });
  }

  /**
   * Emits a real-time socket packet to a specific user's private room.
   * 
   * @param {string} userId - Target user identifier
   * @param {string} event - Event name
   * @param {Object} data - Payload data
   * @returns {boolean} True if emitted successfully
   */
  sendToUser(userId, event, data) {
    const io = getIO();
    if (!io) {
      console.error('[RealtimeService] Cannot sendToUser: Socket.IO Server not initialized.');
      return false;
    }
    io.to(`user:${userId}`).emit(event, data);
    return true;
  }

  /**
   * Emits a real-time socket packet to multiple user private rooms.
   */
  sendToUsers(userIds = [], event, data) {
    for (const userId of userIds) {
      this.sendToUser(userId, event, data);
    }
    return true;
  }

  /**
   * Emits a real-time socket packet to all connected sockets in a role room.
   */
  sendToRole(roleName, event, data) {
    const io = getIO();
    if (!io) {
      console.error('[RealtimeService] Cannot sendToRole: Socket.IO Server not initialized.');
      return false;
    }
    io.to(`role:${roleName}`).emit(event, data);
    return true;
  }

  /**
   * Emits a real-time socket packet to all connected sockets in a department room.
   */
  sendToDepartment(departmentId, event, data) {
    const io = getIO();
    if (!io) {
      console.error('[RealtimeService] Cannot sendToDepartment: Socket.IO Server not initialized.');
      return false;
    }
    io.to(`department:${departmentId}`).emit(event, data);
    return true;
  }

  /**
   * Broadcasts a global system alert to all connected socket clients.
   */
  broadcastSystemAlert(event, data) {
    const io = getIO();
    if (!io) {
      console.error('[RealtimeService] Cannot broadcastSystemAlert: Socket.IO Server not initialized.');
      return false;
    }
    io.emit(event, data);
    return true;
  }

  /**
   * Emits security alert to a target user and immediately cascades it to Admin roles.
   */
  sendSecurityAlert(userId, event, data) {
    this.sendToUser(userId, event, data);
    this.sendToRole('ADMIN', 'security:alert', { ...data, userId });
    return true;
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
