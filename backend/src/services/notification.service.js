import { NotificationRepository } from '../repositories/notification.repository.js';
import notificationUtil from '../utils/notification.util.js';
import { eventBus } from '../shared/event-bus.js';

export class NotificationService {
  constructor() {
    this.notificationRepository = new NotificationRepository();
    this.strictMode = process.env.NOTIFICATION_STRICT_MODE === 'true';
    
    // Register asynchronous background hooks on the global eventBus
    this.initializeEventBusListeners();
  }

  /**
   * Internal generic notification creator orchestrating preferences validation, formatting, and DB logs.
   * 
   * @async
   * @param {Object} payload - Notification payload
   * @param {Object} [tx] - Optional transaction context
   * @returns {Promise<Object|null>} Created notification or null
   */
  async createNotification(payload, tx) {
    try {
      this.validatePayload(payload);

      const userId = payload.userId;
      const category = payload.category;
      const eventType = payload.eventType || `${category}_EVENT`;
      const priority = payload.priority || notificationUtil.resolvePriority(category, eventType);
      const refNumber = notificationUtil.generateNotificationReference();

      // Resolve Title and Message using Template builder
      const { title, message, description } = notificationUtil.buildNotificationMessage(
        eventType,
        payload.context || {}
      );

      // Resolve recipient snapshot
      let userSnapshot = payload.userSnapshot || null;
      let departmentSnapshot = payload.departmentSnapshot || null;

      if (userId && (!userSnapshot || !departmentSnapshot)) {
        try {
          const userObj = await this.notificationRepository.fetchUserSnapshot(userId);
          if (userObj) {
            userSnapshot = userSnapshot || { id: userObj.id, email: userObj.email };
            departmentSnapshot = departmentSnapshot || userObj.department?.name || null;
          }
        } catch (snapshotErr) {
          console.warn(`[NotificationService] Snapshot resolution warning for User ID ${userId}: ${snapshotErr.message}`);
        }
      }

      // Resolve User preferences for delivery channels
      let emailEnabled = true;
      let inAppEnabled = true;
      let realTimeEnabled = true;
      let categoryEnabled = true;

      // Critical alerts & Security alerts bypass general preference suppressions
      const isCriticalSecurity = category === 'SECURITY' || priority === 'CRITICAL';

      if (userId && !isCriticalSecurity) {
        try {
          const preferences = await this.notificationRepository.getPreferencesByUserId(userId);
          if (preferences) {
            emailEnabled = preferences.emailEnabled;
            inAppEnabled = preferences.inAppEnabled;
            realTimeEnabled = preferences.realTimeEnabled;

            if (preferences.categoryPreferences && typeof preferences.categoryPreferences === 'object') {
              categoryEnabled = preferences.categoryPreferences[category] !== false;
            }
          }
        } catch (prefErr) {
          console.warn(`[NotificationService] Preferences lookup warning for User ID ${userId}: ${prefErr.message}`);
        }
      }

      const activeChannels = [];
      if (categoryEnabled || isCriticalSecurity) {
        if (inAppEnabled || isCriticalSecurity) activeChannels.push('IN_APP');
        if (emailEnabled || isCriticalSecurity) activeChannels.push('EMAIL');
        if (realTimeEnabled || isCriticalSecurity) activeChannels.push('REAL_TIME');
      }

      const dbData = {
        refNumber,
        userId,
        userSnapshot,
        departmentSnapshot,
        title,
        message,
        description: payload.description || description,
        category,
        priority,
        referenceType: payload.referenceType || null,
        referenceId: payload.referenceId || null,
        status: 'PENDING',
        expiryDate: payload.expiryDate || null,
      };

      const notification = await this.notificationRepository.create(dbData, tx);

      // Seed delivery attempt records in database
      const deliveries = [];
      for (const channel of activeChannels) {
        const delivery = await this.notificationRepository.createDelivery(
          {
            notificationId: notification.id,
            channel,
            status: 'PENDING',
            attemptCount: 0,
          },
          tx
        );
        deliveries.push(delivery);
      }

      notification.deliveries = deliveries;

      // Trigger asynchronous background delivery event emitter
      eventBus.emit('notification:created', notification);

      return notification;
    } catch (err) {
      console.error('[NotificationService] Notification creation failed:', err);
      if (this.strictMode) {
        throw err;
      }
      return null;
    }
  }

