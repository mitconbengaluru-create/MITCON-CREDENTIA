import { CheckoutService, CheckoutServiceError } from '../services/checkout.service.js';

const checkoutService = new CheckoutService();

/**
 * Maps checkout service exception errors to corresponding HTTP status code envelopes.
 * 
 * @function mapServiceErrorToHttp
 * @param {Error} err - Service level exception error
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 */
function mapServiceErrorToHttp(err, res, next) {
  if (err instanceof CheckoutServiceError) {
    const errorMapping = {
      CHECKOUT_NOT_FOUND: 404,
      DOCUMENT_NOT_FOUND: 404,
      DOCUMENT_UNAVAILABLE: 400,
      DUPLICATE_REQUEST: 409,
      UNAUTHORIZED_ACCESS: 403,
      INVALID_STATUS: 400,
      VALIDATION_FAILED: 400,
      COMPLETED_CHECKOUT: 400,
      DELETED_CHECKOUT: 400,
      INVALID_TRANSITION: 400,
      UNAUTHORIZED_APPROVER: 403,
      ALREADY_APPROVED: 409,
      ALREADY_REJECTED: 409,
    };

    const statusCode = errorMapping[err.code] || 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  next(err);
}

/**
 * Controller class executing REST integrations for Document Checkout endpoints.
 */
export class CheckoutController {
  /**
   * Submit a new document checkout request.
   * 
   * @async
   * @method createCheckout
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async createCheckout(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await checkoutService.createCheckout(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Checkout request successfully submitted.',
        data: {
          id: result.id,
          documentId: result.documentId,
          documentNameSnapshot: result.documentNameSnapshot,
          employeeName: result.employeeName,
          destination: result.destination,
          purposeOfRemoval: result.purposeOfRemoval,
          status: result.status,
          expectedReturnDate: result.expectedReturnDate,
          createdAt: result.createdAt,
        },
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Fetch details of a checkout request.
   * 
   * @async
   * @method getCheckoutDetails
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async getCheckoutDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await checkoutService.getCheckoutDetails(id, req.user);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List document checkouts with optional filters.
   * 
   * @async
   * @method listCheckouts
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async listCheckouts(req, res, next) {
    try {
      const { page, limit, sort, order, includeDeleted, ...filters } = req.query;
      const options = { page, limit, sort, order, includeDeleted };
      const result = await checkoutService.listCheckouts(filters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Update properties on a pending or draft checkout request.
   * 
   * @async
   * @method updateCheckout
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async updateCheckout(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await checkoutService.updateCheckout(id, req.body, userId);

      res.status(200).json({
        success: true,
        message: 'Checkout request successfully updated.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Cancel a pending checkout request.
   * 
   * @async
   * @method cancelCheckout
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async cancelCheckout(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await checkoutService.cancelCheckout(id, userId);

      res.status(200).json({
        success: true,
        message: 'Checkout request successfully cancelled.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Soft delete checkout history.
   * 
   * @async
   * @method deleteCheckout
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async deleteCheckout(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      await checkoutService.deleteCheckout(id, userId, userRole);

      res.status(200).json({
        success: true,
        message: 'Checkout record successfully deleted.',
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List checkout requests specific to the authenticated user.
   * 
   * @async
   * @method listMyCheckouts
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async listMyCheckouts(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = { requestedById: req.user.id };
      const result = await checkoutService.listCheckouts(filters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Admin Endpoint: List checkouts awaiting approval.
   * 
   * @async
   * @method listPendingCheckouts
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async listPendingCheckouts(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = { status: 'PENDING_APPROVAL' };
      const result = await checkoutService.listCheckouts(filters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Admin Endpoint: List documents checked out of the repository.
   * 
   * @async
   * @method listActiveCheckouts
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async listActiveCheckouts(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = { activeOnly: true };
      const result = await checkoutService.listCheckouts(filters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Admin Endpoint: List overdue documents checkouts.
   * 
   * @async
   * @method listOverdueCheckouts
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next callback
   */
  async listOverdueCheckouts(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = {
        status: 'CHECKED_OUT',
        expectedReturnBefore: new Date(),
      };
      const result = await checkoutService.listCheckouts(filters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Create movement record.
   * 
   * @async
   * @method createMovement
   */
  async createMovement(req, res, next) {
    try {
      const { id } = req.params;
      const result = await checkoutService.createMovementRecord(id, req.body, req.user);

      res.status(201).json({
        success: true,
        message: 'Movement record successfully created.',
        data: {
          trackingId: result.id,
          checkoutId: result.checkoutId,
          currentLocation: result.currentLocation,
          currentHolder: result.handlerName,
          currentStatus: result.status,
          remarks: result.remarks,
          scanLocation: result.scanLocation,
          scanTimestamp: result.scanTimestamp,
          createdAt: result.createdAt,
        },
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Fetch movement history.
   * 
   * @async
   * @method getMovementHistory
   */
  async getMovementHistory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await checkoutService.fetchMovementHistory(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Fetch movement timeline.
   * 
   * @async
   * @method getMovementTimeline
   */
  async getMovementTimeline(req, res, next) {
    try {
      const { id } = req.params;
      const result = await checkoutService.fetchMovementTimeline(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Update current location.
   * 
   * @async
   * @method updateLocation
   */
  async updateLocation(req, res, next) {
    try {
      const { id } = req.params;
      const { location } = req.body;
      const result = await checkoutService.updateCurrentLocation(id, location, req.user);

      res.status(200).json({
        success: true,
        message: 'Current location successfully updated.',
        data: {
          id: result.id,
          currentLocation: result.currentLocation,
          status: result.status,
          updatedAt: result.updatedAt,
        },
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Return document checked out.
   */
  async returnCheckout(req, res, next) {
    try {
      const { id } = req.params;
      const result = await checkoutService.returnCheckout(id, req.body, req.user);

      res.status(200).json({
        success: true,
        message: 'Document successfully returned and lock released.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }
}
export default CheckoutController;
