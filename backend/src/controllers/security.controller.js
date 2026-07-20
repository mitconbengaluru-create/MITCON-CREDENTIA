import {
  DevicesService,
  DEVICE_MESSAGES,
  IdentityActivityService,
  ACTIVITY_MESSAGES,
  PermissionsService,
  CreatePermissionDto,
  UpdatePermissionDto,
  PERMISSION_MESSAGES,
  SessionsService,
  CreateSessionDto,
  SESSION_MESSAGES
} from '../services/security.service.js';
import { deviceMapper, activityMapper, roleMapper, sessionMapper, permissionMapper } from '../utils/security.util.js';
import { RolesService, CreateRoleDto, UpdateRoleDto, ROLE_MESSAGES } from '../roles/roles.service.js';
import { parseTokenHeader } from '../auth/auth.routes.js';

const devicesService = new DevicesService();
const activityService = new IdentityActivityService();
const permissionsService = new PermissionsService();
const rolesService = new RolesService();
const sessionsService = new SessionsService();

/**
 * Controller class managing Express HTTP layer device management.
 * Decouples routes from raw business operations.
 */
export class DevicesController {
  /**
   * Lists all active user devices.
   * 
   * @async
   * @method listDevices
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async listDevices(req, res, next) {
    try {
      const userId = req.user?.id;
      const result = await devicesService.listDevices(userId);

      const deviceResponseList = result.map(deviceMapper);

      res.status(200).json({
        success: true,
        message: DEVICE_MESSAGES.LIST_SUCCESS,
        data: deviceResponseList,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Marks a specific device as trusted.
   * 
   * @async
   * @method trustDevice
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async trustDevice(req, res, next) {
    try {
      const userId = req.user?.id;
      const deviceId = req.params.id;
      const { isTrusted } = req.body;

      const result = await devicesService.trustDevice(userId, deviceId, isTrusted);
      const responseData = deviceMapper(result);

      res.status(200).json({
        success: true,
        message: DEVICE_MESSAGES.TRUST_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revokes/deletes a device registration, terminating the session.
   * 
   * @async
   * @method revokeDevice
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async revokeDevice(req, res, next) {
    try {
      const userId = req.user?.id;
      const deviceId = req.params.id;

      await devicesService.revokeDevice(userId, deviceId);

      res.status(200).json({
        success: true,
        message: DEVICE_MESSAGES.REVOKE_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Controller class managing Express HTTP layer identity activities.
 * Decouples routes from raw business operations.
 */
export class IdentityActivityController {
  /**
   * Lists paginated authentication activity logs for the current user.
   * 
   * @async
   * @method listActivities
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async listActivities(req, res, next) {
    try {
      const userId = req.user?.id;
      const filters = req.query;

      const result = await activityService.listActivities(userId, filters);

      const activityResponseList = result.activities.map(activityMapper);

      res.status(200).json({
        success: true,
        message: ACTIVITY_MESSAGES.LIST_SUCCESS,
        data: {
          activities: activityResponseList,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Controller class managing Express HTTP layer permissions interfaces.
 * Decouples routes from raw business operations.
 */
export class PermissionsController {
  /**
   * Handles user permission creation requests.
   * 
   * @async
   * @method createPermission
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async createPermission(req, res, next) {
    try {
      const createPermissionDto = CreatePermissionDto.fromRequest(req.body);
      const result = await permissionsService.createPermission(createPermissionDto);
      
      const responseData = permissionMapper(result);

      res.status(201).json({
        success: true,
        message: PERMISSION_MESSAGES.CREATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles permission configuration update requests.
   * 
   * @async
   * @method updatePermission
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async updatePermission(req, res, next) {
    try {
      const { id } = req.params;
      const updatePermissionDto = UpdatePermissionDto.fromRequest(req.body);
      const result = await permissionsService.updatePermission(id, updatePermissionDto);

      const responseData = permissionMapper(result);

      res.status(200).json({
        success: true,
        message: PERMISSION_MESSAGES.UPDATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves security configuration details of a specific permission.
   * 
   * @async
   * @method getPermission
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async getPermission(req, res, next) {
    try {
      const { id } = req.params;
      const result = await permissionsService.getPermission(id);

      const responseData = permissionMapper(result);

      res.status(200).json({
        success: true,
        message: PERMISSION_MESSAGES.RETRIEVE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles listing security permission registry request query parameters.
   * 
   * @async
   * @method listPermissions
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async listPermissions(req, res, next) {
    try {
      const filters = req.query;
      const result = await permissionsService.listPermissions(filters);

      const permissionsListResponse = result.permissions.map(permissionMapper);

      res.status(200).json({
        success: true,
        message: PERMISSION_MESSAGES.LIST_SUCCESS,
        data: {
          permissions: permissionsListResponse,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Binds a target role profile to a designated permission mapping.
   * 
   * @async
   * @method assignPermission
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async assignPermission(req, res, next) {
    try {
      const { roleId, permissionName } = req.body;
      const result = await permissionsService.assignPermission(roleId, permissionName);

      res.status(200).json({
        success: true,
        message: PERMISSION_MESSAGES.ASSIGN_SUCCESS,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Purges a custom permission definition.
   * 
   * @async
   * @method deletePermission
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async deletePermission(req, res, next) {
    try {
      const { id } = req.params;
      await permissionsService.deletePermission(id);

      res.status(200).json({
        success: true,
        message: PERMISSION_MESSAGES.DELETE_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Controller class managing Express HTTP layer roles interfaces.
 * Decouples routes from raw business operations.
 */
export class RolesController {
  /**
   * Handles user role creation requests.
   * 
   * @async
   * @method createRole
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async createRole(req, res, next) {
    try {
      const createRoleDto = CreateRoleDto.fromRequest(req.body);
      const result = await rolesService.createRole(createRoleDto);
      
      const responseData = roleMapper(result);

      res.status(201).json({
        success: true,
        message: ROLE_MESSAGES.CREATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles role configuration update requests.
   * 
   * @async
   * @method updateRole
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const updateRoleDto = UpdateRoleDto.fromRequest(req.body);
      const result = await rolesService.updateRole(id, updateRoleDto);

      const responseData = roleMapper(result);

      res.status(200).json({
        success: true,
        message: ROLE_MESSAGES.UPDATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves security configuration details of a specific role.
   * 
   * @async
   * @method getRole
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async getRole(req, res, next) {
    try {
      const { id } = req.params;
      const result = await rolesService.getRole(id);

      const responseData = roleMapper(result);

      res.status(200).json({
        success: true,
        message: ROLE_MESSAGES.RETRIEVE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles listing security role registry request query parameters.
   * 
   * @async
   * @method listRoles
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async listRoles(req, res, next) {
    try {
      const filters = req.query;
      const result = await rolesService.listRoles(filters);

      const rolesListResponse = result.roles.map(roleMapper);

      res.status(200).json({
        success: true,
        message: ROLE_MESSAGES.LIST_SUCCESS,
        data: {
          roles: rolesListResponse,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Binds a target user profile to a designated role mapping.
   * 
   * @async
   * @method assignRole
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async assignRole(req, res, next) {
    try {
      const { userId, roleName } = req.body;
      const result = await rolesService.assignRole(userId, roleName);

      res.status(200).json({
        success: true,
        message: ROLE_MESSAGES.ASSIGN_SUCCESS,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Purges a custom role config from the system database.
   * 
   * @async
   * @method deleteRole
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      await rolesService.deleteRole(id);

      res.status(200).json({
        success: true,
        message: ROLE_MESSAGES.DELETE_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Controller class managing Express HTTP layer session management.
 * Decouples routes from raw business operations.
 */
export class SessionsController {
  /**
   * Handles manual session registration requests.
   * 
   * @async
   * @method createSession
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async createSession(req, res, next) {
    try {
      const userId = req.user?.id;
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.socket.remoteAddress || '';
      
      const createSessionDto = CreateSessionDto.fromRequest({
        userId,
        token: req.body.token,
        userAgent,
        ipAddress,
      });

      const result = await sessionsService.createSession(createSessionDto);
      const responseData = sessionMapper(result);

      res.status(201).json({
        success: true,
        message: SESSION_MESSAGES.CREATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lists all active sessions for the currently authenticated user.
   * 
   * @async
   * @method listSessions
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async listSessions(req, res, next) {
    try {
      const userId = req.user?.id;
      const result = await sessionsService.listSessions(userId);

      const sessionsResponse = result.map(sessionMapper);

      res.status(200).json({
        success: true,
        message: SESSION_MESSAGES.LIST_SUCCESS,
        data: sessionsResponse,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revokes a specific active session.
   * 
   * @async
   * @method revokeSession
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async revokeSession(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.params.id;

      await sessionsService.revokeSession(userId, sessionId);

      res.status(200).json({
        success: true,
        message: SESSION_MESSAGES.REVOKE_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revokes all active user sessions except for the current session.
   * Extracts the current session token from the authorization header.
   * 
   * @async
   * @method revokeAllSessions
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async revokeAllSessions(req, res, next) {
    try {
      const userId = req.user?.id;
      const authHeader = req.headers.authorization;
      const currentToken = parseTokenHeader(authHeader);

      await sessionsService.revokeAllSessionsExceptCurrent(userId, currentToken);

      res.status(200).json({
        success: true,
        message: SESSION_MESSAGES.REVOKE_ALL_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }
}