  validatePayload(payload) {
    if (!payload.userId) {
      throw new Error('Notification recipient User ID is required.');
    }
    const VALID_CATEGORIES = ['DOCUMENT', 'CHECKOUT', 'APPROVAL', 'SIGNATURE', 'SECURITY', 'SYSTEM'];
    if (!payload.category || !VALID_CATEGORIES.includes(payload.category)) {
      throw new Error(`Invalid or missing notification category: ${payload.category}`);
    }
  }

  // =========================================================================
  // Reusable Creator Methods
  // =========================================================================

  async createBulkNotifications(notificationsArray, tx) {
    const results = [];
    for (const notif of notificationsArray) {
      const res = await this.createNotification(notif, tx);
      if (res) results.push(res);
    }
    return results;
  }

  async createUserNotification(userId, category, title, message, context = {}, tx) {
    return await this.createNotification(
      {
        userId,
        category,
        context: { ...context, message, title },
      },
      tx
    );
  }

  async createSystemNotification(userId, eventType, context = {}, tx) {
    return await this.createNotification(
      {
        userId,
        category: 'SYSTEM',
        eventType,
        context,
      },
      tx
    );
  }

  async createSecurityNotification(userId, eventType, context = {}, tx) {
    return await this.createNotification(
      {
        userId,
        category: 'SECURITY',
        eventType,
        context,
      },
      tx
    );
  }

  async createModuleNotification(userId, category, eventType, referenceType, referenceId, context = {}, tx) {
    return await this.createNotification(
      {
        userId,
        category,
        eventType,
        referenceType,
        referenceId,
        context,
      },
      tx
    );
  }

  // =========================================================================
  // Status Management
  // =========================================================================

  async markAsRead(id, tx) {
    try {
      return await this.notificationRepository.markAsRead(id, tx);
    } catch (err) {
      console.error(`[NotificationService] Failed to mark read: ${err.message}`);
      throw err;
    }
  }

  async markAllAsRead(userId, tx) {
    try {
      return await this.notificationRepository.markAllAsRead(userId, tx);
    } catch (err) {
      console.error(`[NotificationService] Failed to mark all read: ${err.message}`);
      throw err;
    }
  }

  async archiveNotification(id, tx) {
    try {
      return await this.notificationRepository.archive(id, tx);
    } catch (err) {
      console.error(`[NotificationService] Failed to archive notification: ${err.message}`);
      throw err;
    }
  }

  async restoreNotification(id, tx) {
    try {
      return await this.notificationRepository._getClient(tx).notification.update({
        where: { id },
        data: { status: 'PENDING', archivedAt: null },
      });
    } catch (err) {
      console.error(`[NotificationService] Failed to restore notification: ${err.message}`);
      throw err;
    }
  }

  // =========================================================================
  // Preferences Management
  // =========================================================================

  async getUserPreferences(userId) {
    try {
      let prefs = await this.notificationRepository.getPreferencesByUserId(userId);
      if (!prefs) {
        prefs = await this.notificationRepository.resetPreferences(userId);
      }
      return prefs;
    } catch (err) {
      console.error(`[NotificationService] Failed to get preferences: ${err.message}`);
      throw err;
    }
  }

  async updatePreferences(userId, updates, tx) {
    try {
      return await this.notificationRepository.updatePreferences(userId, updates, tx);
    } catch (err) {
      console.error(`[NotificationService] Failed to update preferences: ${err.message}`);
      throw err;
    }
  }

  async resetPreferences(userId, tx) {
    try {
      return await this.notificationRepository.resetPreferences(userId, tx);
    } catch (err) {
      console.error(`[NotificationService] Failed to reset preferences: ${err.message}`);
      throw err;
    }
  }

  // =========================================================================
  // Feeds & Retrievals
  // =========================================================================

  async getUserFeed(userId, filters = {}, options = {}) {
    try {
      return await this.notificationRepository.getUserFeed(userId, filters, options);
    } catch (err) {
      console.error(`[NotificationService] Failed to load user feed: ${err.message}`);
      throw err;
    }
  }

  // =========================================================================
  // Event Bus Integration & Hooks
  // =========================================================================

