import { prisma } from '../config/database.js';

/**
 * Standardized repository error class for Report Domain operations.
 */
export class ReportRepositoryError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='REPORT_REPOSITORY_ERROR'] - Error categorization code
   * @param {Error} [originalError] - The underlying Prisma/DB exception
   */
  constructor(message, code = 'REPORT_REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'ReportRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps Prisma errors to standard ReportRepositoryError.
 * 
 * @function handlePrismaError
 * @param {Error} err - Caught exception
 * @param {string} operationName - Name of the repository operation
 * @returns {never} Always throws ReportRepositoryError
 */
function handlePrismaError(err, operationName) {
  console.error(`[ReportRepository] Error in ${operationName}:`, err);
  
  if (err instanceof ReportRepositoryError) {
    throw err;
  }

  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new ReportRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  
  if (err.code === 'P2025') {
    throw new ReportRepositoryError(
      `Target report record was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }

  throw new ReportRepositoryError(
    `Database error occurred during report ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

/**
 * Database repository implementation for Report operations.
 */
export class ReportRepository {
  /**
   * Default relations loaded with Report profiles.
   * @private
   */
  _defaultIncludes = {
    user: {
      select: {
        id: true,
        email: true,
        role: true,
        departmentId: true,
      }
    },
    scheduledReport: true,
    history: {
      orderBy: {
        createdAt: 'asc'
      }
    }
  };

  /**
   * Helper to select the database client context (transaction-aware).
   * @private
   * @param {Object} [tx] - Optional Prisma transactional context
   * @returns {Object} Prisma database client instance
   */
  _getClient(tx) {
    return tx || prisma;
  }

  // =========================================================================
  // Report Persistence & Lifecycle
  // =========================================================================

  /**
   * Create a new report request entry.
   * 
   * @async
   * @method createReport
   * @param {Object} data - Report initialization payload
   * @param {Object} [tx] - Optional transaction client
   * @returns {Promise<Object>} The created report record
   * @throws {ReportRepositoryError}
   */
  async createReport(data, tx) {
    const client = this._getClient(tx);
    try {
      return await client.report.create({
        data: {
          id: data.id || undefined,
          refNumber: data.refNumber,
          name: data.name,
          type: data.type,
          description: data.description || null,
          format: data.format,
          status: data.status || 'QUEUED',
          userId: data.userId || null,
          userSnapshot: data.userSnapshot || null,
          departmentSnapshot: data.departmentSnapshot || null,
          filters: data.filters || null,
          sorting: data.sorting || null,
          columns: data.columns || null,
          storageProvider: data.storageProvider || null,
          bucketName: data.bucketName || null,
          filePath: data.filePath || null,
          fileName: data.fileName || null,
          fileSize: data.fileSize !== undefined && data.fileSize !== null ? BigInt(data.fileSize) : null,
          fileHash: data.fileHash || null,
          generatedAt: data.generatedAt || null,
          expiryDate: data.expiryDate || null,
          startedAt: data.startedAt || null,
          completedAt: data.completedAt || null,
          processingTime: data.processingTime || null,
          failureReason: data.failureReason || null,
          retryCount: data.retryCount || 0,
          autoArchive: data.autoArchive || false,
          retentionPeriod: data.retentionPeriod || null,
          scheduledReportId: data.scheduledReportId || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'createReport');
    }
  }

  /**
   * Find a report record by ID.
   * 
   * @async
   * @method getReportById
   * @param {string} id - Report ID
   * @returns {Promise<Object|null>} Report details
   */
  async getReportById(id) {
    try {
      return await prisma.report.findUnique({
        where: { id },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'getReportById');
    }
  }

  /**
   * Find a report record by its unique reference number.
   * 
   * @async
   * @method getReportByRef
   * @param {string} refNumber - Report reference number
   * @returns {Promise<Object|null>} Report details
   */
  async getReportByRef(refNumber) {
    try {
      return await prisma.report.findUnique({
        where: { refNumber },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'getReportByRef');
    }
  }

  /**
   * Update report processing status.
   * 
   * @async
   * @method updateReportStatus
   * @param {string} id - Report ID
   * @param {string} status - New report status enum
   * @param {Object} [details={}] - Optional metadata like failures or timestamps
   * @param {Object} [tx] - Optional transaction client
   * @returns {Promise<Object>} Updated report record
   */
  async updateReportStatus(id, status, details = {}, tx) {
    const client = this._getClient(tx);
    try {
      return await client.report.update({
        where: { id },
        data: {
          status,
          startedAt: details.startedAt || undefined,
          completedAt: details.completedAt || undefined,
          processingTime: details.processingTime || undefined,
          failureReason: details.failureReason || null,
          retryCount: details.retryCount !== undefined ? details.retryCount : undefined,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateReportStatus');
    }
  }

  /**
   * Update report file storage metadata.
   * 
   * @async
   * @method updateGeneratedFileInfo
   * @param {string} id - Report ID
   * @param {Object} fileInfo - Storage metadata payload
   * @param {Object} [tx] - Optional transaction client
   * @returns {Promise<Object>} Updated report record
   */
  async updateGeneratedFileInfo(id, fileInfo, tx) {
    const client = this._getClient(tx);
    try {
      return await client.report.update({
        where: { id },
        data: {
          storageProvider: fileInfo.storageProvider,
          bucketName: fileInfo.bucketName,
          filePath: fileInfo.filePath,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize !== undefined && fileInfo.fileSize !== null ? BigInt(fileInfo.fileSize) : undefined,
          fileHash: fileInfo.fileHash,
          generatedAt: fileInfo.generatedAt || new Date(),
          expiryDate: fileInfo.expiryDate || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateGeneratedFileInfo');
    }
  }

  /**
   * List reports using dynamic filters and paging options.
   * 
   * @async
   * @method listReports
   * @param {Object} [filters={}] - Filter keys
   * @param {Object} [options={}] - Pagination and sorting
   * @returns {Promise<{logs: Array<Object>, total: number}>} Results list and total count
   */
  async listReports(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;
      const whereClause = this._buildWhereClause(filters);

      const [logs, total] = await prisma.$transaction([
        prisma.report.findMany({
          where: whereClause,
          include: this._defaultIncludes,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip,
        }),
        prisma.report.count({
          where: whereClause,
        }),
      ]);

      return { logs, total };
    } catch (err) {
      handlePrismaError(err, 'listReports');
    }
  }

  /**
   * Builds where query clause dynamically.
   * @private
   */
  _buildWhereClause(filters) {
    const where = {};

    if (filters.id) where.id = filters.id;
    if (filters.refNumber) where.refNumber = filters.refNumber;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.format) where.format = filters.format;
    if (filters.userId) where.userId = filters.userId;
    if (filters.departmentSnapshot) where.departmentSnapshot = filters.departmentSnapshot;
    if (filters.scheduledReportId) where.scheduledReportId = filters.scheduledReportId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: new Date(filters.startDate) }),
        ...(filters.endDate && { lte: new Date(filters.endDate) }),
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { refNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  // =========================================================================
  // Report History (Audit Trail)
  // =========================================================================

  /**
   * Create an immutable history event trail record for reports.
   * 
   * @async
   * @method createHistoryEntry
   * @param {Object} data - History details
   * @param {Object} [tx] - Optional transaction client
   * @returns {Promise<Object>} Created history log
   */
  async createHistoryEntry(data, tx) {
    const client = this._getClient(tx);
    try {
      return await client.reportHistory.create({
        data: {
          reportId: data.reportId,
          action: data.action,
          performedBy: data.performedBy,
          timestamp: data.timestamp || new Date(),
          metadata: data.metadata || null,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'createHistoryEntry');
    }
  }

  /**
   * Retrieve timelines for a report.
   * 
   * @async
   * @method getReportTimeline
   * @param {string} reportId - Report ID
   * @returns {Promise<Array<Object>>} Action history chronologically
   */
  async getReportTimeline(reportId) {
    try {
      return await prisma.reportHistory.findMany({
        where: { reportId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getReportTimeline');
    }
  }

  // =========================================================================
  // Scheduled Reports
  // =========================================================================

  /**
   * Create report scheduling config.
   */
  async createSchedule(data) {
    try {
      return await prisma.scheduledReport.create({
        data: {
          name: data.name,
          reportType: data.reportType,
          format: data.format,
          frequency: data.frequency,
          recipients: data.recipients || [],
          filters: data.filters || null,
          sorting: data.sorting || null,
          columns: data.columns || null,
          nextExecutionTime: data.nextExecutionTime || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          ownerId: data.ownerId,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'createSchedule');
    }
  }

  /**
   * Update report scheduling configuration.
   */
  async updateSchedule(id, data) {
    try {
      return await prisma.scheduledReport.update({
        where: { id },
        data: {
          name: data.name,
          reportType: data.reportType,
          format: data.format,
          frequency: data.frequency,
          recipients: data.recipients || undefined,
          filters: data.filters || undefined,
          sorting: data.sorting || undefined,
          columns: data.columns || undefined,
          nextExecutionTime: data.nextExecutionTime || undefined,
          isActive: data.isActive !== undefined ? data.isActive : undefined,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'updateSchedule');
    }
  }

  /**
   * Disable a report schedule config.
   */
  async disableSchedule(id) {
    try {
      return await prisma.scheduledReport.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (err) {
      handlePrismaError(err, 'disableSchedule');
    }
  }

  /**
   * Fetch active schedules.
   */
  async listActiveSchedules() {
    try {
      return await prisma.scheduledReport.findMany({
        where: { isActive: true },
      });
    } catch (err) {
      handlePrismaError(err, 'listActiveSchedules');
    }
  }

  /**
   * Fetch schedules due for execution.
   */
  async listDueSchedules(currentTime = new Date()) {
    try {
      return await prisma.scheduledReport.findMany({
        where: {
          isActive: true,
          nextExecutionTime: { lte: new Date(currentTime) },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'listDueSchedules');
    }
  }

  // =========================================================================
  // Dashboard & Analytics (Metrics Retrieval)
  // =========================================================================

  /**
   * Aggregates document lifecycle statistics.
   */
  async getDocumentStats() {
    try {
      const totalCount = await prisma.document.count({ where: { isDeleted: false } });
      const statusGroup = await prisma.document.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { id: true },
      });
      const classificationGroup = await prisma.document.groupBy({
        by: ['classification'],
        where: { isDeleted: false },
        _count: { id: true },
        _sum: { fileSize: true },
      });
      const departmentGroup = await prisma.document.groupBy({
        by: ['departmentId'],
        where: { isDeleted: false },
        _count: { id: true },
      });
      return { totalCount, statusGroup, classificationGroup, departmentGroup };
    } catch (err) {
      handlePrismaError(err, 'getDocumentStats');
    }
  }

  /**
   * Aggregates checkout metrics.
   */
  async getCheckoutStats() {
    try {
      const totalCount = await prisma.checkout.count({ where: { isDeleted: false } });
      const statusGroup = await prisma.checkout.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { id: true },
      });
      const overdueCount = await prisma.checkout.count({
        where: {
          isDeleted: false,
          expectedReturnDate: { lt: new Date() },
          returnedDate: null,
          status: { in: ['CHECKED_OUT', 'PENDING_RETURN'] },
        }
      });
      return { totalCount, statusGroup, overdueCount };
    } catch (err) {
      handlePrismaError(err, 'getCheckoutStats');
    }
  }

  /**
   * Aggregates approval flows metrics.
   */
  async getApprovalStats() {
    try {
      const totalCount = await prisma.approvalRequest.count({ where: { isDeleted: false } });
      const statusGroup = await prisma.approvalRequest.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { id: true },
      });
      const completedRequests = await prisma.approvalRequest.findMany({
        where: { status: 'APPROVED', isDeleted: false },
        select: { createdAt: true, updatedAt: true },
      });
      return { totalCount, statusGroup, completedRequests };
    } catch (err) {
      handlePrismaError(err, 'getApprovalStats');
    }
  }

  /**
   * Aggregates digital signature metrics.
   */
  async getSignatureStats() {
    try {
      const totalCount = await prisma.digitalSignature.count({ where: { isDeleted: false } });
      const statusGroup = await prisma.digitalSignature.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { id: true },
      });
      const verificationStatusGroup = await prisma.digitalSignature.groupBy({
        by: ['verificationStatus'],
        where: { isDeleted: false },
        _count: { id: true },
      });
      return { totalCount, statusGroup, verificationStatusGroup };
    } catch (err) {
      handlePrismaError(err, 'getSignatureStats');
    }
  }

  /**
   * Aggregates audit logs categories.
   */
  async getAuditStats() {
    try {
      const totalCount = await prisma.auditLog.count();
      const categoryGroup = await prisma.auditLog.groupBy({
        by: ['category'],
        _count: { id: true },
      });
      const resultGroup = await prisma.auditLog.groupBy({
        by: ['result'],
        _count: { id: true },
      });
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const countToday = await prisma.auditLog.count({
        where: { createdAt: { gte: todayStart } },
      });
      return { totalCount, categoryGroup, resultGroup, countToday };
    } catch (err) {
      handlePrismaError(err, 'getAuditStats');
    }
  }

  /**
   * Aggregates user activities counts.
   */
  async getUserActivityStats() {
    try {
      const activityByUser = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
        _count: { id: true },
      });
      const activityByDepartment = await prisma.auditLog.groupBy({
        by: ['departmentSnapshot'],
        where: { departmentSnapshot: { not: null } },
        _count: { id: true },
      });
      return { activityByUser, activityByDepartment };
    } catch (err) {
      handlePrismaError(err, 'getUserActivityStats');
    }
  }

  // =========================================================================
  // Retention Support
  // =========================================================================

  /**
   * Fetch expired reports based on their deletion or expiry dates.
   * 
   * @async
   * @method findExpiredReports
   * @returns {Promise<Array<Object>>} List of expired report records
   */
  async findExpiredReports() {
    try {
      return await prisma.report.findMany({
        where: {
          status: 'COMPLETED',
          expiryDate: { lte: new Date() },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findExpiredReports');
    }
  }

  /**
   * Fetch a user profile with their department details.
   * 
   * @async
   * @method getUserWithDepartment
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} User and department details
   */
  async getUserWithDepartment(userId) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        include: {
          department: true,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getUserWithDepartment');
    }
  }
}

export default ReportRepository;
