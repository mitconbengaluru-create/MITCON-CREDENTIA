import { prisma } from '../config/database.js';

/**
 * Standardized repository error class for Notification Domain operations.
 */
export class NotificationRepositoryError extends Error {
  constructor(message, code = 'NOTIFICATION_REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'NotificationRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps Prisma errors to standard NotificationRepositoryError.
 */
function handlePrismaError(err, operationName) {
  console.error(`[NotificationRepository] Error in ${operationName}:`, err);
  if (err instanceof NotificationRepositoryError) {
    throw err;
  }
  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new NotificationRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  if (err.code === 'P2025') {
    throw new NotificationRepositoryError(
      `Target notification record was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }
  throw new NotificationRepositoryError(
    `Database error occurred during notification ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

export class NotificationRepository {
  /**
   * Helper to select the database client context (transaction-aware).
   * @private
   */
  _getClient(tx) {
    return tx || prisma;
  }

  // =========================================================================
  // Notification Creation
  // =========================================================================

  async create(data, tx) {
    try {
      return await this._getClient(tx).notification.create({
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              departmentId: true,
            },
          },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'create');
    }
  }

  async createBulk(dataArray, tx) {
    try {
      return await this._getClient(tx).notification.createMany({
        data: dataArray,
      });
    } catch (err) {
      handlePrismaError(err, 'createBulk');
    }
  }

  // =========================================================================
  // Notification Retrieval
  // =========================================================================

  async findById(id) {
    try {
      return await prisma.notification.findUnique({
        where: { id },
        include: {
          deliveries: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              departmentId: true,
            },
          },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findById');
    }
  }

  async findByRefNumber(refNumber) {
    try {
      return await prisma.notification.findUnique({
        where: { refNumber },
        include: {
          deliveries: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              departmentId: true,
            },
          },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findByRefNumber');
    }
  }

  // =========================================================================
  // Listing, Paginating & Filtering
  // =========================================================================

  async list(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;

      const where = this._buildWhereClause(filters);

      const [logs, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            deliveries: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                departmentId: true,
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return { logs, total, page, limit };
    } catch (err) {
      handlePrismaError(err, 'list');
    }
  }

  async getUserFeed(userId, filters = {}, options = {}) {
    try {
      const feedFilters = { ...filters, userId };
      return await this.list(feedFilters, options);
    } catch (err) {
      handlePrismaError(err, 'getUserFeed');
    }
  }

  /**
   * Helper to build dynamic prisma filters map
   * @private
   */
  _buildWhereClause(filters) {
    const where = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.category) where.category = filters.category;
    if (filters.referenceType) where.referenceType = filters.referenceType;
    if (filters.referenceId) where.referenceId = filters.referenceId;
    if (filters.refNumber) where.refNumber = filters.refNumber;

    if (filters.channel) {
      where.deliveries = {
        some: {
          channel: filters.channel,
        },
      };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return where;
  }

  // =========================================================================
  // Status Mutations & Updates
  // =========================================================================

  async markAsDelivered(id, tx) {
    try {
      return await this._getClient(tx).notification.update({
        where: { id },
        data: { status: 'DELIVERED' },
      });
    } catch (err) {
      handlePrismaError(err, 'markAsDelivered');
    }
  }

  async markAsRead(id, tx) {
    try {
      return await this._getClient(tx).notification.update({
        where: { id },
        data: { status: 'READ' },
      });
    } catch (err) {
      handlePrismaError(err, 'markAsRead');
    }
  }

  async markAllAsRead(userId, tx) {
    try {
      return await this._getClient(tx).notification.updateMany({
        where: { userId, status: { notIn: ['READ', 'ARCHIVED'] } },
        data: { status: 'READ' },
      });
    } catch (err) {
      handlePrismaError(err, 'markAllAsRead');
    }
  }

  async markFailed(id, tx) {
    try {
      return await this._getClient(tx).notification.update({
        where: { id },
        data: { status: 'FAILED' },
      });
    } catch (err) {
      handlePrismaError(err, 'markFailed');
    }
  }

  async archive(id, tx) {
    try {
      return await this._getClient(tx).notification.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });
    } catch (err) {
      handlePrismaError(err, 'archive');
    }
  }

  // =========================================================================
  // Notification Delivery Logs persistence
  // =========================================================================

  async createDelivery(data, tx) {
    try {
      return await this._getClient(tx).notificationDelivery.create({
        data,
      });
    } catch (err) {
      handlePrismaError(err, 'createDelivery');
    }
  }

  async updateDeliveryAttempt(id, status, attemptCount, failedReason = null, tx) {
    try {
      const data = {
        status,
        attemptCount,
        updatedAt: new Date(),
      };
      if (status === 'DELIVERED') {
        data.deliveredAt = new Date();
      }
      if (failedReason) {
        data.failedReason = failedReason;
      }

      return await this._getClient(tx).notificationDelivery.update({
        where: { id },
        data,
      });
    } catch (err) {
      handlePrismaError(err, 'updateDeliveryAttempt');
    }
  }

  async updateDeliveryStatus(id, status, tx) {
    try {
      const data = { status };
      if (status === 'DELIVERED') {
        data.deliveredAt = new Date();
      }
      return await this._getClient(tx).notificationDelivery.update({
        where: { id },
        data,
      });
    } catch (err) {
      handlePrismaError(err, 'updateDeliveryStatus');
    }
  }

  // =========================================================================
  // Notification Preferences persistence
  // =========================================================================

  async createPreferences(data, tx) {
    try {
      return await this._getClient(tx).notificationPreference.create({
        data,
      });
    } catch (err) {
      handlePrismaError(err, 'createPreferences');
    }
  }

  async getPreferencesByUserId(userId) {
    try {
      return await prisma.notificationPreference.findUnique({
        where: { userId },
      });
    } catch (err) {
      handlePrismaError(err, 'getPreferencesByUserId');
    }
  }

  async updatePreferences(userId, updates, tx) {
    try {
      return await this._getClient(tx).notificationPreference.update({
        where: { userId },
        data: updates,
      });
    } catch (err) {
      handlePrismaError(err, 'updatePreferences');
    }
  }

  async resetPreferences(userId, tx) {
    try {
      return await this._getClient(tx).notificationPreference.upsert({
        where: { userId },
        update: {
          emailEnabled: true,
          inAppEnabled: true,
          realTimeEnabled: true,
          categoryPreferences: {
            DOCUMENT: true,
            CHECKOUT: true,
            APPROVAL: true,
            SIGNATURE: true,
            SECURITY: true,
            SYSTEM: true,
          },
        },
        create: {
          userId,
          emailEnabled: true,
          inAppEnabled: true,
          realTimeEnabled: true,
          categoryPreferences: {
            DOCUMENT: true,
            CHECKOUT: true,
            APPROVAL: true,
            SIGNATURE: true,
            SECURITY: true,
            SYSTEM: true,
          },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'resetPreferences');
    }
  }

  // =========================================================================
  // Dashboard & Statistics Queries
  // =========================================================================

  async getUnreadCount(userId) {
    try {
      return await prisma.notification.count({
        where: { userId, status: { notIn: ['READ', 'ARCHIVED'] } },
      });
    } catch (err) {
      handlePrismaError(err, 'getUnreadCount');
    }
  }

  async getStats(userId) {
    try {
      const where = userId ? { userId } : {};

      const [total, unread, delivered, failed, critical, categoryGroups] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { ...where, status: { notIn: ['READ', 'ARCHIVED'] } },
        }),
        prisma.notification.count({
          where: { ...where, status: 'DELIVERED' },
        }),
        prisma.notification.count({
          where: { ...where, status: 'FAILED' },
        }),
        prisma.notification.count({
          where: { ...where, priority: 'CRITICAL' },
        }),
        prisma.notification.groupBy({
          by: ['category'],
          where,
          _count: {
            _all: true,
          },
        }),
      ]);

      const byCategory = {};
      for (const group of categoryGroups) {
        byCategory[group.category] = group._count._all;
      }

      return {
        total,
        unread,
        delivered,
        failed,
        critical,
        byCategory,
      };
    } catch (err) {
      handlePrismaError(err, 'getStats');
    }
  }

  // =========================================================================
  // Batch Operations
  // =========================================================================

  async bulkUpdateStatus(ids, status, tx) {
    try {
      const data = { status };
      if (status === 'ARCHIVED') {
        data.archivedAt = new Date();
      }
      return await this._getClient(tx).notification.updateMany({
        where: { id: { in: ids } },
        data,
      });
    } catch (err) {
      handlePrismaError(err, 'bulkUpdateStatus');
    }
  }

  // =========================================================================
  // Retention & Archiving Queries
  // =========================================================================

  async findExpired(date = new Date()) {
    try {
      return await prisma.notification.findMany({
        where: {
          expiryDate: { lte: date },
          status: { not: 'ARCHIVED' },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findExpired');
    }
  }

  async archiveOld(date, tx) {
    try {
      return await this._getClient(tx).notification.updateMany({
        where: {
          createdAt: { lte: date },
          status: { not: 'ARCHIVED' },
        },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });
    } catch (err) {
      handlePrismaError(err, 'archiveOld');
    }
  }

  async fetchUserSnapshot(userId) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        include: { department: true },
      });
    } catch (err) {
      handlePrismaError(err, 'fetchUserSnapshot');
    }
  }
}

export default NotificationRepository;
