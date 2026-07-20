import DocumentService from '../services/documents.service.js';
import { lifecycleService } from '../services/lifecycle.service.js';

const documentService = new DocumentService();

/**
 * Maps service exception errors to corresponding HTTP status code envelopes.
 * 
 * @function mapServiceErrorToHttp
 * @param {Error} err - Service level exception error
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 */
function mapServiceErrorToHttp(err, res, next) {
  if (err.name === 'DocumentServiceError') {
    const errorMapping = {
      DOCUMENT_NOT_FOUND: 404,
      DUPLICATE_DOCUMENT: 409,
      INVALID_FOLDER: 400,
      INVALID_VAULT: 400,
      INVALID_DEPARTMENT: 400,
      INVALID_OWNER: 400,
      INVALID_STATE_TRANSITION: 400,
      VALIDATION_FAILED: 400,
      PERMISSION_DENIED: 403,
      STORAGE_FAILURE: 500,
      VERSION_NOT_FOUND: 404,
      UNSUPPORTED_PREVIEW: 400,
    };

    const statusCode = errorMapping[err.code] || 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  next(err);
}

/**
 * Controller class executing REST integrations for Document endpoints.
 */
export class DocumentsController {
  /**
   * Create a new document metadata profile.
   * 
   * @async
   * @method createDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async createDocument(req, res, next) {
    try {
      const ownerId = req.user?.id;
      const result = await documentService.createDocument({
        ...req.body,
        ownerId,
      });

      res.status(201).json({
        success: true,
        message: 'Document metadata created successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Get detail profile metadata for a document.
   * 
   * @async
   * @method getDocumentDetails
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async getDocumentDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.getDocumentDetails(id);

      res.status(200).json({
        success: true,
        message: 'Document details retrieved successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List non-deleted documents with filtering and search.
   * 
   * @async
   * @method listDocuments
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async listDocuments(req, res, next) {
    try {
      const result = await documentService.listDocuments(req.query);

      res.status(200).json({
        success: true,
        message: 'Documents listed successfully.',
        data: result.documents,
        meta: {
          total: result.total,
          page: Number(req.query?.page || 1),
          limit: Number(req.query?.limit || 10),
        },
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Update metadata modifications.
   * 
   * @async
   * @method updateDocumentMetadata
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async updateDocumentMetadata(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.updateDocumentMetadata(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Document metadata updated successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Archive an active document.
   * 
   * @async
   * @method archiveDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async archiveDocument(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.archiveDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document archived successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Restore a soft-deleted document.
   * 
   * @async
   * @method restoreDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async restoreDocument(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.restoreDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document restored successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Soft-delete a document record.
   * 
   * @async
   * @method softDeleteDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async softDeleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      await documentService.softDeleteDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document deleted successfully.',
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Processes file upload payloads and routes to storage and DB creation.
   * Supports both single and batch upload scenarios.
   * 
   * @async
   * @method uploadDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async uploadDocument(req, res, next) {
    try {
      const ownerId = req.user?.id;
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User context is missing.' }
        });
      }

      // Extract and normalize metadata inputs from request form fields
      const parseMetadata = (body) => {
        const metadata = {
          name: body.name || undefined,
          description: body.description || undefined,
          folderId: body.folderId === 'null' || body.folderId === '' ? null : body.folderId,
          vaultId: body.vaultId === 'null' || body.vaultId === '' ? null : body.vaultId,
          departmentId: body.departmentId === 'null' || body.departmentId === '' ? null : body.departmentId,
          classification: body.classification || 'INTERNAL',
          duplicatePolicy: body.duplicatePolicy || 'REJECT',
          documentNumber: body.documentNumber || undefined,
        };

        if (body.tags) {
          if (Array.isArray(body.tags)) {
            metadata.tags = body.tags;
          } else if (typeof body.tags === 'string') {
            metadata.tags = body.tags.split(',').map(t => t.trim()).filter(Boolean);
          }
        }
        return metadata;
      };

      const metadata = parseMetadata(req.body);

      // 1. Handle Single File Upload scenario
      if (req.file) {
        const result = await documentService.uploadDocument(req.file, metadata, ownerId);
        return res.status(201).json({
          success: true,
          message: 'Document uploaded and registered successfully.',
          data: result,
        });
      }

      // 2. Handle Multiple Batch File Uploads scenario
      if (req.files && req.files.length > 0) {
        const results = [];
        for (const file of req.files) {
          const fileMetadata = { ...metadata };
          // For batch uploads, default individual target name to original filename
          if (!fileMetadata.name) {
            fileMetadata.name = file.originalname;
          }
          const result = await documentService.uploadDocument(file, fileMetadata, ownerId);
          results.push(result);
        }

        return res.status(201).json({
          success: true,
          message: `${results.length} documents uploaded and registered successfully.`,
          data: results,
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'No file payload was transmitted in the upload request.'
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Executes advanced document search requests based on query filters and paging.
   * 
   * @async
   * @method searchDocuments
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async searchDocuments(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User context is missing.' }
        });
      }

      const result = await documentService.searchDocuments(req.query, user);

      res.status(200).json({
        success: true,
        message: 'Documents searched successfully.',
        data: result.documents,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Retrieves secure temporary signed preview URL information for a document.
   * 
   * @async
   * @method getDocumentPreview
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async getDocumentPreview(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await documentService.getSecurePreview(id, user);

      res.status(200).json({
        success: true,
        message: 'Secure document preview details resolved.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Resolves expiring direct download link parameters for latest or historic versions.
   * 
   * @async
   * @method downloadDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async downloadDocument(req, res, next) {
    try {
      const { id } = req.params;
      const { version } = req.query;
      const user = req.user;

      const result = await documentService.getSecureDownloadUrl(id, version, user);

      res.status(200).json({
        success: true,
        message: 'Secure document download link resolved.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Generates secure expiring direct signed URL for general file access.
   * 
   * @async
   * @method getDocumentAccessUrl
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async getDocumentAccessUrl(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await documentService.getSecureAccessUrl(id, user);

      res.status(200).json({
        success: true,
        message: 'Secure document access link resolved.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Lists all documents that are expiring soon.
   * 
   * @async
   * @method getExpiringDocuments
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async getExpiringDocuments(req, res, next) {
    try {
      const user = req.user;
      const result = await lifecycleService.getExpiringDocuments(user);

      res.status(200).json({
        success: true,
        message: 'Expiring documents retrieved successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Lists all documents that are currently expired.
   * 
   * @async
   * @method getExpiredDocuments
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async getExpiredDocuments(req, res, next) {
    try {
      const user = req.user;
      const result = await lifecycleService.getExpiredDocuments(user);

      res.status(200).json({
        success: true,
        message: 'Expired documents retrieved successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Extends the expiry date of a document.
   * 
   * @async
   * @method extendDocumentExpiry
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async extendDocumentExpiry(req, res, next) {
    try {
      const { id } = req.params;
      const { expiryDate } = req.body;
      const user = req.user;

      if (!expiryDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_FAILED', message: 'Missing target expiryDate parameter.' }
        });
      }

      const result = await lifecycleService.extendExpiryDate(id, expiryDate, user);

      res.status(200).json({
        success: true,
        message: 'Document expiry extended successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }
}

export default DocumentsController;
