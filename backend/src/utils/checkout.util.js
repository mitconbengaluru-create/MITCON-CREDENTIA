import { logger } from '../config/logger.js';

/**
 * Resolves the required approval level based on the document classification.
 * 
 * @param {string} classification - Document classification
 * @returns {string} Required approval level
 */
export function resolveApprovalLevel(classification) {
  switch (classification) {
    case 'PUBLIC':
      return 'STANDARD';
    case 'INTERNAL':
      return 'DEPARTMENT';
    case 'CONFIDENTIAL':
      return 'ADMIN';
    case 'RESTRICTED':
      return 'HIGHER_AUTHORITY';
    default:
      return 'STANDARD';
  }
}

/**
 * Hook triggered when a checkout approval request is created.
 */
export async function checkoutApprovalRequested(checkout, payload) {
  logger.info({ checkoutId: checkout.id, payload }, '[Checkout Approval Hook] Approval requested.');
}

/**
 * Hook triggered when a checkout request is approved.
 */
export async function checkoutApproved(checkout, details) {
  logger.info({ checkoutId: checkout.id, details }, '[Checkout Approval Hook] Checkout approved.');
}

/**
 * Hook triggered when a checkout request is rejected.
 */
export async function checkoutRejected(checkout, details) {
  logger.info({ checkoutId: checkout.id, details }, '[Checkout Approval Hook] Checkout rejected.');
}

/**
 * Hook triggered when a checkout approval expires.
 */
export async function approvalExpired(checkout, details) {
  logger.info({ checkoutId: checkout.id, details }, '[Checkout Approval Hook] Approval expired.');
}

/**
 * Hook triggered when a checkout approval request is cancelled.
 */
export async function approvalCancelled(checkout, details) {
  logger.info({ checkoutId: checkout.id, details }, '[Checkout Approval Hook] Approval cancelled.');
}

/**
 * Hook triggered when a checked-out document is moved.
 */
export async function documentMoved(movement) {
  logger.info({ movementId: movement.id, checkoutId: movement.checkoutId }, '[Document Movement Hook] Document moved.');
}

/**
 * Hook triggered when a document location is updated.
 */
export async function locationUpdated(checkoutId, location) {
  logger.info({ checkoutId, location }, '[Document Movement Hook] Location updated.');
}

/**
 * Hook triggered when document custody is transferred.
 */
export async function custodyTransferred(movement) {
  logger.info({ movementId: movement.id, checkoutId: movement.checkoutId }, '[Document Movement Hook] Custody transferred.');
}

/**
 * Hook triggered when a document is delivered to its destination.
 */
export async function documentDelivered(movement) {
  logger.info({ movementId: movement.id, checkoutId: movement.checkoutId }, '[Document Movement Hook] Document delivered.');
}

// Map of valid status transitions for document movement status
export const MOVEMENT_TRANSITIONS = {
  CREATED: ['APPROVED_FOR_RELEASE', 'CANCELLED'],
  APPROVED_FOR_RELEASE: ['CHECKED_OUT', 'CANCELLED'],
  CHECKED_OUT: ['LEFT_OFFICE', 'IN_TRANSIT'],
  LEFT_OFFICE: ['IN_TRANSIT', 'DELIVERED', 'WITH_EXTERNAL_PARTY'],
  IN_TRANSIT: ['DELIVERED', 'WITH_EXTERNAL_PARTY'],
  DELIVERED: ['RETURN_INITIATED'],
  WITH_EXTERNAL_PARTY: ['RETURN_INITIATED'],
  RETURN_INITIATED: ['RETURN_IN_TRANSIT', 'RETURN_RECEIVED'],
  RETURN_IN_TRANSIT: ['RETURN_RECEIVED'],
  RETURN_RECEIVED: ['COMPLETED'],
  COMPLETED: [], // Final state
  CANCELLED: [] // Final state
};

/**
 * Validates whether a movement status transition is valid.
 * 
 * @param {string} currentStatus - Current MovementStatus
 * @param {string} targetStatus - Target MovementStatus
 * @returns {boolean} True if the transition is allowed, false otherwise
 */
export function isValidMovementTransition(currentStatus, targetStatus) {
  const allowed = MOVEMENT_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(targetStatus);
}
