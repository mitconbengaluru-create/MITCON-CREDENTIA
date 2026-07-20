import crypto from 'crypto';
import { prisma } from '../config/database.js';
import DocumentRepository from '../repositories/documents.repository.js';
import { generateDocumentStoragePath } from '../utils/documents.util.js';
import { generateChecksum, handleDuplicateName, determinePreviewType, formatBytes } from '../utils/storage.util.js';
import { StorageService } from './storage/storage.service.js';
import { STORAGE_BUCKETS } from '../config/supabase.js';
import { lifecycleService } from './lifecycle.service.js';

const documentRepository = new DocumentRepository();

/**
 * Standardized service-level exception class for Document Domain business rules.
 */
export class DocumentServiceError extends Error {
  /**
   * @param {string} message - Human-readable exception details
   * @param {string} [code='VALIDATION_FAILED'] - Service error code
   */
  constructor(message, code = 'VALIDATION_FAILED') {
    super(message);
    this.name = 'DocumentServiceError';
    this.code = code;
  }
}

/**
 * DTO representing sanitized document response schemas.
 */
export class DocumentResponseDto {
  constructor(docRecord) {
    this.id = docRecord.id;
    this.name = docRecord.name;
    this.documentNumber = docRecord.documentNumber;
    this.description = docRecord.description || null;
    this.tags = docRecord.tags || [];
    this.folderId = docRecord.folderId;
    this.vaultId = docRecord.vaultId;
    this.departmentId = docRecord.departmentId;
    this.ownerId = docRecord.ownerId;
    this.storageProvider = docRecord.storageProvider;
    this.storageBucket = docRecord.storageBucket;
    this.storagePath = docRecord.storagePath;
    this.mimeType = docRecord.mimeType;
    this.fileSize = docRecord.fileSize.toString(); // Map BigInt to standard string representation
    this.checksum = docRecord.checksum || null;
    this.classification = docRecord.classification;
    this.status = docRecord.status;
    this.version = docRecord.version;
    this.isLocked = docRecord.isLocked;
    this.lockedById = docRecord.lockedById || null;
    this.lockedAt = docRecord.lockedAt || null;
    this.createdAt = docRecord.createdAt;
    this.updatedAt = docRecord.updatedAt;
    this.expiryDate = docRecord.expiryDate ? docRecord.expiryDate.toISOString() : null;
    this.daysRemaining = docRecord.expiryDate ? lifecycleService.calculateDaysRemaining(docRecord.expiryDate) : null;
    this.retentionPolicy = docRecord.classification;
    this.lastUpdated = docRecord.updatedAt;

    if (docRecord.owner) {
      this.owner = {
        id: docRecord.owner.id,
        email: docRecord.owner.email,
      };
    }
    if (docRecord.department) {
      this.department = {
        id: docRecord.department.id,
        name: docRecord.department.name,
      };
    }
    if (docRecord.folder) {
      this.folder = {
        id: docRecord.folder.id,
        name: docRecord.folder.name,
      };
    }
    if (docRecord.vault) {
      this.vault = {
        id: docRecord.vault.id,
        name: docRecord.vault.name,
      };
    }
    if (docRecord.versions && docRecord.versions.length > 0) {
      this.currentVersionDetails = {
        id: docRecord.versions[0].id,
        version: docRecord.versions[0].version,
        filePath: docRecord.versions[0].filePath,
        changeLog: docRecord.versions[0].changeLog,
        createdAt: docRecord.versions[0].createdAt,
      };
    }
  }

  /**
   * Translate a single DB record to DocumentResponseDto.
   * @static
   */
  static fromRecord(docRecord) {
    return new DocumentResponseDto(docRecord);
  }
}

/**
 * Service orchestrating Document domain business rules.
 */
export class DocumentService {
  // =========================================================================
  // Business Rules & Validations
  // =========================================================================

