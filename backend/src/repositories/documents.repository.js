import { prisma } from '../config/database.js';

/**
 * Standardized repository error class for Document Domain operations.
 */
export class DocumentRepositoryError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='REPOSITORY_ERROR'] - Error categorization code
   * @param {Error} [originalError] - The underlying Prisma/DB exception
   */
  constructor(message, code = 'REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'DocumentRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps Prisma errors to standard DocumentRepositoryError.
 * 
 * @function handlePrismaError
 * @param {Error} err - Caught exception
 * @param {string} operationName - Name of the repository operation
 * @returns {never} Always throws DocumentRepositoryError
 */
function handlePrismaError(err, operationName) {
  console.error(`[DocumentRepository] Error in ${operationName}:`, err);
  
  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new DocumentRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  
  if (err.code === 'P2025') {
    throw new DocumentRepositoryError(
      `Target record for operation was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }

  throw new DocumentRepositoryError(
    `Database error occurred during ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

/**
 * Database repository implementation for Document operations.
 * Abstractions of queries utilizing Prisma client singletons.
 */
export class DocumentRepository {
  /**
   * Default relations loaded with Document profiles.
   * @private
   */
  _defaultIncludes = {
    owner: {
      select: { id: true, email: true, role: true }
    },
    department: true,
    folder: true,
    vault: true,
    versions: {
      orderBy: { version: 'desc' },
      take: 1
    }
  };

  // =========================================================================
  // Document CRUD Operations
  // =========================================================================

  /**
   * Create a new document metadata record.
   * 
   * @async
   * @method create
   * @param {Object} data - Document creation data
   * @returns {Promise<Object>} Created document record
   * @throws {DocumentRepositoryError}
   */
  async create(data) {
    try {
      return await prisma.document.create({
        data: {
          id: data.id || undefined,
          name: data.name,
          documentNumber: data.documentNumber || null,
          description: data.description || null,
          tags: data.tags || [],
          folderId: data.folderId || null,
          vaultId: data.vaultId || null,
          departmentId: data.departmentId || null,
          ownerId: data.ownerId,
          storageProvider: data.storageProvider || 'SUPABASE',
          storageBucket: data.storageBucket,
          storagePath: data.storagePath,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          checksum: data.checksum || null,
          classification: data.classification || 'INTERNAL',
          status: data.status || 'PENDING_UPLOAD',
          version: data.version || 1,
          expiryDate: data.expiryDate || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'create');
    }
  }

  /**
   * Update an existing document metadata record.
   * 
   * @async
   * @method update
   * @param {string} id - Document primary UUID
   * @param {Object} data - Parameters to update
   * @returns {Promise<Object>} Updated document record
   * @throws {DocumentRepositoryError}
   */
  async update(id, data) {
    try {
      return await prisma.document.update({
        where: { id },
        data,
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'update');
    }
  }

  /**
   * Find a document by its ID.
   * 
   * @async
   * @method findById
   * @param {string} id - Document primary UUID
   * @returns {Promise<Object|null>} Resolved document record or null
   * @throws {DocumentRepositoryError}
   */
  async findById(id) {
    try {
      return await prisma.document.findFirst({
        where: {
          id,
          isDeleted: false,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'findById');
    }
  }

  /**
   * Find a document by its unique Document Number.
   * 
   * @async
   * @method findByDocumentNumber
   * @param {string} documentNumber - Document number identifier
   * @returns {Promise<Object|null>} Resolved document record or null
   * @throws {DocumentRepositoryError}
   */
  async findByDocumentNumber(documentNumber) {
    try {
      return await prisma.document.findFirst({
        where: {
          documentNumber,
          isDeleted: false,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'findByDocumentNumber');
    }
  }

  /**
   * List non-deleted documents with pagination, filtering, and sorting.
   * 
   * @async
   * @method list
   * @param {Object} [options={}] - Pagination, sorting, and filter options
   * @returns {Promise<{documents: Array<Object>, total: number}>} List of documents and count
   * @throws {DocumentRepositoryError}
   */
  async list(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeDeleted = false,
        folderId,
        vaultId,
        departmentId,
        ownerId,
        classification,
        status,
        search,
        tags,
      } = options;

      const skip = (page - 1) * limit;

      const whereClause = {
        ...(includeDeleted ? {} : { isDeleted: false }),
        ...(folderId && { folderId }),
        ...(vaultId && { vaultId }),
        ...(departmentId && { departmentId }),
        ...(ownerId && { ownerId }),
        ...(classification && { classification }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(tags && tags.length > 0 && {
          tags: {
            hasSome: tags,
          },
        }),
      };

      const [documents, total] = await prisma.$transaction([
        prisma.document.findMany({
          where: whereClause,
          include: this._defaultIncludes,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip,
        }),
        prisma.document.count({
          where: whereClause,
        }),
      ]);

      return { documents, total };
    } catch (err) {
      handlePrismaError(err, 'list');
    }
  }

  /**
   * Soft-delete a document (sets isDeleted to true).
   * 
   * @async
   * @method softDelete
   * @param {string} id - Document primary UUID
   * @returns {Promise<Object>} Soft-deleted document record
   * @throws {DocumentRepositoryError}
   */
  async softDelete(id) {
    try {
      return await prisma.document.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    } catch (err) {
      handlePrismaError(err, 'softDelete');
    }
  }

  /**
   * Restore a soft-deleted document.
   * 
   * @async
   * @method restore
   * @param {string} id - Document primary UUID
   * @returns {Promise<Object>} Restored document record
   * @throws {DocumentRepositoryError}
   */
  async restore(id) {
    try {
      return await prisma.document.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'restore');
    }
  }

  /**
   * Archive an active document (sets status to ARCHIVED).
   * 
   * @async
   * @method archive
   * @param {string} id - Document primary UUID
   * @returns {Promise<Object>} Archived document record
   * @throws {DocumentRepositoryError}
   */
  async archive(id) {
    try {
      return await prisma.document.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          isArchived: true,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'archive');
    }
  }

  // =========================================================================
  // Query Shortcuts
  // =========================================================================

  /**
   * List non-deleted documents under a specific folder.
   */
  async listByFolder(folderId, params = {}) {
    return this.list({ ...params, folderId });
  }

  /**
   * List non-deleted documents inside a specific vault.
   */
  async listByVault(vaultId, params = {}) {
    return this.list({ ...params, vaultId });
  }

  /**
   * List non-deleted documents belonging to a department.
   */
  async listByDepartment(departmentId, params = {}) {
    return this.list({ ...params, departmentId });
  }

  /**
   * List non-deleted documents owned by a user.
   */
  async listByOwner(ownerId, params = {}) {
    return this.list({ ...params, ownerId });
  }

  /**
   * List non-deleted documents matching a classification.
   */
  async listByClassification(classification, params = {}) {
    return this.list({ ...params, classification });
  }

  /**
   * List non-deleted documents matching a lifecycle status.
   */
  async listByStatus(status, params = {}) {
    return this.list({ ...params, status });
  }

  // =========================================================================
  // Aggregated Statistics
  // =========================================================================

  /**
   * Count total documents (optionally including soft-deleted ones).
   * 
   * @async
   * @method getTotalDocuments
   * @param {Object} [options={}] - Options to customize counting
   * @returns {Promise<number>} Documents count
   * @throws {DocumentRepositoryError}
   */
  async getTotalDocuments(options = {}) {
    try {
      const { includeDeleted = false } = options;
      return await prisma.document.count({
        where: {
          ...(includeDeleted ? {} : { isDeleted: false }),
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getTotalDocuments');
    }
  }

  /**
   * Count active documents (not deleted, status is ACTIVE).
   */
  async getActiveDocumentsCount() {
    try {
      return await prisma.document.count({
        where: {
          isDeleted: false,
          status: 'ACTIVE',
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getActiveDocumentsCount');
    }
  }

  /**
   * Count archived documents.
   */
  async getArchivedDocumentsCount() {
    try {
      return await prisma.document.count({
        where: {
          isDeleted: false,
          status: 'ARCHIVED',
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getArchivedDocumentsCount');
    }
  }

  /**
   * Count soft-deleted documents.
   */
  async getDeletedDocumentsCount() {
    try {
      return await prisma.document.count({
        where: {
          isDeleted: true,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getDeletedDocumentsCount');
    }
  }

  /**
   * Group and count documents by Department.
   * 
   * @async
   * @method getDocumentsCountByDepartment
   * @returns {Promise<Array<{departmentId: string, _count: { id: number }}>>} Department stats
   * @throws {DocumentRepositoryError}
   */
  async getDocumentsCountByDepartment() {
    try {
      return await prisma.document.groupBy({
        by: ['departmentId'],
        where: { isDeleted: false },
        _count: { id: true },
      });
    } catch (err) {
      handlePrismaError(err, 'getDocumentsCountByDepartment');
    }
  }

  /**
   * Group and count documents by Classification.
   * 
   * @async
   * @method getDocumentsCountByClassification
   * @returns {Promise<Array<{classification: string, _count: { id: number }}>>} Classification stats
   * @throws {DocumentRepositoryError}
   */
  async getDocumentsCountByClassification() {
    try {
      return await prisma.document.groupBy({
        by: ['classification'],
        where: { isDeleted: false },
        _count: { id: true },
      });
    } catch (err) {
      handlePrismaError(err, 'getDocumentsCountByClassification');
    }
  }

  /**
   * Performs advanced document search with complex filtering and security context routing.
   * 
   * @async
   * @method search
   * @param {Object} params - Advanced search and sorting parameters
   * @returns {Promise<{documents: Array<Object>, total: number}>} List of documents and count
   * @throws {DocumentRepositoryError}
   */
  async search(params = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        id,
        name,
        description,
        documentNumber,
        tags,
        folderId,
        vaultId,
        departmentId,
        ownerId,
        classification,
        status,
        mimeType,
        extension,
        minSize,
        maxSize,
        createdAtStart,
        createdAtEnd,
        updatedAtStart,
        updatedAtEnd,
        securityClause = {},
      } = params;

      const skip = (page - 1) * limit;

      // Construct dynamic filters
      const whereClause = {
        isDeleted: false,
        ...securityClause,
        ...(id && { id }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
        ...(description && { description: { contains: description, mode: 'insensitive' } }),
        ...(documentNumber && { documentNumber: { contains: documentNumber, mode: 'insensitive' } }),
        ...(folderId && { folderId }),
        ...(vaultId && { vaultId }),
        ...(departmentId && { departmentId }),
        ...(ownerId && { ownerId }),
        ...(classification && { classification }),
        ...(status && { status }),
        ...(mimeType && { mimeType: { contains: mimeType, mode: 'insensitive' } }),
        
        ...(extension && {
          name: { endsWith: `.${extension.toLowerCase()}`, mode: 'insensitive' }
        }),

        ...(tags && tags.length > 0 && {
          tags: { hasSome: tags },
        }),

        ...((minSize !== undefined || maxSize !== undefined) && {
          fileSize: {
            ...(minSize !== undefined && { gte: BigInt(minSize) }),
            ...(maxSize !== undefined && { lte: BigInt(maxSize) }),
          }
        }),

        ...((createdAtStart || createdAtEnd) && {
          createdAt: {
            ...(createdAtStart && { gte: new Date(createdAtStart) }),
            ...(createdAtEnd && { lte: new Date(createdAtEnd) }),
          }
        }),
        ...((updatedAtStart || updatedAtEnd) && {
          updatedAt: {
            ...(updatedAtStart && { gte: new Date(updatedAtStart) }),
            ...(updatedAtEnd && { lte: new Date(updatedAtEnd) }),
          }
        }),

        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { storagePath: { contains: search, mode: 'insensitive' } },
          ],
        }),
      };

      const [documents, total] = await prisma.$transaction([
        prisma.document.findMany({
          where: whereClause,
          include: this._defaultIncludes,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip,
        }),
        prisma.document.count({
          where: whereClause,
        }),
      ]);

      return { documents, total };
    } catch (err) {
      handlePrismaError(err, 'search');
    }
  }

  /**
   * Find a specific document version record.
   * 
   * @async
   * @method findVersionRecord
   * @param {string} documentId - Target document UUID
   * @param {number} versionNumber - Version revision number
   * @returns {Promise<Object|null>} File version record
   * @throws {DocumentRepositoryError}
   */
  async findVersionRecord(documentId, versionNumber) {
    try {
      return await prisma.fileVersion.findFirst({
        where: {
          documentId,
          version: versionNumber,
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findVersionRecord');
    }
  }

  /**
   * Verifies if a document metadata profile exists by ID.
   * 
   * @async
   * @method verifyDocumentExists
   * @param {string} id - Document UUID
   * @returns {Promise<boolean>} True if exists, false otherwise
   * @throws {DocumentRepositoryError}
   */
  async verifyDocumentExists(id) {
    try {
      const count = await prisma.document.count({
        where: { id, isDeleted: false },
      });
      return count > 0;
    } catch (err) {
      handlePrismaError(err, 'verifyDocumentExists');
    }
  }

  /**
   * Find documents that are expiring within a certain number of days (status is ACTIVE or EXPIRING_SOON).
   * 
   * @async
   * @method findExpiringDocuments
   * @param {number} [days=30] - Expiry threshold window in days
   * @returns {Promise<Array<Object>>} List of expiring document records
   * @throws {DocumentRepositoryError}
   */
  async findExpiringDocuments(days = 30) {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);

      return await prisma.document.findMany({
        where: {
          isDeleted: false,
          status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
          expiryDate: {
            gt: new Date(),
            lte: targetDate,
          },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findExpiringDocuments');
    }
  }

  /**
   * Find documents that have crossed their expiry date but are not marked EXPIRED yet.
   * 
   * @async
   * @method findExpiredDocuments
   * @returns {Promise<Array<Object>>} List of expired document records
   * @throws {DocumentRepositoryError}
   */
  async findExpiredDocuments() {
    try {
      return await prisma.document.findMany({
        where: {
          isDeleted: false,
          status: { not: 'EXPIRED' },
          expiryDate: {
            lte: new Date(),
          },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'findExpiredDocuments');
    }
  }

  /**
   * Update the lifecycle status of a document.
   * 
   * @async
   * @method updateLifecycleStatus
   * @param {string} id - Document primary UUID
   * @param {string} status - New DocumentStatus value
   * @returns {Promise<Object>} Updated document record
   * @throws {DocumentRepositoryError}
   */
  async updateLifecycleStatus(id, status) {
    try {
      return await prisma.document.update({
        where: { id },
        data: { status },
      });
    } catch (err) {
      handlePrismaError(err, 'updateLifecycleStatus');
    }
  }

  /**
   * Update the expiry date of a document.
   * 
   * @async
   * @method updateExpiryDate
   * @param {string} id - Document primary UUID
   * @param {Date|null} expiryDate - Expiry date target
   * @returns {Promise<Object>} Updated document record
   * @throws {DocumentRepositoryError}
   */
  async updateExpiryDate(id, expiryDate) {
    try {
      return await prisma.document.update({
        where: { id },
        data: { expiryDate },
      });
    } catch (err) {
      handlePrismaError(err, 'updateExpiryDate');
    }
  }

  /**
   * Bulk updates lifecycle statuses for matching document IDs.
   * 
   * @async
   * @method bulkUpdateLifecycle
   * @param {Array<string>} ids - List of document primary UUIDs
   * @param {string} status - New DocumentStatus value
   * @returns {Promise<Object>} Prisma affected count payload
   * @throws {DocumentRepositoryError}
   */
  async bulkUpdateLifecycle(ids, status) {
    try {
      return await prisma.document.updateMany({
        where: {
          id: { in: ids },
        },
        data: { status },
      });
    } catch (err) {
      handlePrismaError(err, 'bulkUpdateLifecycle');
    }
  }
}

export default DocumentRepository;
