import { supabaseAdmin } from '../../config/supabase.js';

/**
 * Standardized storage-level exception wrapper class.
 */
export class StorageError extends Error {
  /**
   * @param {string} message - Human-readable exception details
   * @param {string} code - Application-specific classification error code
   * @param {number} [status=500] - Associated HTTP status suggestion
   */
  constructor(message, code, status = 500) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Normalizes caught Supabase or system exceptions to StorageErrors.
 * 
 * @function handleStorageException
 * @param {Error|Object} err - Caught exception
 * @param {string} fallbackCode - Default code categorization if not parsed contextually
 * @returns {StorageError} Normalized standard exception
 */
function handleStorageException(err, fallbackCode) {
  console.error(`[Storage Service Internal Error]:`, err);
  const message = err.message || 'An unexpected storage provider failure occurred.';
  const status = err.status || 500;

  // Map common error patterns
  if (message.includes('Bucket not found') || status === 404 && message.includes('bucket')) {
    return new StorageError(`Storage bucket configuration not found: ${message}`, 'BUCKET_NOT_FOUND', 404);
  }
  if (message.includes('Object not found') || status === 404 || err.error === 'Object not found') {
    return new StorageError(`Requested storage object not found: ${message}`, 'OBJECT_NOT_FOUND', 404);
  }
  if (message.includes('expired') || status === 400 && message.includes('expire')) {
    return new StorageError(`Access token or signed URL has expired: ${message}`, 'EXPIRED_SIGNED_URL', 400);
  }

  return new StorageError(message, fallbackCode, status);
}

/**
 * Storage Service Infrastructure Wrapper.
 * Provides abstraction for interacting with Supabase Storage buckets.
 * Executes administrative storage tasks (generating signed URLs, deleting objects, moving objects)
 * using the privileged Service Role Admin client.
 */
export class StorageService {
  // =========================================================================
  // Signed URLs Handling
  // =========================================================================

  /**
   * Generates a signed URL to allow direct uploads from client applications.
   * Safe upload window defaults to 5 minutes (300 seconds).
   * 
   * @async
   * @static
   * @function generateUploadUrl
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Remote file destination key path
   * @param {number} [expiresInSeconds=300] - Expiry threshold for the upload window
   * @returns {Promise<{signedUrl: string, token: string, path: string}>} Upload payload options
   * @throws {StorageError}
   */
  static async generateUploadUrl(bucket, path, expiresInSeconds = 300) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(path, { expiresIn: expiresInSeconds });

