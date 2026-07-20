import { StorageService } from '../../src/services/storage/storage.service.js';

const originalMethods = {};

/**
 * Mocks the static methods of StorageService for isolated unit and integration testing.
 */
export function setupStorageMock() {
  originalMethods.uploadObject = StorageService.uploadObject;
  originalMethods.downloadObject = StorageService.downloadObject;
  originalMethods.deleteObject = StorageService.deleteObject;
  originalMethods.generateDownloadUrl = StorageService.generateDownloadUrl;
  originalMethods.generateUploadUrl = StorageService.generateUploadUrl;

  StorageService.uploadObject = async (bucket, path, buffer, options) => {
    if (path.includes('fail-upload')) {
      throw new Error('Supabase mock upload failure.');
    }
    return { path };
  };

  StorageService.downloadObject = async (bucket, path) => {
    if (path.includes('missing-file')) {
      throw new Error('Object not found');
    }
    return Buffer.from('mock file binary content');
  };

  StorageService.deleteObject = async (bucket, path) => {
    return { success: true };
  };

  StorageService.generateDownloadUrl = async (bucket, path, expires) => {
    if (path.includes('missing-file')) {
      throw new Error('Object not found');
    }
    return {
      signedUrl: `https://supabase.mock/download/${bucket}/${path}?token=mock-signed-token`,
    };
  };

  StorageService.generateUploadUrl = async (bucket, path, expires) => {
    return {
      signedUrl: `https://supabase.mock/upload/${bucket}/${path}?token=mock-signed-token`,
      token: 'mock-signed-token',
      path,
    };
  };
}

/**
 * Restores original StorageService methods.
 */
export function restoreStorageMock() {
  if (originalMethods.uploadObject) {
    StorageService.uploadObject = originalMethods.uploadObject;
    StorageService.downloadObject = originalMethods.downloadObject;
    StorageService.deleteObject = originalMethods.deleteObject;
    StorageService.generateDownloadUrl = originalMethods.generateDownloadUrl;
    StorageService.generateUploadUrl = originalMethods.generateUploadUrl;
  }
}
