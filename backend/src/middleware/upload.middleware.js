import multer from 'multer';
import { STORAGE_BUCKETS } from '../config/supabase.js';
import {
  validateFileExtension,
  validateMimeType,
  validateFileSize,
  validateFilename
} from '../utils/storage.util.js';

// Configure memory storage engine
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Hard limit of 50MB per file for safety
  }
});

/**
 * Validates file magic bytes to verify integrity and prevent disguised executables.
 * 
 * @param {Buffer} buffer - File buffer contents
 * @param {string} mimeType - Declared mime type
 * @returns {boolean} True if magic bytes are valid
 */
export function checkMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();

  if (mimeType === 'application/pdf') {
    return hex === '25504446'; // %PDF
  }
  if (mimeType === 'image/png') {
    return hex === '89504E47'; // PNG header
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return hex.startsWith('FFD8FF'); // JPEG SOI
  }
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return hex.startsWith('504B'); // PK ZIP header
  }
  if (mimeType === 'text/csv' || mimeType === 'text/plain') {
    // Verify it is not a binary executable masquerading as text
    const sample = buffer.toString('utf8', 0, Math.min(buffer.length, 100));
    return !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(sample);
  }
  return true;
}

/**
 * Validates file constraints (name, extension, type, size) inside the upload middleware pipeline.
 * 
 * @function validateUploadedFile
 * @param {Express.Multer.File} file - Multer parsed file object
 * @param {string} [bucketName] - Target storage bucket identifier
 * @throws {Error} If validation constraints are violated
 */
function validateUploadedFile(file, bucketName = STORAGE_BUCKETS.DOCUMENTS) {
  if (!file) {
    throw new Error('No file payload was transmitted in the upload request.');
  }

  // 1. Validate naming rules
  if (!validateFilename(file.originalname)) {
    throw new Error(`Filename contains invalid characters: "${file.originalname}". Chars \\/:*?"<>| are not allowed.`);
  }

  // 2. Validate format extension
  if (!validateFileExtension(file.originalname, bucketName)) {
    throw new Error(`File format is not supported for filename: "${file.originalname}".`);
  }

  // 3. Validate MIME type
  if (!validateMimeType(file.mimetype, bucketName)) {
    throw new Error(`File MIME type is invalid or unsupported: "${file.mimetype}"`);
  }

  // 4. Validate file size
  if (!validateFileSize(file.size, bucketName)) {
    throw new Error(`File size is too large for the target bucket. File size: ${file.size} bytes.`);
  }

  // 5. Verify magic byte integrity
  if (!checkMagicBytes(file.buffer, file.mimetype)) {
    throw new Error(`Security Exception: Magic byte signature check failed for file "${file.originalname}" of type "${file.mimetype}". File header tampered or format invalid.`);
  }
}

/**
 * Middleware handling single file uploads under form field 'file'.
 */
export const uploadSingle = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'File size exceeds maximum allowed upload threshold (50MB).'
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: err.message
        }
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'No file payload was transmitted under the field name "file".'
          }
        });
      }
      validateUploadedFile(req.file);
      next();
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validationErr.message
        }
      });
    }
  });
};

/**
 * Middleware handling multiple file uploads under fields 'files' or 'file'.
 */
export const uploadMultiple = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'One of the files exceeds maximum allowed upload threshold (50MB).'
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: err.message
        }
      });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'No file payloads found in the upload request.'
          }
        });
      }

      for (const file of req.files) {
        validateUploadedFile(file);
      }
      next();
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validationErr.message
        }
      });
    }
  });
};

/**
 * Middleware handling single digital signature file uploads under form field 'file'.
 */
export const uploadSignature = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Signature file size exceeds maximum allowed threshold (5MB).'
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: err.message
          }
        });
      }

      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'No file payload was transmitted under the field name "file".'
            }
          });
        }
        validateUploadedFile(req.file, STORAGE_BUCKETS.SIGNATURES);
        next();
      } catch (validationErr) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: validationErr.message
          }
        });
      }
    });
  } else {
    next();
  }
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadSignature,
};