  initializeEventBusListeners() {
    // Document module events
    eventBus.on('DOCUMENT_UPLOADED', (data) => this.notifyDocumentEvent('DOCUMENT_UPLOADED', data));
    eventBus.on('DOCUMENT_SHARED', (data) => this.notifyDocumentEvent('DOCUMENT_SHARED', data));
    eventBus.on('DOCUMENT_EXPIRED', (data) => this.notifyDocumentEvent('DOCUMENT_EXPIRED', data));
    eventBus.on('DOCUMENT_DOWNLOADED', (data) => this.notifyDocumentEvent('DOCUMENT_DOWNLOADED', data));

    // Checkout module events
    eventBus.on('CHECKOUT_REQUESTED', (data) => this.notifyCheckoutEvent('CHECKOUT_REQUESTED', data));
    eventBus.on('CHECKOUT_APPROVED', (data) => this.notifyCheckoutEvent('CHECKOUT_APPROVED', data));
    eventBus.on('CHECKOUT_REJECTED', (data) => this.notifyCheckoutEvent('CHECKOUT_REJECTED', data));
    eventBus.on('CHECKOUT_OVERDUE', (data) => this.notifyCheckoutEvent('CHECKOUT_OVERDUE', data));
    eventBus.on('DOCUMENT_RETURNED', (data) => this.notifyCheckoutEvent('DOCUMENT_RETURNED', data));

    // Approval module events
    eventBus.on('APPROVAL_REQUIRED', (data) => this.notifyApprovalEvent('APPROVAL_REQUIRED', data));
    eventBus.on('APPROVAL_GRANTED', (data) => this.notifyApprovalEvent('APPROVAL_GRANTED', data));
    eventBus.on('APPROVAL_REJECTED', (data) => this.notifyApprovalEvent('APPROVAL_REJECTED', data));

    // Signature module events
    eventBus.on('SIGNATURE_REQUIRED', (data) => this.notifySignatureEvent('SIGNATURE_REQUIRED', data));
    eventBus.on('SIGNATURE_VERIFIED', (data) => this.notifySignatureEvent('SIGNATURE_VERIFIED', data));
    eventBus.on('SIGNATURE_FAILED', (data) => this.notifySignatureEvent('SIGNATURE_FAILED', data));

    // Security module events
    eventBus.on('LOGIN_ALERT', (data) => this.notifySecurityEvent('LOGIN_ALERT', data));
    eventBus.on('PERMISSION_DENIED', (data) => this.notifySecurityEvent('PERMISSION_DENIED', data));
    eventBus.on('SUSPICIOUS_ACTIVITY', (data) => this.notifySecurityEvent('SUSPICIOUS_ACTIVITY', data));
  }

  async notifyDocumentEvent(eventType, eventData) {
    const userId = eventData.userId || eventData.ownerId;
    if (!userId) return;
    await this.createNotification({
      userId,
      category: 'DOCUMENT',
      eventType,
      referenceType: 'DOCUMENT',
      referenceId: eventData.documentId,
      context: eventData.details || eventData,
    });
  }

  async notifyCheckoutEvent(eventType, eventData) {
    const userId = eventData.userId || eventData.requestedById;
    if (!userId) return;
    await this.createNotification({
      userId,
      category: 'CHECKOUT',
      eventType,
      referenceType: 'CHECKOUT',
      referenceId: eventData.checkoutId,
      context: eventData.details || eventData,
    });
  }

  async notifyApprovalEvent(eventType, eventData) {
    const userId = eventData.userId || eventData.assignedToId || eventData.requestedById;
    if (!userId) return;
    await this.createNotification({
      userId,
      category: 'APPROVAL',
      eventType,
      referenceType: 'APPROVAL',
      referenceId: eventData.approvalId || eventData.requestId,
      context: eventData.details || eventData,
    });
  }

  async notifySignatureEvent(eventType, eventData) {
    const userId = eventData.userId;
    if (!userId) return;
    await this.createNotification({
      userId,
      category: 'SIGNATURE',
      eventType,
      referenceType: 'SIGNATURE',
      referenceId: eventData.signatureId,
      context: eventData.details || eventData,
    });
  }

  async notifySecurityEvent(eventType, eventData) {
    const userId = eventData.userId;
    if (!userId) return;
    await this.createNotification({
      userId,
      category: 'SECURITY',
      eventType,
      context: eventData.details || eventData,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
