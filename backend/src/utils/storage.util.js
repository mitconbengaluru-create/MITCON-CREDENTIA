import crypto from 'crypto';
import { BUCKET_CONFIG } from '../config/supabase.js';

/**
 * Maps standard extensions to their corresponding valid MIME types.
 * @type {Readonly<Record<string, string>>}
 */
export const SUPPORTED_FORMATS = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  zip: 'application/zip',
  csv: 'text/csv',
});

/**
 * Validates if the file extension is supported by BCD-FSS.
 * 
 * @function validateFileExtension
 * @param {string} filename - Target filename or extension
 * @param {string} [bucketName] - Optional bucket identifier for contextual check
 * @returns {boolean} True if supported, false otherwise
 */
export function validateFileExtension(filename, bucketName) {
  const ext = extractExtension(filename);
  if (!ext) return false;

  if (bucketName && BUCKET_CONFIG[bucketName]) {
    return BUCKET_CONFIG[bucketName].allowedExtensions.includes(ext);
  }

  return Object.keys(SUPPORTED_FORMATS).includes(ext);
}

/**
 * Validates if the MIME type matches supported formats.
 * 
 * @function validateMimeType
 * @param {string} mimeType - MIME type to validate
 * @param {string} [bucketName] - Optional bucket identifier for contextual check
 * @returns {boolean} True if supported, false otherwise
 */
export function validateMimeType(mimeType, bucketName) {
  if (!mimeType) return false;
  const cleanMime = mimeType.trim().toLowerCase();

  if (bucketName && BUCKET_CONFIG[bucketName]) {
    return BUCKET_CONFIG[bucketName].allowedMimeTypes.includes(cleanMime);
  }

  return Object.values(SUPPORTED_FORMATS).includes(cleanMime);
}

/**
 * Validates if the file size fits within the maximum limits.
 * 
 * @function validateFileSize
 * @param {number|BigInt} size - File size in bytes
 * @param {string} bucketName - Target bucket configuration identifier
 * @returns {boolean} True if within limits, false otherwise
 */
export function validateFileSize(size, bucketName) {
  const config = BUCKET_CONFIG[bucketName];
  if (!config) return false;
  return BigInt(size) <= BigInt(config.maxSize);
}

/**
 * Validates that the filename has valid length and no illegal directory characters.
 * 
 * @function validateFilename
 * @param {string} filename - Filename string
 * @returns {boolean} True if valid, false otherwise
 */
export function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const clean = filename.trim();
  if (clean.length === 0 || clean.length > 255) return false;

  // Restrict directory traversals or special system reserved names/chars
  const illegalPattern = /[\\/:*?"<>|]/;
  return !illegalPattern.test(clean);
}

/**
 * Appends a unique numerical suffix to duplicate filenames if they match existing.
 * 
 * @function handleDuplicateName
 * @param {string} filename - Original name
 * @param {Array<string>} existingFiles - List of existing filenames in target directory
 * @returns {string} Unique version of the filename
 */
export function handleDuplicateName(filename, existingFiles) {
  if (!existingFiles.includes(filename)) return filename;

  const ext = extractExtension(filename);
  const baseName = filename.slice(0, filename.lastIndexOf('.'));
  
  let counter = 1;
  let newName = `${baseName} (${counter})${ext ? `.${ext}` : ''}`;

  while (existingFiles.includes(newName)) {
    counter++;
    newName = `${baseName} (${counter})${ext ? `.${ext}` : ''}`;
  }

  return newName;
}

/**
 * Normalizes a filename by converting to lowercase, stripping unsafe characters.
 * 
 * @function normalizeFilename
 * @param {string} filename - Filename input
 * @returns {string} Sanitized filename
 */
export function normalizeFilename(filename) {
  if (!filename) return '';
  const ext = extractExtension(filename);
  let baseName = filename.includes('.') 
    ? filename.slice(0, filename.lastIndexOf('.'))
    : filename;

  // Strip special chars, replace spaces with underscores
  baseName = baseName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  return ext ? `${baseName}.${ext}` : baseName;
}

