import { prisma } from '../config/database.js';
import { CheckoutRepository } from '../repositories/checkout.repository.js';
import { DocumentRepository } from '../repositories/documents.repository.js';
import {
  resolveApprovalLevel,
  checkoutApprovalRequested,
  checkoutApproved,
  checkoutRejected,
  approvalExpired,
  approvalCancelled,
  documentMoved,
  locationUpdated,
  custodyTransferred,
  documentDelivered,
  isValidMovementTransition
} from '../utils/checkout.util.js';

export class CheckoutServiceError extends Error {
  constructor(message, code = 'SERVICE_ERROR') {
    super(message);
    this.name = 'CheckoutServiceError';
    this.code = code;
  }
}

export class CheckoutService {
  constructor() {
    this.checkoutRepo = new CheckoutRepository();
    this.documentRepo = new DocumentRepository();
  }

  /**
   * Submit a new document checkout request.
   */
  async createCheckout(data, userId) {
    // 1. Fetch document metadata
    const document = await this.documentRepo.findById(data.documentId);
    if (!document) {
      throw new CheckoutServiceError('Requested document was not found.', 'DOCUMENT_NOT_FOUND');
    }
    if (document.isDeleted || document.status === 'INFECTED') {
      throw new CheckoutServiceError('Requested document is currently unavailable for checkout.', 'DOCUMENT_UNAVAILABLE');
    }

    // 2. Fetch requester user profile and department details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    if (!user) {
      throw new CheckoutServiceError('Requester user account was not found.', 'USER_NOT_FOUND');
    }

    // Check for existing active checkout of same document by same requester
    const existing = await this.checkoutRepo.findAll({
      documentId: data.documentId,
      requestedById: userId,
      activeOnly: true,
    });
    if (existing.checkouts.length > 0) {
      throw new CheckoutServiceError('You already have an active checkout or request pending for this document.', 'DUPLICATE_REQUEST');
    }

    // 3. Formulate snapshotted metadata data object
    const checkoutPayload = {
      documentId: document.id,
      documentVersionId: document.versions?.[0]?.id || null,
      documentNameSnapshot: document.name,
      classificationSnapshot: document.classification,
      requestedById: user.id,
      employeeId: user.id,
      employeeName: user.email.split('@')[0], // Extract username snapshot
      department: user.department?.name || 'Unassigned',
      designation: user.role,
      destination: data.destination,
      locationAddress: data.locationAddress,
      externalOrganizationName: data.externalOrganization || null,
      purposeOfRemoval: data.purpose,
      expectedReturnDate: data.expectedReturnDate || null,
      status: 'PENDING_APPROVAL', // Initially waiting approval
    };

    const checkout = await this.checkoutRepo.createCheckout(checkoutPayload);

    // Prepare approval payload
    const requiredApproverLevel = resolveApprovalLevel(checkout.classificationSnapshot);
    const approvalPayload = {
      checkoutId: checkout.id,
      documentId: checkout.documentId,
      requestedUser: user.email,
      department: checkout.department,
      documentClassification: checkout.classificationSnapshot,
      purpose: checkout.purposeOfRemoval,
      destination: checkout.destination,
      requestedDate: checkout.createdAt,
      requiredApproverLevel,
    };

    // Trigger hook
    await checkoutApprovalRequested(checkout, approvalPayload);

