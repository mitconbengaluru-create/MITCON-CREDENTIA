/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'super-admin' | 'admin' | 'developer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  status: 'active' | 'suspended';
  designation?: string;
}

export interface Document {
  id: string;
  documentId: string;
  documentName: string;
  dateUploaded: string;
  expiryDate?: string;
  filePath: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Checked Out' | 'Returned' | 'Archived';
  uploadedBy: string;
  client: string;
  dateOfRegistration: string;
  placeOfHolding: string;
}

export interface Checkout {
  id: string;
  documentId: string; // The custom tracking ID
  documentDbId: string; // The DB UUID
  documentName: string;
  
  // User info
  employeeName: string;
  employeeId: string;
  designation: string;
  
  // Checkout details
  checkoutDate: string;
  destination: string;
  purpose: string;
  expectedReturnDate: string;
  approvalAuthority: string;
  status: 'Checked Out' | 'Pending Return' | 'Returned' | 'Closed';
  signature: string; // Drawn canvas Base64 url OR uploaded signature OR typing hash
  signatureType: 'drawn' | 'uploaded' | 'typed';
}

export interface ReturnRecord {
  id: string;
  checkoutId: string;
  documentId: string;
  documentName: string;
  returnDate: string;
  returnTime: string;
  condition: 'Perfect' | 'Good' | 'Damaged' | 'Missing Pages' | 'Digital Copy Only';
  notes: string;
  returningEmployeeSignature: string; // Base64 signature
  returningEmployeeName: string;
}



export interface Notification {
  id: string;
  title: string;
  message: string;
  userId?: string;
  status: 'unread' | 'read';
  timestamp: string;
}

export interface SecurityPolicy {
  passwordMinLength: number;
  requireMfa: boolean;
  sessionTimeoutMinutes: number;
  allowedUploadFormats: string[];
  autoRejectExpiredCheckouts: boolean;
  maxCheckoutDurationDays: number;
}
