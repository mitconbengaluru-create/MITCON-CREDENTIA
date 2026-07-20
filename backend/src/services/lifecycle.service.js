import { prisma } from '../config/database.js';
import DocumentRepository from '../repositories/documents.repository.js';
import { DocumentServiceError, DocumentResponseDto } from './documents.service.js';

const documentRepository = new DocumentRepository();

// Configurable retention rules based on DocumentClassification (in years)
const RETENTION_PERIODS = {
  PUBLIC: 1,       // 1 year
  INTERNAL: 3,     // 3 years
  CONFIDENTIAL: 7, // 7 years
  RESTRICTED: 10,  // 10 years
};

export class LifecycleService {
  /**
   * Calculates the expiry date of a document based on its creation date and classification.
   * 
   * @param {Date} createdAt - Document registration date
   * @param {string} classification - Document classification type (PUBLIC, INTERNAL, etc.)
   * @returns {Date} Calculated expiry date
   */
  calculateExpiryDate(createdAt, classification) {
    const baseDate = new Date(createdAt);
    const years = RETENTION_PERIODS[classification] || 3; // defaults to 3 years
    baseDate.setFullYear(baseDate.getFullYear() + years);
    return baseDate;
  }

  /**
   * Calculates days remaining until the expiry date.
   * 
   * @param {Date|null} expiryDate - Expiry date
   * @returns {number} Days remaining (can be negative if expired)
   */
  calculateDaysRemaining(expiryDate) {
    if (!expiryDate) return 0;
    const now = new Date();
    const diffTime = new Date(expiryDate).getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Runs the daily scanner to detect upcoming and past document expiries.
   * Updates status to EXPIRING_SOON or EXPIRED accordingly.
   * 
   * @async
   * @method runDailyExpiryScan
   * @returns {Promise<Object>} Summary of scanner execution
   */
  async runDailyExpiryScan() {
    console.info('[Lifecycle Scanner] Starting daily expiry scan...');
    const now = new Date();
    let expiringCount = 0;
    let expiredCount = 0;

    // 1. Process documents expiring within 30 days
    const expiringDocs = await documentRepository.findExpiringDocuments(30);
    for (const doc of expiringDocs) {
      const daysLeft = this.calculateDaysRemaining(doc.expiryDate);
      if (daysLeft <= 0) {
        await documentRepository.updateLifecycleStatus(doc.id, 'EXPIRED');
        expiredCount++;
        console.info(`[Lifecycle Scanner] Document ${doc.id} (${doc.name}) is now EXPIRED.`);
      } else if (doc.status === 'ACTIVE' && daysLeft <= 30) {
        await documentRepository.updateLifecycleStatus(doc.id, 'EXPIRING_SOON');
        expiringCount++;
        console.info(`[Lifecycle Scanner] Document ${doc.id} (${doc.name}) marked as EXPIRING_SOON (${daysLeft} days remaining).`);
      }
    }

    // 2. Process documents that have crossed their expiry date but are not marked EXPIRED
    const overdueDocs = await documentRepository.findExpiredDocuments();
    for (const doc of overdueDocs) {
      await documentRepository.updateLifecycleStatus(doc.id, 'EXPIRED');
      expiredCount++;
      console.info(`[Lifecycle Scanner] Overdue Document ${doc.id} (${doc.name}) marked as EXPIRED.`);
    }

    console.info(`[Lifecycle Scanner] Scan completed. Expiring soon: ${expiringCount}, Expired: ${expiredCount}`);
    return { expiringMarked: expiringCount, expiredMarked: expiredCount };
  }

  /**
   * Applies retention rules and automatically archives expired documents.
   * 
   * @async
   * @method runRetentionProcessor
   * @returns {Promise<Object>} Summary of retention actions
   */
  async runRetentionProcessor() {
    console.info('[Retention Processor] Processing retention rules...');
    let archivedCount = 0;

    // Find all expired documents
    const expiredDocs = await prisma.document.findMany({
      where: {
        isDeleted: false,
        status: 'EXPIRED',
      },
    });

    for (const doc of expiredDocs) {
      // Auto-archive expired documents immediately or based on compliance policy
      await documentRepository.updateLifecycleStatus(doc.id, 'ARCHIVED');
      archivedCount++;
      console.info(`[Retention Processor] Document ${doc.id} (${doc.name}) auto-archived post-expiry.`);
    }

    console.info(`[Retention Processor] Processing completed. Archived: ${archivedCount}`);
    return { archivedCount };
  }

  /**
   * Identifies records eligible for future cleanup (e.g. soft-deleted or archived documents).
   * Note: Does not delete physical files from storage.
   * 
   * @async
   * @method runCleanupPreparation
   * @returns {Promise<Object>} Summary of eligible cleanup records
   */
  async runCleanupPreparation() {
    console.info('[Cleanup Sweeper] Identifying records eligible for cleanup...');

    // Find documents deleted more than 1 year ago or archived for more than 5 years
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const eligibleDocs = await prisma.document.findMany({
      where: {
        OR: [
          { isDeleted: true, deletedAt: { lte: oneYearAgo } },
          { status: 'ARCHIVED', updatedAt: { lte: oneYearAgo } }
        ]
      },
      select: {
        id: true,
        name: true,
        status: true,
        isDeleted: true,
      }
    });

    console.info(`[Cleanup Sweeper] Identified ${eligibleDocs.length} documents eligible for future disposal.`);
    return { eligibleCount: eligibleDocs.length, records: eligibleDocs };
  }

  /**
   * Extends the expiry date of a document.
   * Restores status to ACTIVE if the document was previously EXPIRED or EXPIRING_SOON.
   * 
   * @async
   * @method extendExpiryDate
   * @param {string} id - Document UUID
   * @param {string|Date} newExpiryDate - New expiry date
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>} Updated document and lifecycle info
   */
  async extendExpiryDate(id, newExpiryDate, user) {
    // Only ADMIN or OWNER can extend expiry dates
    const doc = await documentRepository.findById(id);
    if (!doc || doc.isDeleted) {
      throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');
    }

    if (user.role !== 'ADMIN' && doc.ownerId !== user.id) {
      throw new DocumentServiceError('You do not have permission to extend the expiry of this document.', 'PERMISSION_DENIED');
    }

    const expiryTarget = new Date(newExpiryDate);
    if (isNaN(expiryTarget.getTime())) {
      throw new DocumentServiceError('Invalid expiry date value.', 'VALIDATION_FAILED');
    }

    if (expiryTarget <= new Date()) {
      throw new DocumentServiceError('Extended expiry date must be in the future.', 'VALIDATION_FAILED');
    }

    const previousExpiry = doc.expiryDate;
    
    // Save previous expiry info if needed by audit trails
    console.info('[Audit Hook] Document expiry extended', {
      documentId: id,
      previousExpiry,
      newExpiry: expiryTarget,
      userId: user.id
    });

    // Update expiry date and restore status to ACTIVE if it was EXPIRED or EXPIRING_SOON
    let nextStatus = doc.status;
    if (doc.status === 'EXPIRED' || doc.status === 'EXPIRING_SOON') {
      nextStatus = 'ACTIVE';
    }

    const updatedDoc = await prisma.document.update({
      where: { id },
      data: {
        expiryDate: expiryTarget,
        status: nextStatus,
      },
    });

    return {
      documentId: updatedDoc.id,
      currentStatus: updatedDoc.status,
      expiryDate: updatedDoc.expiryDate,
      daysRemaining: this.calculateDaysRemaining(updatedDoc.expiryDate),
      retentionPolicy: updatedDoc.classification,
      lastUpdated: updatedDoc.updatedAt,
    };
  }

  /**
   * Lists all documents that are currently EXPIRING_SOON.
   * Scopes visibility by role permissions.
   * 
   * @async
   * @method getExpiringDocuments
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array<Object>>} List of expiring soon documents DTO
   */
  async getExpiringDocuments(user) {
    const where = {
      isDeleted: false,
      status: 'EXPIRING_SOON',
      ...(user.role !== 'ADMIN' && { ownerId: user.id }),
    };
    const docs = await prisma.document.findMany({
      where,
      include: documentRepository._defaultIncludes,
    });
    return docs.map(DocumentResponseDto.fromRecord);
  }

  /**
   * Lists all documents that are currently EXPIRED.
   * Scopes visibility by role permissions.
   * 
   * @async
   * @method getExpiredDocuments
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array<Object>>} List of expired documents DTO
   */
  async getExpiredDocuments(user) {
    const where = {
      isDeleted: false,
      status: 'EXPIRED',
      ...(user.role !== 'ADMIN' && { ownerId: user.id }),
    };
    const docs = await prisma.document.findMany({
      where,
      include: documentRepository._defaultIncludes,
    });
    return docs.map(DocumentResponseDto.fromRecord);
  }
}

export const lifecycleService = new LifecycleService();
export default lifecycleService;