    return checkout;
  }

  /**
   * Retrieve details of a checkout record with access control validation.
   */
  async getCheckoutDetails(id, user) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    // Access control: Only admins or the original requester can view details
    if (user.role !== 'ADMIN' && record.requestedById !== user.id) {
      throw new CheckoutServiceError('You do not have access privileges to view this checkout details.', 'UNAUTHORIZED_ACCESS');
    }

    return record;
  }

  /**
   * List document checkouts with optional filters.
   */
  async listCheckouts(filters = {}, options = {}, user) {
    // Access control: Non-admins can only see their own requests by default
    const queryFilters = { ...filters };
    if (user.role !== 'ADMIN') {
      queryFilters.requestedById = user.id;
    }

    return await this.checkoutRepo.findAll(queryFilters, options);
  }

  /**
   * Update fields on a pending or draft checkout request.
   */
  async updateCheckout(id, updateData, userId) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    // Authorization: Only the requester can modify drafts/pending requests
    if (record.requestedById !== userId) {
      throw new CheckoutServiceError('You are not authorized to update this checkout request.', 'UNAUTHORIZED_ACCESS');
    }

    // Restriction: Only update if state is DRAFT or PENDING_APPROVAL
    if (record.status !== 'DRAFT' && record.status !== 'PENDING_APPROVAL') {
      throw new CheckoutServiceError('Cannot update checkout requests that have already been processed.', 'INVALID_STATUS');
    }

    // Update via database
    const payload = {};
    if (updateData.purpose !== undefined) payload.purposeOfRemoval = updateData.purpose;
    if (updateData.destination !== undefined) payload.destination = updateData.destination;
    if (updateData.locationAddress !== undefined) payload.locationAddress = updateData.locationAddress;
    if (updateData.externalOrganization !== undefined) payload.externalOrganizationName = updateData.externalOrganization;
    if (updateData.expectedReturnDate !== undefined) {
      payload.expectedReturnDate = updateData.expectedReturnDate ? new Date(updateData.expectedReturnDate) : null;
    }

    return await prisma.checkout.update({
      where: { id },
      data: payload,
    });
  }

  /**
   * Cancel an approval request.
   */
  async cancelCheckout(id, userId) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    if (record.requestedById !== userId) {
      throw new CheckoutServiceError('You are not authorized to cancel this checkout request.', 'UNAUTHORIZED_ACCESS');
    }

    if (record.status !== 'DRAFT' && record.status !== 'PENDING_APPROVAL') {
      throw new CheckoutServiceError('Only pending or draft checkout requests can be cancelled.', 'INVALID_STATUS');
    }

    return await this.checkoutRepo.updateStatus(id, 'CANCELLED');
  }

  /**
   * Soft-delete checkout history.
   */
  async deleteCheckout(id, userId, userRole) {
    const record = await this.checkoutRepo.findById(id, { includeDeleted: true });
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    // Only administrators or the requester (if in DRAFT state) can soft delete
    if (userRole !== 'ADMIN' && (record.requestedById !== userId || record.status !== 'DRAFT')) {
      throw new CheckoutServiceError('You do not have permission to delete this checkout record.', 'UNAUTHORIZED_ACCESS');
    }

    return await this.checkoutRepo.softDelete(id, userId);
  }

  /**
   * Submit checkout for approval (transition from DRAFT to PENDING_APPROVAL).
   */
  async submitCheckoutForApproval(id, userId) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    if (record.requestedById !== userId) {
      throw new CheckoutServiceError('You are not authorized to submit this checkout request.', 'UNAUTHORIZED_ACCESS');
    }

    if (record.status !== 'DRAFT') {
      throw new CheckoutServiceError('Only draft checkouts can be submitted for approval.', 'INVALID_STATUS');
    }

    const updated = await this.checkoutRepo.updateStatus(id, 'PENDING_APPROVAL');

    // Prepare approval payload
    const requiredApproverLevel = resolveApprovalLevel(updated.classificationSnapshot);
    const approvalPayload = {
      checkoutId: updated.id,
      documentId: updated.documentId,
      requestedUser: record.requestedBy?.email || 'Unknown',
      department: updated.department,
      documentClassification: updated.classificationSnapshot,
      purpose: updated.purposeOfRemoval,
      destination: updated.destination,
      requestedDate: updated.createdAt,
      requiredApproverLevel,
    };

    await checkoutApprovalRequested(updated, approvalPayload);

    return updated;
  }

  /**
   * Process approval acceptance.
   */
  async processApprovalAccepted(id, approverId, comments, approvalIdReference) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    // Status transition checks
    if (record.status === 'APPROVED') {
      throw new CheckoutServiceError('Checkout has already been approved.', 'ALREADY_APPROVED');
    }
    if (record.status === 'REJECTED') {
      throw new CheckoutServiceError('Checkout has already been rejected.', 'ALREADY_REJECTED');
    }
    if (record.status !== 'PENDING_APPROVAL') {
      throw new CheckoutServiceError('Only pending checkouts can be approved.', 'INVALID_STATUS');
    }

    // Authorization and Policy check: Users cannot approve their own Confidential/Restricted requests
    if (record.requestedById === approverId && (record.classificationSnapshot === 'CONFIDENTIAL' || record.classificationSnapshot === 'RESTRICTED')) {
      throw new CheckoutServiceError('Users cannot approve their own CONFIDENTIAL or RESTRICTED checkout requests.', 'UNAUTHORIZED_APPROVER');
    }

    // Update in repository
    const updated = await this.checkoutRepo.updateApprovalResult(id, {
      status: 'APPROVED',
      approvalStatus: 'APPROVED',
      approvalId: approvalIdReference,
      approvedById: approverId,
      approvedAt: new Date(),
      approvalComments: comments,
    });

    // Trigger hook
    await checkoutApproved(updated, { approverId, comments, approvalIdReference });

    return updated;
  }

  /**
   * Process approval rejection.
   */
  async processApprovalRejection(id, approverId, rejectionReason, comments, approvalIdReference) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    // Status transition checks
    if (record.status === 'APPROVED') {
      throw new CheckoutServiceError('Checkout has already been approved.', 'ALREADY_APPROVED');
    }
    if (record.status === 'REJECTED') {
      throw new CheckoutServiceError('Checkout has already been rejected.', 'ALREADY_REJECTED');
    }
    if (record.status !== 'PENDING_APPROVAL') {
      throw new CheckoutServiceError('Only pending checkouts can be rejected.', 'INVALID_STATUS');
    }

    // Update in repository
    const updated = await this.checkoutRepo.updateApprovalResult(id, {
      status: 'REJECTED',
      approvalStatus: 'REJECTED',
      approvalId: approvalIdReference,
      approvedById: approverId,
      approvedAt: new Date(),
      rejectionReason,
      approvalComments: comments,
    });

    // Trigger hook
    await checkoutRejected(updated, { approverId, rejectionReason, comments, approvalIdReference });

    return updated;
  }

  /**
   * Sync approval status.
   */
  async syncApprovalStatus(id, approvalStatus, metadata = {}) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    if (approvalStatus === 'APPROVED') {
      return await this.processApprovalAccepted(id, metadata.approverId, metadata.comments, metadata.approvalId);
    } else if (approvalStatus === 'REJECTED') {
      return await this.processApprovalRejection(id, metadata.approverId, metadata.rejectionReason, metadata.comments, metadata.approvalId);
    } else if (approvalStatus === 'EXPIRED') {
      const updated = await this.checkoutRepo.updateApprovalResult(id, {
        status: 'CLOSED',
        approvalStatus: 'EXPIRED',
      });
      await approvalExpired(updated, metadata);
      return updated;
    } else if (approvalStatus === 'CANCELLED') {
      const updated = await this.checkoutRepo.updateApprovalResult(id, {
        status: 'CANCELLED',
        approvalStatus: 'CANCELLED',
      });
      await approvalCancelled(updated, metadata);
      return updated;
    } else {
      throw new CheckoutServiceError('Invalid approval status to sync.', 'INVALID_STATUS');
    }
  }

  /**
   * Retrieve approval state.
   */
  async retrieveApprovalState(id) {
    const record = await this.checkoutRepo.findById(id);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    return {
      checkoutId: record.id,
      approvalId: record.approvalId,
      approvalStatus: record.approvalStatus,
      approvedById: record.approvedById,
      approvedAt: record.approvedAt,
      approvalComments: record.approvalComments,
      rejectionReason: record.rejectionReason,
    };
  }

  /**
   * Create movement record.
   */
  async createMovementRecord(checkoutId, movementData, user) {
    const record = await this.checkoutRepo.findById(checkoutId);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    // Eligibility check
    if (record.isDeleted) {
      throw new CheckoutServiceError('Deleted checkouts cannot move.', 'DELETED_CHECKOUT');
    }

    if (record.status === 'CLOSED' || record.status === 'CANCELLED' || record.status === 'RETURNED') {
      throw new CheckoutServiceError('Completed or cancelled checkouts cannot move.', 'COMPLETED_CHECKOUT');
    }

    // Check status transition validity
    const currentStatus = await this.checkoutRepo.getLatestMovementStatus(checkoutId) || 'CREATED';
    const targetStatus = movementData.status;

    if (!isValidMovementTransition(currentStatus, targetStatus)) {
      throw new CheckoutServiceError(`Invalid movement status transition from ${currentStatus} to ${targetStatus}.`, 'INVALID_TRANSITION');
    }

    // Handler permission check
    const isHandler = user.id === movementData.employeeId;
    const isAdmin = user.role === 'ADMIN';
    const isRequester = user.id === record.requestedById;

    if (!isAdmin && !isHandler && !isRequester) {
      throw new CheckoutServiceError('Only the assigned handler, requester or an admin can update movement status.', 'UNAUTHORIZED_ACCESS');
    }

    const payload = {
      ...movementData,
      documentId: record.documentId,
      versionId: record.documentVersionId,
    };

    const movement = await this.checkoutRepo.createMovementRecord(checkoutId, payload);

    // Trigger hooks
    await documentMoved(movement);

    if (targetStatus === 'DELIVERED') {
      await documentDelivered(movement);
    }
    
    if (targetStatus === 'LEFT_OFFICE') {
      await locationUpdated(checkoutId, movementData.currentLocation);
    }

    return movement;
  }

  /**
   * Fetch movement history.
   */
  async fetchMovementHistory(checkoutId) {
    const record = await this.checkoutRepo.findById(checkoutId);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    return await this.checkoutRepo.fetchMovementHistory(checkoutId);
  }

  /**
   * Update current location directly on Checkout.
   */
  async updateCurrentLocation(checkoutId, location, user) {
    const record = await this.checkoutRepo.findById(checkoutId);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    if (record.isDeleted) {
      throw new CheckoutServiceError('Deleted checkouts cannot move.', 'DELETED_CHECKOUT');
    }

    if (record.status === 'CLOSED' || record.status === 'CANCELLED' || record.status === 'RETURNED') {
      throw new CheckoutServiceError('Completed or cancelled checkouts cannot move.', 'COMPLETED_CHECKOUT');
    }

    // Verify authorized user
    const isAdmin = user.role === 'ADMIN';
    const isRequester = user.id === record.requestedById;

    const movements = await this.checkoutRepo.fetchMovementHistory(checkoutId);
    const latestMovement = movements[movements.length - 1];
    const isHandler = latestMovement && user.id === latestMovement.employeeId;

    if (!isAdmin && !isHandler && !isRequester) {
      throw new CheckoutServiceError('Only the assigned handler, requester or an admin can update location.', 'UNAUTHORIZED_ACCESS');
    }

    const updated = await this.checkoutRepo.updateCurrentLocation(checkoutId, location);

    await locationUpdated(checkoutId, location);

    return updated;
  }

  /**
   * Fetch movement timeline.
   */
  async fetchMovementTimeline(checkoutId) {
    const record = await this.checkoutRepo.findById(checkoutId);
    if (!record) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    return await this.checkoutRepo.fetchMovementTimeline(checkoutId);
  }

  /**
   * Return document and close checkout lock.
   */
  async returnCheckout(checkoutId, data, user) {
    const checkout = await this.checkoutRepo.findById(checkoutId);
    if (!checkout) {
      throw new CheckoutServiceError('Checkout record was not found.', 'CHECKOUT_NOT_FOUND');
    }

    if (checkout.status !== 'CHECKED_OUT' && checkout.status !== 'PENDING_RETURN') {
      throw new CheckoutServiceError('Only active checked out items can be returned.', 'INVALID_STATUS');
    }

    // Map condition to Prisma enum
    let mappedCondition = 'GOOD';
    const cond = (data.condition || '').toLowerCase();
    if (cond.includes('damage')) {
      mappedCondition = 'DAMAGED';
    } else if (cond.includes('missing')) {
      mappedCondition = 'MISSING';
    } else if (cond.includes('review') || cond.includes('digital') || cond.includes('copy')) {
      mappedCondition = 'NEEDS_REVIEW';
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update checkout record
      const updatedCheckout = await tx.checkout.update({
        where: { id: checkoutId },
        data: {
          status: 'RETURNED',
          returnStatus: 'RETURN_RECEIVED',
          returnedDate: new Date(),
          returnedTo: user.email.split('@')[0],
          conditionOnReturn: mappedCondition,
          returnNotes: data.notes || '',
        }
      });

      // 2. Unlock the document
      await tx.document.update({
        where: { id: checkout.documentId },
        data: {
          isLocked: false,
          lockedById: null,
          lockedAt: null,
          status: 'ACTIVE',
        }
      });

      // 3. Create a CheckoutMovement entry for completion
      await tx.checkoutMovement.create({
        data: {
          checkoutId,
          documentId: checkout.documentId,
          currentLocation: 'Secure Repository Vault',
          status: 'COMPLETED',
          notes: `Document returned in ${data.condition || 'Perfect'} condition. Notes: ${data.notes || 'None'}`
        }
      });

      return updatedCheckout;
    });

    return updated;
  }
}
export default CheckoutService;
