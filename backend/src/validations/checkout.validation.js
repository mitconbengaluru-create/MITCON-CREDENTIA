import { z } from 'zod';

// UUID / Primary ID Param Schema
export const idParamSchema = z.object({
  id: z.string().uuid('Checkout ID parameter must be a valid UUID format.'),
});

// Create Checkout Schema
export const createCheckoutSchema = z.object({
  body: z.object({
    documentId: z.string().uuid('Document ID must be a valid UUID.'),
    purpose: z.string().trim().min(1, 'Purpose of checkout is required.').max(1000, 'Purpose cannot exceed 1000 characters.'),
    destination: z.string().trim().min(1, 'Destination is required.').max(255, 'Destination cannot exceed 255 characters.'),
    locationAddress: z.string().trim().min(1, 'Location address is required.').max(500, 'Location address cannot exceed 500 characters.'),
    externalOrganization: z.string().trim().max(255, 'External organization name cannot exceed 255 characters.').nullable().optional(),
    expectedReturnDate: z.string().datetime({ message: 'Expected return date must be a valid ISO 8601 date string.' }).nullable().optional(),
  }),
});

// Update Checkout Schema
export const updateCheckoutSchema = z.object({
  body: z.object({
    purpose: z.string().trim().min(1).max(1000).optional(),
    destination: z.string().trim().min(1).max(255).optional(),
    locationAddress: z.string().trim().min(1).max(500).optional(),
    externalOrganization: z.string().trim().max(255).nullable().optional(),
    expectedReturnDate: z.string().datetime().nullable().optional(),
  }),
});

// List Checkouts Query Schema
export const listCheckoutsSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.number()]).transform(val => parseInt(val, 10)).default(1),
    limit: z.union([z.string(), z.number()]).transform(val => parseInt(val, 10)).default(10),
    sort: z.string().trim().default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHECKED_OUT', 'PENDING_RETURN', 'RETURNED', 'CLOSED', 'CANCELLED']).optional(),
    documentId: z.string().uuid().optional(),
    requestedById: z.string().uuid().optional(),
    department: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    includeDeleted: z.union([z.string(), z.boolean()]).transform(val => val === 'true' || val === true).default(false),
  }).partial(),
});

// Create Movement Schema
export const createMovementSchema = z.object({
  body: z.object({
    currentLocation: z.string().trim().min(1, 'Current location is required.').max(255),
    previousLocation: z.string().trim().max(255).optional().nullable(),
    destinationAddress: z.string().trim().max(500).optional().nullable(),
    externalOrganization: z.string().trim().max(255).optional().nullable(),
    status: z.enum([
      'CREATED',
      'APPROVED_FOR_RELEASE',
      'CHECKED_OUT',
      'LEFT_OFFICE',
      'IN_TRANSIT',
      'DELIVERED',
      'WITH_EXTERNAL_PARTY',
      'RETURN_INITIATED',
      'RETURN_IN_TRANSIT',
      'RETURN_RECEIVED',
      'COMPLETED'
    ]),
    movementDate: z.string().datetime().optional().nullable(),
    movementTime: z.string().trim().max(50).optional().nullable(),
    remarks: z.string().trim().max(1000).optional().nullable(),
    handlerName: z.string().trim().min(1, 'Handler name is required.').max(255),
    employeeId: z.string().trim().max(100).optional().nullable(),
    contactReference: z.string().trim().max(255).optional().nullable(),
    department: z.string().trim().max(255).optional().nullable(),
    trackingReference: z.string().trim().max(255).optional().nullable(),
    qrIdentifier: z.string().trim().max(255).optional().nullable(),
    scanTimestamp: z.string().datetime().optional().nullable(),
    scanLocation: z.string().trim().max(255).optional().nullable(),
  })
});

// Update Location Schema
export const updateLocationSchema = z.object({
  body: z.object({
    location: z.string().trim().min(1, 'Location name is required.').max(255),
  })
});
