import crypto from 'crypto';

export const mockDepartment = {
  id: 'de000000-0000-0000-0000-000000000001',
  name: 'Engineering',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAdminUser = {
  id: 'ba000000-0000-0000-0000-000000000002',
  email: 'admin@mitcon.corp',
  role: 'ADMIN',
  departmentId: 'de000000-0000-0000-0000-000000000001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockRegularUser = {
  id: 'ba000000-0000-0000-0000-000000000001',
  email: 'user@mitcon.corp',
  role: 'USER',
  departmentId: 'de000000-0000-0000-0000-000000000001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockVault = {
  id: 'va000000-0000-0000-0000-000000000001',
  name: 'Secure Engineering Vault',
  type: 'DEPARTMENT',
  status: 'ACTIVE',
  departmentId: 'de000000-0000-0000-0000-000000000001',
  ownerId: 'ba000000-0000-0000-0000-000000000001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockFolder = {
  id: 'fo000000-0000-0000-0000-000000000001',
  name: 'Project Blueprints',
  parentId: null,
  vaultId: 'va000000-0000-0000-0000-000000000001',
  departmentId: 'de000000-0000-0000-0000-000000000001',
  ownerId: 'ba000000-0000-0000-0000-000000000001',
  path: '/project-blueprints',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDocument = {
  id: 'da000000-0000-0000-0000-000000000001',
  name: 'blueprint_v1.pdf',
  documentNumber: 'DOC-2026-0001',
  description: 'Confidential structural design blueprints.',
  tags: ['blueprint', 'design'],
  folderId: 'fo000000-0000-0000-0000-000000000001',
  vaultId: 'va000000-0000-0000-0000-000000000001',
  departmentId: 'de000000-0000-0000-0000-000000000001',
  ownerId: 'ba000000-0000-0000-0000-000000000001',
  storageProvider: 'SUPABASE',
  storageBucket: 'documents',
  storagePath: 'documents/Engineering/2026/07/da000000-0000-0000-0000-000000000001/1/blueprint_v1.pdf',
  mimeType: 'application/pdf',
  fileSize: 1048576n, // 1MB BigInt
  checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  classification: 'CONFIDENTIAL',
  status: 'ACTIVE',
  version: 1,
  expiryDate: new Date('2033-07-06T10:00:00Z'), // 7 years post creation
  createdAt: new Date(),
  updatedAt: new Date(),
};
