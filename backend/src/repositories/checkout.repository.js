import { prisma } from '../config/database.js';

/**
 * Standardized repository error class for Checkout Domain operations.
 */
export class CheckoutRepositoryError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='REPOSITORY_ERROR'] - Error categorization code
   * @param {Error} [originalError] - The underlying Prisma/DB exception
   */
  constructor(message, code = 'REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'CheckoutRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps Prisma errors to standard CheckoutRepositoryError.
 * 
 * @function handlePrismaError
 * @param {Error} err - Caught exception
 * @param {string} operationName - Name of the repository operation
 * @returns {never} Always throws CheckoutRepositoryError
 */
function handlePrismaError(err, operationName) {
  console.error(`[CheckoutRepository] Error in ${operationName}:`, err);
  
  if (err instanceof CheckoutRepositoryError) {
    throw err;
  }

  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new CheckoutRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  
  if (err.code === 'P2025') {
    throw new CheckoutRepositoryError(
      `Target record for operation was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }

  throw new CheckoutRepositoryError(
    `Database error occurred during ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

/**
 * Database repository implementation for Document Checkout operations.
 * Abstractions of queries utilizing Prisma client singletons.
 */
export class CheckoutRepository {
  /**
   * Default relations loaded with Checkout profiles.
   * @private
   */
  _defaultIncludes = {
    document: {
      select: {
        id: true,
        name: true,
        documentNumber: true,
        classification: true,
        status: true,
      }
    },
    requestedBy: {
      select: {
        id: true,
        email: true,
        role: true,
      }
    },
    approvedBy: {
      select: {
        id: true,
        email: true,
        role: true,
      }
    }
  };

  /**
   * Create a new checkout request record.
   * 
   * @async
   * @method createCheckout
   * @param {Object} data - Checkout creation payload
   * @param {Object} [tx] - Optional transaction client
   * @returns {Promise<Object>} Created checkout record
   * @throws {CheckoutRepositoryError}
   */
  async createCheckout(data, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.create({
        data: {
          id: data.id || undefined,
          documentId: data.documentId,
          documentVersionId: data.documentVersionId || null,
          documentNameSnapshot: data.documentNameSnapshot,
          classificationSnapshot: data.classificationSnapshot,
          requestedById: data.requestedById,
          employeeId: data.employeeId || null,
          employeeName: data.employeeName,
          department: data.department,
          designation: data.designation || null,
          destination: data.destination,
          locationAddress: data.locationAddress,
          externalOrganizationName: data.externalOrganizationName || null,
          purposeOfRemoval: data.purposeOfRemoval,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          status: data.status || 'DRAFT',
          checkoutSignatureId: data.checkoutSignatureId || null,
          returnSignatureId: data.returnSignatureId || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'createCheckout');
    }
  }

  /**
   * Retrieve a checkout record by its primary key ID.
   * 
   * @async
   * @method findById
   * @param {string} id - Checkout UUID
   * @param {Object} [options] - Query options (includeDeleted)
   * @returns {Promise<Object|null>} Matching checkout record or null
   * @throws {CheckoutRepositoryError}
   */
  async findById(id, options = {}) {
    try {
      const record = await prisma.checkout.findUnique({
        where: { id },
        include: options.include || this._defaultIncludes,
      });

      if (!record) return null;
      if (record.isDeleted && !options.includeDeleted) return null;

      return record;
    } catch (err) {
      handlePrismaError(err, 'findById');
    }
  }

  /**
   * Retrieve checkouts associated with a specific document ID.
   * 
   * @async
   * @method findByDocumentId
   * @param {string} documentId - Document UUID
   * @param {Object} [options] - Options filters
   * @returns {Promise<Array<Object>>} Checkouts list
   */
  async findByDocumentId(documentId, options = {}) {
    return this.findAll({ documentId }, options);
  }

  /**
   * Retrieve checkouts requested by a specific user.
   * 
   * @async
   * @method findByUserId
   * @param {string} userId - User UUID
   * @param {Object} [options] - Options filters
   * @returns {Promise<Array<Object>>} Checkouts list
   */
  async findByUserId(userId, options = {}) {
    return this.findAll({ requestedById: userId }, options);
  }

  /**
   * Retrieve checkouts under a specific department snapshot name.
   * 
   * @async
   * @method findByDepartment
   * @param {string} department - Department name
   * @param {Object} [options] - Options filters
   * @returns {Promise<Array<Object>>} Checkouts list
   */
  async findByDepartment(department, options = {}) {
    return this.findAll({ department }, options);
  }

  /**
   * Retrieve checkouts by state status.
   * 
   * @async
   * @method findByStatus
   * @param {string} status - CheckoutStatus enum string
   * @param {Object} [options] - Options filters
   * @returns {Promise<Array<Object>>} Checkouts list
   */
  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  /**
   * Retrieve checkouts within a specific checkout date range.
   * 
   * @async
   * @method findByDateRange
   * @param {Date} startDate - Range start
   * @param {Date} endDate - Range end
   * @param {Object} [options] - Options filters
   * @returns {Promise<Array<Object>>} Checkouts list
   */
  async findByDateRange(startDate, endDate, options = {}) {
    return this.findAll({ startDate, endDate }, options);
  }

  /**
   * Master query-builder returning checklists with filters, pagination, and sorting.
   * 
   * @async
   * @method findAll
   * @param {Object} [filters] - Query filters
   * @param {Object} [options] - Selection/Pagination/Soft-delete options
   * @returns {Promise<Object>} Lists matching documents and total record count
   */
  async findAll(filters = {}, options = {}) {
    try {
      const where = { isDeleted: false };

      // Soft delete behavior override
      if (options.includeDeleted) {
        delete where.isDeleted;
      }

      // 1. Direct field filters mapping
      if (filters.id) where.id = filters.id;
      if (filters.documentId) where.documentId = filters.documentId;
      if (filters.requestedById) where.requestedById = filters.requestedById;
      if (filters.approvedById) where.approvedById = filters.approvedById;
      if (filters.status) where.status = filters.status;
      if (filters.returnStatus) where.returnStatus = filters.returnStatus;
      
      // Case-insensitive department search
      if (filters.department) {
        where.department = { contains: filters.department, mode: 'insensitive' };
      }

      // Case-insensitive destination search
      if (filters.destination) {
        where.destination = { contains: filters.destination, mode: 'insensitive' };
      }

      // Date range filtering
      if (filters.startDate || filters.endDate) {
        where.checkoutDate = {};
        if (filters.startDate) where.checkoutDate.gte = new Date(filters.startDate);
        if (filters.endDate) where.checkoutDate.lte = new Date(filters.endDate);
      }

      // Expected return range (overdue helper)
      if (filters.expectedReturnBefore) {
        where.expectedReturnDate = { lt: new Date(filters.expectedReturnBefore) };
      }

      // Specialized status filters
      if (filters.activeOnly) {
        where.status = { in: ['APPROVED', 'CHECKED_OUT', 'PENDING_RETURN'] };
      }

      // Sorting
      const orderBy = {};
      const sortField = options.sort || 'createdAt';
      const sortOrder = options.order || 'desc';
      orderBy[sortField] = sortOrder;

      // Pagination
      const page = parseInt(options.page || 1, 10);
      const limit = parseInt(options.limit || 20, 10);
      const skip = (page - 1) * limit;

      const [checkouts, totalRecords] = await Promise.all([
        prisma.checkout.findMany({
          where,
          include: options.include || this._defaultIncludes,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.checkout.count({ where }),
      ]);

      return {
        checkouts,
        pagination: {
          totalRecords,
          page,
          limit,
          totalPages: Math.ceil(totalRecords / limit),
        }
      };
    } catch (err) {
      handlePrismaError(err, 'findAll');
    }
  }

  // =========================================================================
  // Listing Helpers
  // =========================================================================

  async listAll(options = {}) {
    return this.findAll({}, options);
  }

  async listUserCheckouts(userId, options = {}) {
    return this.findAll({ requestedById: userId }, options);
  }

  async listDepartmentCheckouts(department, options = {}) {
    return this.findAll({ department }, options);
  }

  async listActiveCheckouts(options = {}) {
    return this.findAll({ activeOnly: true }, options);
  }

  async listPendingApprovals(options = {}) {
    return this.findAll({ status: 'PENDING_APPROVAL' }, options);
  }

  async listOverdueCheckouts(options = {}) {
    return this.findAll({
      status: { in: ['CHECKED_OUT', 'PENDING_RETURN'] },
      expectedReturnBefore: new Date(),
    }, options);
  }

  async listReturnedCheckouts(options = {}) {
    return this.findAll({ status: 'RETURNED' }, options);
  }

  // =========================================================================
  // Status and Flow Updates
  // =========================================================================

  /**
   * Update raw checkout status value.
   * 
   * @async
   * @method updateStatus
   * @param {string} id - Checkout UUID
   * @param {string} status - CheckoutStatus enum string
   * @param {Object} [tx] - Optional transaction client
   */
  async updateStatus(id, status, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { status },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateStatus');
    }
  }

  /**
   * Update approval tracking state.
   */
  async markApproved(id, approvedById, approvedAt = new Date(), tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById,
          approvedAt: new Date(approvedAt),
          rejectionReason: null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'markApproved');
    }
  }

  /**
   * Update rejection tracking state.
   */
  async markRejected(id, approvedById, rejectionReason, approvedAt = new Date(), tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          status: 'REJECTED',
          approvedById,
          approvedAt: new Date(approvedAt),
          rejectionReason,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'markRejected');
    }
  }

  /**
   * Transition state to CHECKED_OUT.
   */
  async markCheckedOut(id, checkoutDate = new Date(), expectedReturnDate, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          checkoutDate: new Date(checkoutDate),
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'markCheckedOut');
    }
  }

  /**
   * Transition state to PENDING_RETURN.
   */
  async markPendingReturn(id, tx = null) {
    return this.updateStatus(id, 'PENDING_RETURN', tx);
  }

  /**
   * Transition state to RETURNED and persist review conditions.
   */
  async markReturned(id, returnData, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          status: 'RETURNED',
          returnStatus: returnData.returnStatus || 'Returned',
          returnedDate: returnData.returnedDate ? new Date(returnData.returnedDate) : new Date(),
          returnedTo: returnData.returnedTo || null,
          conditionOnReturn: returnData.conditionOnReturn || 'GOOD',
          returnNotes: returnData.returnNotes || null,
          returnSignatureId: returnData.returnSignatureId || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'markReturned');
    }
  }

  /**
   * Close checkout flow.
   */
  async closeCheckout(id, tx = null) {
    return this.updateStatus(id, 'CLOSED', tx);
  }

  // =========================================================================
  // Statistics Aggregations
  // =========================================================================

  /**
   * Run multi-count aggregate statistics for reporting dashboards.
   * 
   * @async
   * @method getCheckoutStats
   * @returns {Promise<Object>} Dashboard stats object
   */
  async getCheckoutStats() {
    try {
      const now = new Date();
      
      const [
        totalCheckouts,
        activeCheckouts,
        pendingReturns,
        overdueDocuments,
        returnedDocuments,
        groupedByDept,
        groupedByStatus
      ] = await Promise.all([
        prisma.checkout.count({ where: { isDeleted: false } }),
        prisma.checkout.count({
          where: {
            isDeleted: false,
            status: { in: ['APPROVED', 'CHECKED_OUT', 'PENDING_RETURN'] },
          }
        }),
        prisma.checkout.count({ where: { isDeleted: false, status: 'PENDING_RETURN' } }),
        prisma.checkout.count({
          where: {
            isDeleted: false,
            status: { in: ['CHECKED_OUT', 'PENDING_RETURN'] },
            expectedReturnDate: { lt: now },
          }
        }),
        prisma.checkout.count({ where: { isDeleted: false, status: 'RETURNED' } }),
        prisma.checkout.groupBy({
          by: ['department'],
          where: { isDeleted: false },
          _count: { id: true },
        }),
        prisma.checkout.groupBy({
          by: ['status'],
          where: { isDeleted: false },
          _count: { id: true },
        }),
      ]);

      // Formulate simple KV mapping for grouped returns
      const checkoutsByDepartment = {};
      groupedByDept.forEach(item => {
        checkoutsByDepartment[item.department] = item._count.id;
      });

      const checkoutsByStatus = {};
      groupedByStatus.forEach(item => {
        checkoutsByStatus[item.status] = item._count.id;
      });

      return {
        totalCheckouts,
        activeCheckouts,
        pendingReturns,
        overdueDocuments,
        returnedDocuments,
        checkoutsByDepartment,
        checkoutsByStatus,
      };
    } catch (err) {
      handlePrismaError(err, 'getCheckoutStats');
    }
  }

  // =========================================================================
  // Soft Delete Lifecycle
  // =========================================================================

  /**
   * Soft-delete target checkout.
   */
  async softDelete(id, deletedById, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'softDelete');
    }
  }

  /**
   * Restore target checkout back from deletion.
   */
  async restore(id, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedById: null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'restore');
    }
  }

  /**
   * Consolidate updating all approval fields in one call.
   */
  async updateApprovalResult(id, data, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: {
          status: data.status,
          approvalStatus: data.approvalStatus,
          approvalId: data.approvalId,
          approvedById: data.approvedById,
          approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
          rejectionReason: data.rejectionReason || null,
          approvalComments: data.approvalComments || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateApprovalResult');
    }
  }

  /**
   * Update approval status on checkout.
   */
  async updateApprovalStatus(id, approvalStatus, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { approvalStatus },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateApprovalStatus');
    }
  }

  /**
   * Store approval reference ID.
   */
  async storeApprovalReference(id, approvalId, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { approvalId },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'storeApprovalReference');
    }
  }

  /**
   * Update approved by.
   */
  async updateApprovedBy(id, approvedById, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { approvedById },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateApprovedBy');
    }
  }

  /**
   * Update approved timestamp.
   */
  async updateApprovedTimestamp(id, approvedAt, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { approvedAt: approvedAt ? new Date(approvedAt) : null },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateApprovedTimestamp');
    }
  }

  /**
   * Store approval comments.
   */
  async storeApprovalComments(id, approvalComments, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { approvalComments },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'storeApprovalComments');
    }
  }

  /**
   * Store rejection reason.
   */
  async storeRejectionReason(id, rejectionReason, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id },
        data: { rejectionReason },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'storeRejectionReason');
    }
  }

  /**
   * Fetch approval-related checkout data.
   */
  async fetchApprovalRelatedData(id) {
    try {
      return await prisma.checkout.findUnique({
        where: { id },
        include: {
          document: {
            select: {
              id: true,
              name: true,
              classification: true,
            }
          },
          requestedBy: {
            select: {
              id: true,
              email: true,
              role: true,
              departmentId: true,
              department: true,
            }
          }
        }
      });
    } catch (err) {
      handlePrismaError(err, 'fetchApprovalRelatedData');
    }
  }

  /**
   * Create movement record.
   * Also updates current location on Checkout.
   */
  async createMovementRecord(checkoutId, data, tx = null) {
    const client = tx || prisma;
    try {
      const operation = async (prismaClient) => {
        const movement = await prismaClient.checkoutMovement.create({
          data: {
            checkoutId,
            documentId: data.documentId,
            versionId: data.versionId || null,
            currentLocation: data.currentLocation,
            previousLocation: data.previousLocation || null,
            destinationAddress: data.destinationAddress || null,
            externalOrganization: data.externalOrganization || null,
            status: data.status || 'CREATED',
            movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
            movementTime: data.movementTime || null,
            remarks: data.remarks || null,
            handlerName: data.handlerName,
            employeeId: data.employeeId || null,
            contactReference: data.contactReference || null,
            department: data.department || null,
            trackingReference: data.trackingReference || null,
            qrIdentifier: data.qrIdentifier || null,
            scanTimestamp: data.scanTimestamp ? new Date(data.scanTimestamp) : null,
            scanLocation: data.scanLocation || null,
          }
        });

        await prismaClient.checkout.update({
          where: { id: checkoutId },
          data: { currentLocation: data.currentLocation }
        });

        return movement;
      };

      if (tx) {
        return await operation(tx);
      } else {
        return await prisma.$transaction(async (prismaClient) => {
          return await operation(prismaClient);
        });
      }
    } catch (err) {
      handlePrismaError(err, 'createMovementRecord');
    }
  }

  /**
   * Fetch movement history.
   */
  async fetchMovementHistory(checkoutId) {
    try {
      return await prisma.checkoutMovement.findMany({
        where: { checkoutId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'fetchMovementHistory');
    }
  }

  /**
   * Update current location directly on Checkout.
   */
  async updateCurrentLocation(checkoutId, currentLocation, tx = null) {
    const client = tx || prisma;
    try {
      return await client.checkout.update({
        where: { id: checkoutId },
        data: { currentLocation },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateCurrentLocation');
    }
  }

  /**
   * Get latest movement status.
   */
  async getLatestMovementStatus(checkoutId) {
    try {
      const latest = await prisma.checkoutMovement.findFirst({
        where: { checkoutId },
        orderBy: { createdAt: 'desc' },
      });
      return latest ? latest.status : null;
    } catch (err) {
      handlePrismaError(err, 'getLatestMovementStatus');
    }
  }

  /**
   * Fetch movement timeline.
   */
  async fetchMovementTimeline(checkoutId) {
    try {
      const checkout = await prisma.checkout.findUnique({
        where: { id: checkoutId },
        include: {
          movements: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
      if (!checkout) return [];

      const timeline = [];

      timeline.push({
        event: 'REQUESTED',
        timestamp: checkout.createdAt,
        actor: checkout.employeeName,
        details: `Document requested for removal. Destination: ${checkout.destination}.`,
      });

      if (checkout.approvedAt) {
        timeline.push({
          event: checkout.status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
          timestamp: checkout.approvedAt,
          actor: checkout.approvedById || 'System',
          details: checkout.status === 'REJECTED' 
            ? `Request rejected. Reason: ${checkout.rejectionReason || 'No reason specified'}`
            : `Request approved for release.`,
        });
      }

      checkout.movements.forEach(m => {
        timeline.push({
          event: m.status,
          timestamp: m.movementDate,
          actor: m.handlerName,
          details: `Location: ${m.currentLocation}. ${m.remarks || ''}`,
          movementId: m.id
        });
      });

      return timeline;
    } catch (err) {
      handlePrismaError(err, 'fetchMovementTimeline');
    }
  }
}
export default CheckoutRepository;
