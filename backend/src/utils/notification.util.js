import crypto from 'crypto';

/**
 * Generates a unique, compliance-ready Notification Reference Number.
 * Format: NOTIF-YYYYMMDD-RANDOMHEX
 * 
 * @function generateNotificationReference
 * @returns {string} Unique reference number
 */
export function generateNotificationReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `NOTIF-${dateStr}-${randomHex}`;
}

/**
 * Auto-resolves notification priority level based on event context.
 * 
 * @function resolvePriority
 * @param {string} category - Notification category
 * @param {string} eventType - Notification event type identifier
 * @returns {string} Priority: LOW, NORMAL, HIGH, CRITICAL
 */
export function resolvePriority(category, eventType) {
  if (category === 'SECURITY' || eventType === 'SUSPICIOUS_ACTIVITY') {
    return 'CRITICAL';
  }
  
  if (
    category === 'APPROVAL' ||
    eventType === 'APPROVAL_REQUIRED' ||
    eventType === 'CHECKOUT_OVERDUE' ||
    eventType === 'SIGNATURE_REQUIRED' ||
    eventType === 'SIGNATURE_FAILED' ||
    eventType === 'PERMISSION_DENIED'
  ) {
    return 'HIGH';
  }

  if (eventType === 'DOCUMENT_EXPIRED') {
    return 'HIGH';
  }

  return 'NORMAL';
}

/**
 * Compiles dynamic details and template bindings into a standardized Title and Message.
 * 
 * @function buildNotificationMessage
 * @param {string} eventType - System event type hook
 * @param {Object} context - Data properties utilized in compilation
 * @returns {Object} { title, message, description }
 */
export function buildNotificationMessage(eventType, context = {}) {
  const documentName = context.documentName || 'Document';
  const userName = context.userName || context.requestedBy || 'A user';
  const ipAddress = context.ipAddress || 'unknown IP';
  const resourceId = context.resourceId || 'resource';

  const templates = {
    // --- Document Events ---
    DOCUMENT_UPLOADED: {
      title: 'Document Uploaded Successfully',
      message: `Document "${documentName}" has been successfully uploaded by ${userName}.`,
      description: `New file version created in system. Size: ${context.size || 'N/A'}.`,
    },
    DOCUMENT_SHARED: {
      title: 'Document Shared With You',
      message: `The document "${documentName}" has been shared with you by ${userName}.`,
      description: 'You now have viewing or authorization rights on this document.',
    },
    DOCUMENT_EXPIRED: {
      title: 'Document Retention Expired',
      message: `The retention period for document "${documentName}" has expired.`,
      description: 'This document is now eligible for archiving or clean-up policy action.',
    },
    DOCUMENT_DOWNLOADED: {
      title: 'Document Downloaded',
      message: `The document "${documentName}" was downloaded by ${userName}.`,
      description: `Downloaded from IP: ${ipAddress}.`,
    },

    // --- Checkout Events ---
    CHECKOUT_REQUESTED: {
      title: 'Document Checkout Request',
      message: `A checkout request for "${documentName}" has been submitted by ${userName}.`,
      description: `Purpose: ${context.purpose || 'Not specified'}. Expected Return: ${context.expectedReturnDate || 'N/A'}.`,
    },
    CHECKOUT_APPROVED: {
      title: 'Document Checkout Approved',
      message: `Your checkout request for "${documentName}" has been approved.`,
      description: `Please collect the physical file or proceed to release.`,
    },
    CHECKOUT_REJECTED: {
      title: 'Document Checkout Rejected',
      message: `Your checkout request for "${documentName}" has been rejected.`,
      description: `Reason: ${context.reason || 'No reason provided'}.`,
    },
    CHECKOUT_OVERDUE: {
      title: 'Checkout Return Overdue Alert',
      message: `The checked-out document "${documentName}" has exceeded its return date!`,
      description: 'Immediate return action is required for compliance.',
    },
    DOCUMENT_RETURNED: {
      title: 'Document Returned Successfully',
      message: `The checked-out document "${documentName}" was returned by ${userName}.`,
      description: `Returned successfully on ${new Date().toLocaleDateString()}.`,
    },

    // --- Approval Events ---
    APPROVAL_REQUIRED: {
      title: 'Approval Authorization Required',
      message: `Document "${documentName}" requires your review and approval.`,
      description: `Step details: ${context.stepName || 'Approval stage'}. Requested by ${userName}.`,
    },
    APPROVAL_GRANTED: {
      title: 'Document Approval Granted',
      message: `The approval request for document "${documentName}" has been granted.`,
      description: 'All steps completed. Ready for next workflow transitions.',
    },
    APPROVAL_REJECTED: {
      title: 'Document Approval Rejected',
      message: `The approval request for "${documentName}" was rejected by ${userName}.`,
      description: `Reason: ${context.reason || 'None specified'}.`,
    },

    // --- Signature Events ---
    SIGNATURE_REQUIRED: {
      title: 'Digital Signature Required',
      message: `Your digital signature is required on document "${documentName}".`,
      description: 'Compliance workflow requires your cryptographically verified signature.',
    },
    SIGNATURE_VERIFIED: {
      title: 'Digital Signature Verified',
      message: `The signature on "${documentName}" has been successfully verified.`,
      description: `Signed by: ${userName}. Verification status: Success.`,
    },
    SIGNATURE_FAILED: {
      title: 'Signature Verification Failure',
      message: `Security Alert: Digital signature verification failed for "${documentName}"!`,
      description: `The signature hash did not match the file checksum. Integrity compromised.`,
    },

    // --- Security Events ---
    LOGIN_ALERT: {
      title: 'Security Alert: Successful Login',
      message: `A new session was established for your account.`,
      description: `Login location IP: ${ipAddress}. Browser: ${context.browser || 'N/A'}. OS: ${context.os || 'N/A'}.`,
    },
    PERMISSION_DENIED: {
      title: 'Security Alert: Access Denied',
      message: `An unauthorized attempt to access "${resourceId}" was blocked.`,
      description: `User: ${userName}. Action: ${context.action || 'Unknown'}. IP: ${ipAddress}.`,
    },
    SUSPICIOUS_ACTIVITY: {
      title: 'Critical Security Alert: Suspicious Activity',
      message: 'Suspicious operations pattern detected on the system!',
      description: `Details: ${context.details || 'Multiple authentication failures or anomaly detected.'}`,
    },
  };

  const template = templates[eventType] || {
    title: 'System Notification',
    message: context.message || 'A system event has occurred.',
    description: context.description || 'Generic notification message.',
  };

  return {
    title: template.title,
    message: template.message,
    description: template.description,
  };
}

export default {
  generateNotificationReference,
  resolvePriority,
  buildNotificationMessage,
};