      if (error) throw error;
      return data;
    } catch (err) {
      throw handleStorageException(err, 'UPLOAD_URL_GEN_FAILED');
    }
  }

  /**
   * Generates a read-only signed URL to retrieve private objects.
   * Safe access window defaults to 15 minutes (900 seconds).
   * 
   * @async
   * @static
   * @function generateDownloadUrl
   * @param {string} bucket - Source storage bucket identifier
   * @param {string} path - Remote file source key path
   * @param {number} [expiresInSeconds=900] - Expiry threshold for the download window
   * @returns {Promise<{signedUrl: string}>} Download payload options
   * @throws {StorageError}
   */
  static async generateDownloadUrl(bucket, path, expiresInSeconds = 900) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

      if (error) throw error;
      return data;
    } catch (err) {
      throw handleStorageException(err, 'DOWNLOAD_URL_GEN_FAILED');
    }
  }

  // =========================================================================
  // Physical Storage Object Operations
  // =========================================================================

  /**
   * Uploads a raw file buffer or blob stream directly into target bucket.
   * 
   * @async
   * @static
   * @function uploadObject
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Remote key destination path
   * @param {Buffer|ArrayBuffer|Blob|ArrayBufferView} fileBody - Binary data payload
   * @param {Object} [options={}] - Config parameters (contentType, cacheControl)
   * @returns {Promise<{path: string}>} Uploaded object key details
   * @throws {StorageError}
   */
  static async uploadObject(bucket, path, fileBody, options = {}) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(path, fileBody, {
          upsert: true,
          contentType: options.contentType || 'application/octet-stream',
          cacheControl: options.cacheControl || '3600',
        });

      if (error) throw error;
      return data;
    } catch (err) {
      throw handleStorageException(err, 'UPLOAD_FAILURE');
    }
  }

  /**
   * Downloads a binary object payload from target bucket.
   * 
   * @async
   * @static
   * @function downloadObject
   * @param {string} bucket - Source storage bucket identifier
   * @param {string} path - Remote file source key path
   * @returns {Promise<Blob>} Binary Blob object
   * @throws {StorageError}
   */
  static async downloadObject(bucket, path) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .download(path);

      if (error) throw error;
      return data;
    } catch (err) {
      throw handleStorageException(err, 'DOWNLOAD_FAILURE');
    }
  }

  /**
   * Streams a binary object payload directly to a writable response stream.
   * 
   * @async
   * @static
   * @function streamObjectDownload
   * @param {string} bucket - Source storage bucket identifier
   * @param {string} path - Remote file source key path
   * @param {import('express').Response} res - Express Response object
   * @returns {Promise<void>}
   * @throws {StorageError}
   */
  static async streamObjectDownload(bucket, path, res) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .download(path);

      if (error) throw error;
      
      const buffer = Buffer.from(await data.arrayBuffer());
      res.write(buffer);
      res.end();
    } catch (err) {
      throw handleStorageException(err, 'DOWNLOAD_FAILURE');
    }
  }

  /**
   * Deletes a binary object from the target bucket.
   * 
   * @async
   * @static
   * @function deleteObject
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Remote file key path to delete
   * @returns {Promise<void>}
   * @throws {StorageError}
   */
  static async deleteObject(bucket, path) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
    } catch (err) {
      throw handleStorageException(err, 'DELETE_FAILURE');
    }
  }

  /**
   * Moves or renames an object from one path to another inside the same bucket.
   * 
   * @async
   * @static
   * @function moveObject
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} fromPath - Source key path
   * @param {string} toPath - Destination key path
   * @returns {Promise<void>}
   * @throws {StorageError}
   */
  static async moveObject(bucket, fromPath, toPath) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .move(fromPath, toPath);

      if (error) throw error;
    } catch (err) {
      throw handleStorageException(err, 'MOVE_FAILURE');
    }
  }

  /**
   * Clones/copies an object from one key location to another within the same bucket.
   * 
   * @async
   * @static
   * @function copyObject
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} fromPath - Source key path
   * @param {string} toPath - Destination key path
   * @returns {Promise<void>}
   * @throws {StorageError}
   */
  static async copyObject(bucket, fromPath, toPath) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .copy(fromPath, toPath);

      if (error) throw error;
    } catch (err) {
      throw handleStorageException(err, 'COPY_FAILURE');
    }
  }

  /**
   * Verifies if an object exists at the specified key.
   * 
   * @async
   * @static
   * @function checkObjectExistence
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Remote key path to check
   * @returns {Promise<boolean>} True if exists, false otherwise
   * @throws {StorageError}
   */
  static async checkObjectExistence(bucket, path) {
    try {
      const hasSlash = path.includes('/');
      const dir = hasSlash ? path.slice(0, path.lastIndexOf('/')) : '';
      const filename = hasSlash ? path.slice(path.lastIndexOf('/') + 1) : path;

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(dir || undefined, {
          search: filename,
        });

      if (error) throw error;
      return !!data?.some(f => f.name === filename);
    } catch (err) {
      throw handleStorageException(err, 'EXISTENCE_CHECK_FAILURE');
    }
  }

  /**
   * Retrieves metadata (size, content type, metadata) for a private storage key.
   * 
   * @async
   * @static
   * @function retrieveObjectMetadata
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Target key path
   * @returns {Promise<Object>} Metadata payload
   * @throws {StorageError}
   */
  static async retrieveObjectMetadata(bucket, path) {
    try {
      // Supabase JS library lists directory objects with meta details
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const filename = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(dir || undefined, {
          search: filename,
        });

      if (error) throw error;
      
      const fileMeta = data?.find(f => f.name === filename);
      if (!fileMeta) {
        throw new Error(`Object not found at path: ${path}`);
      }

      return fileMeta; // Contains size, id, created_at, updated_at, metadata etc.
    } catch (err) {
      throw handleStorageException(err, 'METADATA_RETRIEVAL_FAILURE');
    }
  }

  /**
   * Lists nested directory keys and files inside bucket paths.
   * 
   * @async
   * @static
   * @function listBucketObjects
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} [prefix] - Folder path context
   * @param {Object} [options={}] - Pagination and sorting options
   * @returns {Promise<Array<Object>>} Directory listings array
   * @throws {StorageError}
   */
  static async listBucketObjects(bucket, prefix = '', options = {}) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix || undefined, {
          limit: options.limit || 100,
          offset: options.offset || 0,
          sortBy: {
            column: options.sortByCol || 'name',
            order: options.sortOrder || 'asc',
          },
        });

      if (error) throw error;
      return data;
    } catch (err) {
      throw handleStorageException(err, 'LIST_FAILURE');
    }
  }
}

export default StorageService;