  /**
   * Validate document name structure rules (restricts illegal characters).
   * @private
   */
  _validateDocumentName(name) {
    if (!name || typeof name !== 'string') {
      throw new DocumentServiceError('Document name must be a non-empty string.', 'VALIDATION_FAILED');
    }
    
    // Character exclusions for naming safety
    const illegalCharsRegex = /[\\/:*?"<>|]/;
    if (illegalCharsRegex.test(name)) {
      throw new DocumentServiceError(
        'Document name contains invalid characters (illegal: \\ / : * ? " < > |).',
        'VALIDATION_FAILED'
      );
    }
  }

  /**
   * Validate classifications enum.
   * @private
   */
  _validateClassification(classification) {
    const allowed = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
    if (!allowed.includes(classification)) {
      throw new DocumentServiceError(
        `Invalid classification: ${classification}. Allowed values: ${allowed.join(', ')}`,
        'VALIDATION_FAILED'
      );
    }
  }

  /**
   * Enforces BCD-FSS lifecycle status state machine rules.
   * @private
   */
  _validateStatusTransition(current, target) {
    if (current === target) return;

    if (current === 'INFECTED') {
      throw new DocumentServiceError(
        'Infected documents are quarantined and cannot transition to other states.',
        'INVALID_STATE_TRANSITION'
      );
    }

    const transitions = {
      PENDING_UPLOAD: ['DRAFT', 'ACTIVE', 'INFECTED'],
      DRAFT: ['ACTIVE', 'ARCHIVED', 'INFECTED'],
      ACTIVE: ['ARCHIVED', 'INFECTED', 'DRAFT'],
      ARCHIVED: ['ACTIVE', 'DRAFT'],
    };

    const allowed = transitions[current] || [];
    if (!allowed.includes(target)) {
      throw new DocumentServiceError(
        `Lifecycle status transition not permitted: from ${current} to ${target}.`,
        'INVALID_STATE_TRANSITION'
      );
    }
  }

  /**
   * Validates existences of relational constraints.
   * @private
   */
  async _validateRelationalConstraints(data) {
    // 1. Vault check
    if (data.vaultId) {
      const vault = await prisma.vault.findUnique({ where: { id: data.vaultId } });
      if (!vault) throw new DocumentServiceError('Target Vault record does not exist.', 'INVALID_VAULT');
      if (vault.isDeleted || vault.status === 'DISABLED') {
        throw new DocumentServiceError('Target Vault is currently archived or disabled.', 'INVALID_VAULT');
      }
    }

    // 2. Folder check
    if (data.folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: data.folderId } });
      if (!folder) throw new DocumentServiceError('Target Folder record does not exist.', 'INVALID_FOLDER');
      if (folder.isDeleted || folder.status === 'DISABLED') {
        throw new DocumentServiceError('Target Folder is currently deleted or disabled.', 'INVALID_FOLDER');
      }
    }

    // 3. User / Owner check
    if (data.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: data.ownerId } });
      if (!owner) throw new DocumentServiceError('Target User / Owner does not exist.', 'INVALID_OWNER');
    }

    // 4. Department check
    if (data.departmentId) {
      const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!department) throw new DocumentServiceError('Target Department does not exist.', 'INVALID_DEPARTMENT');
    }
  }

  /**
   * Checks uniqueness within folder boundaries.
   * @private
   */
  async _validateUniquenessInFolder(name, folderId, vaultId, excludeId = null) {
    const duplicate = await prisma.document.findFirst({
      where: {
        name,
        folderId: folderId || null,
        vaultId: vaultId || null,
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (duplicate) {
      throw new DocumentServiceError(
        `A document named "${name}" already exists in this folder path.`,
        'DUPLICATE_DOCUMENT'
      );
    }
  }

  /**
   * Asserts document is not deleted or archived.
   * @private
   */
  _assertWritableState(doc) {
    if (doc.isDeleted) {
      throw new DocumentServiceError('Operations are restricted on soft-deleted documents.', 'VALIDATION_FAILED');
    }
    if (doc.status === 'ARCHIVED') {
      throw new DocumentServiceError('Operations are restricted on archived documents.', 'VALIDATION_FAILED');
    }
  }

  // =========================================================================
  // Document Operations Business Logic
  // =========================================================================

  /**
   * Create a new document metadata record.
   */
  async createDocument(data) {
    // 1. Core validations
    this._validateDocumentName(data.name);
    if (data.classification) this._validateClassification(data.classification);

    // 2. Validate existences of constraints
    await this._validateRelationalConstraints(data);

    // 3. Validate folder uniqueness
    await this._validateUniquenessInFolder(data.name, data.folderId, data.vaultId);

    // 4. Verify duplicate serial number
    const serialNumber = data.documentNumber || `DOC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const duplicateSerial = await prisma.document.findFirst({
      where: { documentNumber: serialNumber, isDeleted: false },
    });
    if (duplicateSerial) {
      throw new DocumentServiceError(`Document number "${serialNumber}" is already assigned to a record.`, 'DUPLICATE_DOCUMENT');
    }

    // 5. Tag normalization
    const normalizedTags = data.tags 
      ? data.tags.map(t => t.toString().trim().toLowerCase()).filter(Boolean)
      : [];

    const doc = await documentRepository.create({
      ...data,
      documentNumber: serialNumber,
      tags: normalizedTags,
      status: 'PENDING_UPLOAD',
    });

    return DocumentResponseDto.fromRecord(doc);
  }

  /**
   * Fetch a Document details.
   */
  async getDocumentDetails(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');
    return DocumentResponseDto.fromRecord(doc);
  }

  /**
   * List documents with filters.
   */
  async listDocuments(params) {
    const { documents, total } = await documentRepository.list(params);
    return {
      documents: documents.map(DocumentResponseDto.fromRecord),
      total,
    };
  }

  /**
   * Update metadata settings.
   */
  async updateDocumentMetadata(id, data) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    // Prevent modifying archived or deleted files
    this._assertWritableState(doc);

    // If updating name or directories, validate uniqueness
    if (data.name || data.folderId || data.vaultId) {
      const targetName = data.name || doc.name;
      const targetFolder = data.folderId !== undefined ? data.folderId : doc.folderId;
      const targetVault = data.vaultId !== undefined ? data.vaultId : doc.vaultId;
      
      if (data.name) this._validateDocumentName(targetName);
      await this._validateUniquenessInFolder(targetName, targetFolder, targetVault, id);
    }

    // Validate relational checks
    await this._validateRelationalConstraints(data);

    // Tag normalization
    let normalizedTags = undefined;
    if (data.tags) {
      normalizedTags = data.tags.map(t => t.toString().trim().toLowerCase()).filter(Boolean);
    }

    // Check status transition
    if (data.status) {
      this._validateStatusTransition(doc.status, data.status);
    }

    const updated = await documentRepository.update(id, {
      ...data,
      ...(normalizedTags && { tags: normalizedTags }),
    });

    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Archive a document.
   */
  async archiveDocument(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    if (doc.isDeleted) {
      throw new DocumentServiceError('Quarantined or soft-deleted records cannot be archived.', 'VALIDATION_FAILED');
    }

    this._validateStatusTransition(doc.status, 'ARCHIVED');

    const updated = await documentRepository.archive(id);
    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Restore a soft-deleted document.
   */
  async restoreDocument(id) {
    const doc = await prisma.document.findUnique({
      where: { id },
    });
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    if (!doc.isDeleted) return DocumentResponseDto.fromRecord(doc);

    const updated = await documentRepository.restore(id);
    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Soft-delete a document record.
   */
  async softDeleteDocument(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    if (doc.isDeleted) return DocumentResponseDto.fromRecord(doc);

    const updated = await documentRepository.softDelete(id);
    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Verifies folder permission rules for a user context.
   * 
   * @async
   * @private
   * @method _verifyFolderWritePermission
   * @param {string} folderId - Target folder UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>} True if permitted, false otherwise
   */
  async _verifyFolderWritePermission(folderId, userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    // Admin role bypasses folder permissions
    if (user?.role === 'ADMIN') return true;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { ownerId: true },
    });

    if (!folder) return false;

    // Folder owner has write permission
    if (folder.ownerId === userId) return true;

    // Check explicit permissions
    const permissions = await prisma.folderPermission.findMany({
      where: { folderId },
    });

    // If folder has no permissions configured, fallback to allowed
    if (permissions.length === 0) return true;

    // Look for the user's specific permission
    const userPermission = permissions.find(p => p.userId === userId);
    if (userPermission && ['WRITE', 'ADMIN'].includes(userPermission.permission)) {
      return true;
    }

    return false;
  }

  /**
   * Performs file upload to storage and persists database metadata in a transaction-like manner.
   * 
   * @async
   * @method uploadDocument
   * @param {Object} file - Multer file object
   * @param {Object} metadata - Metadata fields
   * @param {string} ownerId - ID of user executing upload
   * @returns {Promise<DocumentResponseDto>}
   */
  async uploadDocument(file, metadata, ownerId) {
    // 1. Enforce validation of relation constraints
    await this._validateRelationalConstraints({
      folderId: metadata.folderId || null,
      vaultId: metadata.vaultId || null,
      departmentId: metadata.departmentId || null,
      ownerId,
    });

    // 2. Validate classification if provided
    if (metadata.classification) {
      this._validateClassification(metadata.classification);
    }

    // 3. Folder authorization check
    if (metadata.folderId) {
      const isPermitted = await this._verifyFolderWritePermission(metadata.folderId, ownerId);
      if (!isPermitted) {
        throw new DocumentServiceError('You do not have write permissions for this folder.', 'PERMISSION_DENIED');
      }
    }

    // 4. Extract and normalize filename
    const originalName = file.originalname;
    let targetName = metadata.name || originalName;
    this._validateDocumentName(targetName);

    // 5. Generate checksum (SHA-256)
    const checksum = generateChecksum(file.buffer);

    // 6. Check duplicate policy
    const duplicatePolicy = metadata.duplicatePolicy || 'REJECT'; // 'REJECT' or 'RENAME'
    
    // Check if duplicate content exists
    const duplicateChecksum = await prisma.document.findFirst({
      where: {
        folderId: metadata.folderId || null,
        vaultId: metadata.vaultId || null,
        checksum,
        isDeleted: false,
      },
    });

    if (duplicateChecksum) {
      throw new DocumentServiceError(
        `A document with identical content (checksum) already exists in this folder path.`,
        'DUPLICATE_DOCUMENT'
      );
    }

    const hasDuplicateName = await prisma.document.findFirst({
      where: {
        name: targetName,
        folderId: metadata.folderId || null,
        vaultId: metadata.vaultId || null,
        isDeleted: false,
      },
    });

    if (hasDuplicateName) {
      if (duplicatePolicy === 'REJECT') {
        throw new DocumentServiceError(
          `A document named "${targetName}" already exists in this folder.`,
          'DUPLICATE_DOCUMENT'
        );
      } else if (duplicatePolicy === 'RENAME') {
        // Find existing names in the same folder path
        const existingDocs = await prisma.document.findMany({
          where: {
            folderId: metadata.folderId || null,
            vaultId: metadata.vaultId || null,
            isDeleted: false,
          },
          select: { name: true },
        });
        const existingNames = existingDocs.map(d => d.name);
        targetName = handleDuplicateName(targetName, existingNames);
      }
    }

    // 7. Generate dynamic path parameters
    let deptName = 'default';
    if (metadata.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: metadata.departmentId },
        select: { name: true },
      });
      if (dept) deptName = dept.name;
    }

    const documentId = crypto.randomUUID();
    const version = 1;
    
    const storagePath = generateDocumentStoragePath({
      departmentId: deptName,
      documentId,
      version,
      filename: targetName,
    });

    // 8. Perform upload (Supabase Storage)
    try {
      await StorageService.uploadObject(
        STORAGE_BUCKETS.DOCUMENTS,
        storagePath,
        file.buffer,
        { contentType: file.mimetype }
      );
    } catch (err) {
      throw new DocumentServiceError(`Storage upload failed: ${err.message}`, 'STORAGE_FAILURE');
    }

    // 9. Persist database record with atomic rollback checks
    try {
      const classification = metadata.classification || 'INTERNAL';
      const expiryDate = lifecycleService.calculateExpiryDate(new Date(), classification);

      const doc = await documentRepository.create({
        id: documentId,
        name: targetName,
        documentNumber: metadata.documentNumber,
        description: metadata.description,
        tags: metadata.tags,
        folderId: metadata.folderId || null,
        vaultId: metadata.vaultId || null,
        departmentId: metadata.departmentId || null,
        ownerId,
        storageProvider: 'SUPABASE',
        storageBucket: STORAGE_BUCKETS.DOCUMENTS,
        storagePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        checksum,
        classification,
        status: 'ACTIVE',
        version,
        expiryDate,
      });

      return DocumentResponseDto.fromRecord(doc);
    } catch (dbErr) {
      // Rollback file upload in Supabase Storage
      console.warn(`[Atomic Rollback Triggered] Deleting orphaned file at path: ${storagePath}`);
      try {
        await StorageService.deleteObject(STORAGE_BUCKETS.DOCUMENTS, storagePath);
      } catch (delErr) {
        console.error(`[Critical Error] Failed to delete orphaned storage object during database rollback:`, delErr);
      }
      throw dbErr; // Rethrow database error
    }
  }

  /**
   * Performs advanced document searching with filters and pagination metadata.
   * 
   * @async
   * @method searchDocuments
   * @param {Object} params - Query filters and pagination
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>} Results and pagination metadata DTO
   */
  async searchDocuments(params, user) {
    // 1. Resolve security visibility bounds
    let securityClause = {};
    if (user.role !== 'ADMIN') {
      const userDb = await prisma.user.findUnique({
        where: { id: user.id },
        select: { departmentId: true },
      });

      securityClause = {
        OR: [
          { ownerId: user.id },
          { classification: 'PUBLIC' },
          ...(userDb?.departmentId ? [{ departmentId: userDb.departmentId }] : []),
          {
            folder: {
              permissions: {
                some: {
                  userId: user.id,
                }
              }
            }
          }
        ]
      };
    }

    // 2. Normalize and prepare filter parameters
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
    } = params;

    // Normalizing tag arrays if passed as comma-separated string
    let normalizedTags = undefined;
    if (tags) {
      normalizedTags = Array.isArray(tags)
        ? tags
        : tags.toString().split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }

    // Validate classifications if passed
    if (classification) {
      this._validateClassification(classification);
    }

    const { documents, total } = await documentRepository.search({
      page: Number(page),
      limit: Number(limit),
      sortBy,
      sortOrder,
      search,
      id,
      name,
      description,
      documentNumber,
      tags: normalizedTags,
      folderId,
      vaultId,
      departmentId,
      ownerId,
      classification,
      status,
      mimeType,
      extension,
      minSize: minSize !== undefined ? Number(minSize) : undefined,
      maxSize: maxSize !== undefined ? Number(maxSize) : undefined,
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
      securityClause,
    });

    const totalRecords = total;
    const totalPages = Math.ceil(totalRecords / limit);
    const currentPage = Number(page);

    return {
      documents: documents.map(DocumentResponseDto.fromRecord),
      pagination: {
        currentPage,
        totalPages,
        totalRecords,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      }
    };
  }

  /**
   * Verifies document access permissions based on role, ownership, and department/folder boundaries.
   * 
   * @async
   * @method verifyDocumentAccess
   * @param {Object} doc - Document DB record
   * @param {Object} user - User context
   * @returns {Promise<boolean>} True if permitted, false otherwise
   */
  async verifyDocumentAccess(doc, user) {
    if (user.role === 'ADMIN') return true;
    if (doc.ownerId === user.id) return true;
    if (doc.classification === 'PUBLIC') return true;

    // Resolve user's department
    const userDb = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (userDb?.departmentId && doc.departmentId === userDb.departmentId) {
      return true;
    }

    // Check folder permission record
    if (doc.folderId) {
      const folderPerm = await prisma.folderPermission.findFirst({
        where: {
          folderId: doc.folderId,
          userId: user.id,
        },
      });
      if (folderPerm && ['READ', 'WRITE', 'ADMIN'].includes(folderPerm.permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generates secure temporary signed preview URL details for a document.
   * 
   * @async
   * @method getSecurePreview
   * @param {string} id - Document UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>} Preview details DTO containing expiring signed URL
   */
  async getSecurePreview(id, user) {
    const doc = await documentRepository.findById(id);
    if (!doc || doc.isDeleted) {
      throw new DocumentServiceError('Document not found or deleted.', 'DOCUMENT_NOT_FOUND');
    }

    // Check archived rules
    if (doc.status === 'ARCHIVED' && user.role !== 'ADMIN') {
      throw new DocumentServiceError('Archived files can only be accessed by administrator roles.', 'PERMISSION_DENIED');
    }

    // Verify user visibility permissions
    const isPermitted = await this.verifyDocumentAccess(doc, user);
    if (!isPermitted) {
      throw new DocumentServiceError('You do not have permission to access this document.', 'PERMISSION_DENIED');
    }

    // Verify preview type eligibility
    const previewType = determinePreviewType(doc.mimeType);
    if (!previewType) {
      throw new DocumentServiceError('This document format is not supported for inline previewing.', 'UNSUPPORTED_PREVIEW');
    }

    // Generate signed preview link (300 seconds window)
    let urlData;
    try {
      urlData = await StorageService.generateDownloadUrl(doc.storageBucket, doc.storagePath, 300);
    } catch (err) {
      throw new DocumentServiceError(`Failed to fetch secure storage link: ${err.message}`, 'STORAGE_FAILURE');
    }

    // Future Audit integration hooks
    console.info('[Audit Hook] Document viewed event', { documentId: id, userId: user.id });

    return {
      documentId: doc.id,
      name: doc.name,
      mimeType: doc.mimeType,
      fileSize: formatBytes(doc.fileSize),
      version: doc.version,
      previewType,
      temporaryAccessUrl: urlData.signedUrl,
      expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
    };
  }

  /**
   * Generates secure expiring download URL for a document.
   * Supports specific version fetching.
   * 
   * @async
   * @method getSecureDownloadUrl
   * @param {string} id - Document UUID
   * @param {number|string} [versionNumber] - Optional specific version identifier
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>} Signed download payload containing expiring link
   */
  async getSecureDownloadUrl(id, versionNumber, user) {
    const doc = await documentRepository.findById(id);
    if (!doc || doc.isDeleted) {
      throw new DocumentServiceError('Document not found or deleted.', 'DOCUMENT_NOT_FOUND');
    }

    // Status checks
    if (doc.status === 'ARCHIVED' && user.role !== 'ADMIN') {
      throw new DocumentServiceError('Archived documents can only be downloaded by administrators.', 'PERMISSION_DENIED');
    }

    // Verify permission boundary
    const isPermitted = await this.verifyDocumentAccess(doc, user);
    if (!isPermitted) {
      throw new DocumentServiceError('You do not have permission to download this document.', 'PERMISSION_DENIED');
    }

    // Resolve target path (either latest or historic version revision)
    let targetPath = doc.storagePath;
    let targetVersion = doc.version;

    if (versionNumber) {
      const parsedVer = Number(versionNumber);
      if (parsedVer !== doc.version) {
        const verRecord = await documentRepository.findVersionRecord(id, parsedVer);
        if (!verRecord) {
          throw new DocumentServiceError(`Version ${parsedVer} of this document does not exist.`, 'VERSION_NOT_FOUND');
        }
        targetPath = verRecord.filePath;
        targetVersion = verRecord.version;
      }
    }

    // Generate signed link (15 minutes download window)
    let urlData;
    try {
      urlData = await StorageService.generateDownloadUrl(doc.storageBucket, targetPath, 900);
    } catch (err) {
      throw new DocumentServiceError(`Failed to fetch secure storage link: ${err.message}`, 'STORAGE_FAILURE');
    }

    // Future Audit integration hooks
    console.info('[Audit Hook] Document downloaded event', { documentId: id, version: targetVersion, userId: user.id });

    return {
      temporaryAccessUrl: urlData.signedUrl,
      expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
    };
  }

  /**
   * Gateway alias resolving temporary access signed URL.
   * 
   * @async
   * @method getSecureAccessUrl
   * @param {string} id - Document UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>} Payload containing signed URL
   */
  async getSecureAccessUrl(id, user) {
    return this.getSecureDownloadUrl(id, undefined, user);
  }
}

export default DocumentService;
