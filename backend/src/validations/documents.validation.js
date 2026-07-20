import { z } from 'zod';

// UUID / Primary ID Param Schema
export const idParamSchema = z.object({
  id: z.string().uuid('Document ID parameter must be a valid UUID format.'),
});

// Create Document Schema
export const createDocumentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Document name is required.').max(255, 'Document name cannot exceed 255 characters.'),
    documentNumber: z.string().trim().max(100, 'Document serial number cannot exceed 100 characters.').optional(),
    description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters.').optional(),
    tags: z.array(z.string().trim().max(50, 'Individual tag cannot exceed 50 characters.')).optional(),
    folderId: z.string().uuid('Folder ID must be a valid UUID.').nullable().optional(),
    vaultId: z.string().uuid('Vault ID must be a valid UUID.').nullable().optional(),
    departmentId: z.string().uuid('Department ID must be a valid UUID.').nullable().optional(),
    classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).default('INTERNAL'),
    storageProvider: z.enum(['SUPABASE', 'LOCAL', 'AWS_S3']).default('SUPABASE'),
    storageBucket: z.string().trim().min(1, 'Storage bucket name is required.'),
    storagePath: z.string().trim().min(1, 'Storage object path is required.'),
    mimeType: z.string().trim().min(1, 'MIME type metadata is required.'),
    fileSize: z.union([z.number(), z.string()]).transform((val) => {
      try {
        return BigInt(val);
      } catch {
        throw new Error('File size must be a valid BigInt numeric representation.');
      }
    }),
    checksum: z.string().trim().max(256, 'Checksum string cannot exceed 256 characters.').optional(),
  }),
});

// Update Document Schema
export const updateDocumentSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().trim().min(1, 'Document name cannot be empty.').max(255).optional(),
    description: z.string().trim().max(1000).optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    folderId: z.string().uuid('Folder ID must be a valid UUID.').nullable().optional(),
    vaultId: z.string().uuid('Vault ID must be a valid UUID.').nullable().optional(),
    departmentId: z.string().uuid('Department ID must be a valid UUID.').nullable().optional(),
    classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
    status: z.enum(['PENDING_UPLOAD', 'DRAFT', 'ACTIVE', 'INFECTED', 'ARCHIVED']).optional(),
    storageBucket: z.string().trim().min(1).optional(),
    storagePath: z.string().trim().min(1).optional(),
    mimeType: z.string().trim().min(1).optional(),
    fileSize: z.union([z.number(), z.string()]).transform((val) => {
      try {
        return BigInt(val);
      } catch {
        throw new Error('File size must be a valid BigInt numeric representation.');
      }
    }).optional(),
    checksum: z.string().trim().max(256).optional(),
  }),
});

// List Documents Schema
export const listDocumentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.string().trim().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    includeDeleted: z.preprocess((val) => val === 'true', z.boolean()).default(false),
    folderId: z.string().uuid('Folder ID must be a valid UUID.').optional(),
    vaultId: z.string().uuid('Vault ID must be a valid UUID.').optional(),
    departmentId: z.string().uuid('Department ID must be a valid UUID.').optional(),
    ownerId: z.string().optional(),
    classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
    status: z.enum(['PENDING_UPLOAD', 'DRAFT', 'ACTIVE', 'INFECTED', 'ARCHIVED']).optional(),
    search: z.string().trim().optional(),
    tags: z.preprocess((val) => {
      if (typeof val === 'string') return val.split(',').map((t) => t.trim());
      return val;
    }, z.array(z.string().trim())).optional(),
  }).optional(),
});
