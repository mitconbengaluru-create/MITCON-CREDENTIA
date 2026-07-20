/**
 * Generates a dynamic storage key path for documents adhering to BCD-FSS standards.
 * 
 * Required structure: documents/department-id/year/month/document-id/version/filename
 * Example: documents/finance/2026/07/DOC123/v1/agreement.pdf
 * 
 * @function generateDocumentStoragePath
 * @param {Object} params
 * @param {string} params.departmentId - Target department ID or identifier (e.g. 'finance')
 * @param {string} params.documentId - Unique document UUID or ID (e.g. 'DOC123')
 * @param {number|string} params.version - Document version identifier (e.g. 1 or 'v1')
 * @param {string} params.filename - Sanitized target file name (e.g. 'agreement.pdf')
 * @param {Date} [params.date=new Date()] - Optional date reference for directory creation
 * @returns {string} Fully compiled BCD-FSS storage key path
 */
export function generateDocumentStoragePath({ departmentId, documentId, version, filename, date = new Date() }) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  // Ensure version formatting starts with 'v' prefix
  const versionStr = typeof version === 'number' || !version.toString().startsWith('v')
    ? `v${version}`
    : version.toString().trim();

  // Normalize inputs to prevent directory traversal or malformed key characters
  const cleanDept = departmentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanDoc = documentId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanFilename = filename.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');

  return `documents/${cleanDept}/${year}/${month}/${cleanDoc}/${versionStr}/${cleanFilename}`;
}

export default {
  generateDocumentStoragePath,
};