/**
 * Generates a unique filename by appending a secure random token.
 * 
 * @function generateUniqueFilename
 * @param {string} filename - Original filename
 * @returns {string} Unique filename
 */
export function generateUniqueFilename(filename) {
  const ext = extractExtension(filename);
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const baseName = filename.includes('.') 
    ? filename.slice(0, filename.lastIndexOf('.'))
    : filename;

  const cleanBase = normalizeFilename(baseName);
  return ext ? `${cleanBase}_${randomBytes}.${ext}` : `${cleanBase}_${randomBytes}`;
}

/**
 * Retrieves the extension in lowercase format without the dot.
 * 
 * @function extractExtension
 * @param {string} filename - Filename or key path
 * @returns {string} File extension (e.g. 'pdf')
 */
export function extractExtension(filename) {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop().trim().toLowerCase();
}

/**
 * Looks up the MIME type mapped to a filename extension.
 * 
 * @function extractMimeType
 * @param {string} filename - Filename
 * @returns {string} Mapped MIME type string
 */
export function extractMimeType(filename) {
  const ext = extractExtension(filename);
  return SUPPORTED_FORMATS[ext] || 'application/octet-stream';
}

/**
 * Generates a standard SHA-256 checksum string for a buffer.
 * 
 * @function generateChecksum
 * @param {Buffer} buffer - Target file buffer
 * @returns {string} SHA-256 checksum hash
 */
export function generateChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sanitizes file path strings, preventing directory traversal patterns like '..' or extra slashes.
 * 
 * @function sanitizeFilePath
 * @param {string} filePath - Absolute or relative path
 * @returns {string} Sanitized clean path
 */
export function sanitizeFilePath(filePath) {
  if (!filePath) return '';
  // Normalize slashes and remove traversals
  let clean = filePath
    .replace(/\\/g, '/')
    .replace(/\/\/+/g, '/')
    .split('/')
    .filter(segment => segment !== '..' && segment !== '.')
    .join('/');

  return clean.startsWith('/') ? clean.slice(1) : clean;
}

export function createStorageKey(prefix, filename) {
  const cleanPrefix = sanitizeFilePath(prefix);
  const uniqueName = generateUniqueFilename(filename);
  return cleanPrefix ? `${cleanPrefix}/${uniqueName}` : uniqueName;
}

/**
 * Maps MIME types to standard Preview types.
 * 
 * @function determinePreviewType
 * @param {string} mimeType - MIME type string
 * @returns {string|null} Resolved preview category type, or null if ineligible
 */
export function determinePreviewType(mimeType) {
  if (!mimeType) return null;
  const clean = mimeType.trim().toLowerCase();

  if (clean === 'application/pdf') return 'PDF';
  
  if (clean === 'image/png' || clean === 'image/jpeg' || clean === 'image/jpg') {
    return 'IMAGE';
  }

  const officeMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  if (officeMimes.includes(clean)) return 'OFFICE';

  if (clean === 'application/zip' || clean === 'application/x-zip-compressed') {
    return 'ZIP_META';
  }

  return null;
}

/**
 * Formats a BigInt or number byte size to standard string.
 * 
 * @function formatBytes
 * @param {number|BigInt} bytes - Size in bytes
 * @param {number} [decimals=2] - Decimals rounding parameter
 * @returns {string} Formatted size representation string
 */
export function formatBytes(bytes, decimals = 2) {
  const numBytes = Number(bytes);
  if (numBytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(numBytes) / Math.log(k));

  return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default {
  SUPPORTED_FORMATS,
  validateFileExtension,
  validateMimeType,
  validateFileSize,
  validateFilename,
  handleDuplicateName,
  normalizeFilename,
  generateUniqueFilename,
  extractExtension,
  extractMimeType,
  generateChecksum,
  sanitizeFilePath,
  createStorageKey,
  determinePreviewType,
  formatBytes,
};
