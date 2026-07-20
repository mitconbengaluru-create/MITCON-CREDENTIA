import { createClient } from '@supabase/supabase-js';
import { supabaseAnon, supabaseAdmin } from '../config/supabase.js';
import { prisma } from '../config/database.js';
import env from '../config/env.js';

import { DeviceRepository, IdentityActivityRepository, SessionRepository } from '../repositories/security.repository.js';
import { parseUserAgent } from '../utils/security.util.js';

// =========================================================================
// 1. Authentication Constants & DTOs
// =========================================================================

/**
 * Authentication and Session configuration options.
 * @constant
 * @type {Object}
 */
export const AUTH_CONFIG = {
  TOKEN_EXPIRY: {
    ACCESS: '15m',
    REFRESH: '7d',
  },
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: true, // Configured for HTTPS/TLS pipelines
    sameSite: 'strict',
    path: '/',
  },
};

/**
 * Success status messages returned by authentication routes.
 * @constant
 * @type {Object}
 */
export const AUTH_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in.',
  LOGOUT_SUCCESS: 'Successfully logged out.',
  TOKEN_REFRESH_SUCCESS: 'Access token refreshed successfully.',
  PASSWORD_RESET_REQUEST_SUCCESS: 'Verification and reset code successfully dispatched.',
  PASSWORD_RESET_SUCCESS: 'Your credential passwords have been updated.',
  EMAIL_VERIFICATION_SUCCESS: 'Your email address has been successfully verified.',
  RESEND_VERIFICATION_SUCCESS: 'Verification link resent to email.',
};

/**
 * Standardized system-level authentication error codes and messages.
 * @constant
 * @type {Object}
 */
export const AUTH_ERRORS = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Access credentials missing or invalid.',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email address or passcode sequence.',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Active login session tokens have expired.',
  },
  SESSION_REVOKED: {
    code: 'SESSION_REVOKED',
    message: 'The session has been revoked or logged out.',
  },
  EMAIL_UNVERIFIED: {
    code: 'EMAIL_UNVERIFIED',
    message: 'Please verify your email address to log in.',
  },
};

/**
 * DTO representing formatted profile information returned to clients.
 */
export class UserProfileDto {
  /**
   * Constructs a formatted User profile DTO.
   * @param {Object} userRecord - User model from database or Supabase Auth
   */
  constructor(userRecord) {
    this.id = userRecord.id;
    this.email = userRecord.email;
    this.name = userRecord.name || null;
    this.role = userRecord.role || 'EDITOR';
    this.createdAt = userRecord.createdAt;
  }

  /**
   * Utility to map a raw user record or Supabase session.
   * @static
   * @param {Object} rawUser
   * @returns {UserProfileDto}
   */
  static fromRecord(rawUser) {
    return new UserProfileDto(rawUser);
  }
}

/**
 * DTO representing the response payload returned after a successful login or token refresh.
 */
export class AuthResponseDto {
  /**
   * Constructs an AuthResponseDto containing tokens and user metadata.
   * @param {string} accessToken - Short-lived JSON Web Token
   * @param {string} refreshToken - Long-lived session renewal token
   * @param {Object} userRecord - Raw user record
   */
  constructor(accessToken, refreshToken, userRecord) {
    this.tokens = {
      accessToken,
      refreshToken,
    };
    this.user = UserProfileDto.fromRecord(userRecord);
  }

  /**
   * Utility builder to generate formatted auth token payloads.
   * @static
   * @param {string} accessToken
   * @param {string} refreshToken
   * @param {Object} userRecord
   * @returns {AuthResponseDto}
   */
  static fromSession(accessToken, refreshToken, userRecord) {
    return new AuthResponseDto(accessToken, refreshToken, userRecord);
  }
}

// =========================================================================
// 2. MFA Constants & DTOs
// =========================================================================

/**
 * Success status messages returned by MFA routes.
 * @constant
 * @type {Object}
 */
export const MFA_MESSAGES = {
  ENROLL_SUCCESS: 'MFA enrollment initiated successfully.',
  VERIFY_SUCCESS: 'MFA verified and successfully enabled.',
  DISABLE_SUCCESS: 'MFA successfully disabled.',
  RECOVERY_CODES_SUCCESS: 'Backup recovery codes retrieved successfully.',
};

/**
 * Standardized system-level MFA error codes and messages.
 * @constant
 * @type {Object}
 */
export const MFA_ERRORS = {
  ALREADY_ENROLLED: {
    code: 'MFA_ALREADY_ENROLLED',
    message: 'MFA is already enrolled for this user account.',
  },
  INVALID_CODE: {
    code: 'MFA_INVALID_CODE',
    message: 'The verification code provided is invalid or has expired.',
  },
  NOT_ENROLLED: {
    code: 'MFA_NOT_ENROLLED',
    message: 'MFA has not been enrolled or activated for this user.',
  },
};

/**
 * DTO representing formatted MFA TOTP enrollment metadata.
 */
export class MfaEnrollResponseDto {
  /**
   * Constructs an MfaEnrollResponseDto.
   * @param {Object} enrollData
   */
  constructor(enrollData) {
    this.factorId = enrollData.id;
    this.type = enrollData.type;
    this.totp = {
      qrCode: enrollData.totp.qr_code,
      secret: enrollData.totp.secret,
      uri: enrollData.totp.uri,
    };
  }

  /**
   * Utility builder.
   * @static
   * @param {Object} enrollData
   * @returns {MfaEnrollResponseDto}
   */
  static fromData(enrollData) {
    return new MfaEnrollResponseDto(enrollData);
  }
}

/**
 * DTO representing formatted MFA verify details.
 */
export class MfaVerifyResponseDto {
  /**
   * Constructs an MfaVerifyResponseDto.
   * @param {Object} verifyData
   */
  constructor(verifyData) {
    this.factorId = verifyData.id;
    this.status = 'verified';
  }

  /**
   * Utility builder.
   * @static
   * @param {Object} verifyData
   * @returns {MfaVerifyResponseDto}
   */
  static fromData(verifyData) {
    return new MfaVerifyResponseDto(verifyData);
  }
}

// =========================================================================
// 3. Devices Constants & DTOs
// =========================================================================

/**
 * Success messages returned by device management endpoints.
 * @constant
 * @type {Object}
 */
export const DEVICE_MESSAGES = {
  LIST_SUCCESS: 'Registered user devices list retrieved successfully.',
  TRUST_SUCCESS: 'Device successfully marked as trusted.',
  REVOKE_SUCCESS: 'Device successfully revoked and session terminated.',
};

/**
 * Standardized device error codes and messages.
 * @constant
 * @type {Object}
 */
export const DEVICE_ERRORS = {
  NOT_FOUND: {
    code: 'DEVICE_NOT_FOUND',
    message: 'Target device or active login session does not exist.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED_DEVICE_ACTION',
    message: 'You are not authorized to manage this device.',
  },
};

/**
 * DTO representing formatted device details returned to clients.
 */
export class DeviceResponseDto {
  /**
   * Constructs a formatted DeviceResponseDto.
   * @param {Object} sessionRecord - Session model representing device metadata
   */
  constructor(sessionRecord) {
    this.id = sessionRecord.id;
    this.device = sessionRecord.device || 'Unknown Platform';
    this.browser = sessionRecord.browser || 'Unknown Browser';
    this.os = sessionRecord.os || 'Unknown OS';
    this.ipAddress = sessionRecord.ipAddress || 'Unknown IP';
    this.isTrusted = !!sessionRecord.isTrusted;
    this.status = sessionRecord.status;
    this.lastAccessedAt = sessionRecord.updatedAt;
    this.createdAt = sessionRecord.createdAt;
  }

  /**
   * Utility builder to generate formatted device responses.
   * @static
   * @param {Object} sessionRecord
   * @returns {DeviceResponseDto}
   */
  static fromRecord(sessionRecord) {
    return new DeviceResponseDto(sessionRecord);
  }
}

// =========================================================================
// 4. Identity Activity Constants & DTOs
// =========================================================================

/**
 * Standard system audit log actions relating to identity and authentication.
 * @constant
 * @type {string[]}
 */
export const AUTH_LOG_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'MFA_ENROLL',
  'MFA_VERIFY',
  'PASSWORD_RESET',
  'EMAIL_VERIFICATION',
];

/**
 * Success messages returned by identity activity endpoints.
 * @constant
 * @type {Object}
 */
export const ACTIVITY_MESSAGES = {
  LIST_SUCCESS: 'Identity activity logs retrieved successfully.',
};

/**
 * Standardized activity error codes.
 * @constant
 * @type {Object}
 */
export const ACTIVITY_ERRORS = {
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    message: 'Invalid query filters parameters.',
  },
};

/**
 * DTO representing formatted identity activity logs returned to clients.
 */
export class ActivityResponseDto {
  /**
   * Constructs a formatted ActivityResponseDto.
   * @param {Object} logRecord - AuditLog database model representing user activity
   */
  constructor(logRecord) {
    this.id = logRecord.id;
    this.action = logRecord.action;
    this.ipAddress = logRecord.ipAddress || 'Unknown IP';
    this.userAgent = logRecord.userAgent || 'Unknown User-Agent';
    this.payload = logRecord.payload || {};
    this.timestamp = logRecord.createdAt;
  }

  /**
   * Utility builder to generate formatted activity responses.
   * @static
   * @param {Object} logRecord
   * @returns {ActivityResponseDto}
   */
  static fromRecord(logRecord) {
    return new ActivityResponseDto(logRecord);
  }
}

// =========================================================================
// 5. Permissions Constants & DTOs
// =========================================================================

/**
 * Standardized system permissions definitions.
 * @constant
 * @type {Object}
 */
export const PERMISSION_NAMES = {
  DOCUMENTS_READ: 'DOCUMENTS_READ',
  DOCUMENTS_WRITE: 'DOCUMENTS_WRITE',
  DOCUMENTS_DELETE: 'DOCUMENTS_DELETE',
  USERS_MANAGE: 'USERS_MANAGE',
  ROLES_MANAGE: 'ROLES_MANAGE',
};

/**
 * Success status messages returned by permissions routes.
 * @constant
 * @type {Object}
 */
export const PERMISSION_MESSAGES = {
  CREATE_SUCCESS: 'Permission successfully created.',
  UPDATE_SUCCESS: 'Permission configuration successfully updated.',
  RETRIEVE_SUCCESS: 'Permission retrieved successfully.',
  LIST_SUCCESS: 'Permissions list retrieved successfully.',
  ASSIGN_SUCCESS: 'Permission successfully assigned to target role.',
  DELETE_SUCCESS: 'Permission successfully deleted.',
};

/**
 * Standardized permission error codes and messages.
 * @constant
 * @type {Object}
 */
export const PERMISSION_ERRORS = {
  NOT_FOUND: {
    code: 'PERMISSION_NOT_FOUND',
    message: 'Requested permission context does not exist.',
  },
  DUPLICATE_NAME: {
    code: 'DUPLICATE_PERMISSION_NAME',
    message: 'A permission with this identifier name is already registered.',
  },
  PROTECTED_PERMISSION: {
    code: 'PROTECTED_SYSTEM_PERMISSION',
    message: 'System default permissions cannot be mutated or deleted.',
  },
};

/**
 * DTO representing raw inputs mapped during creation parameters.
 */
export class CreatePermissionDto {
  /**
   * Constructs a CreatePermissionDto.
   * @param {Object} rawBody
   */
  constructor(rawBody) {
    this.name = rawBody.name.toUpperCase();
    this.description = rawBody.description || null;
  }

  /**
   * Utility parser builder.
   * @static
   * @param {Object} rawBody
   * @returns {CreatePermissionDto}
   */
  static fromRequest(rawBody) {
    return new CreatePermissionDto(rawBody);
  }
}

/**
 * DTO representing raw inputs mapped during updates parameters.
 */
export class UpdatePermissionDto {
  /**
   * Constructs an UpdatePermissionDto.
   * @param {Object} rawBody
   */
  constructor(rawBody) {
    if (rawBody.description !== undefined) this.description = rawBody.description;
  }

  /**
   * Utility parser builder.
   * @static
   * @param {Object} rawBody
   * @returns {UpdatePermissionDto}
   */
  static fromRequest(rawBody) {
    return new UpdatePermissionDto(rawBody);
  }
}

/**
 * DTO representing formatted permission profiles returned to clients.
 */
export class PermissionResponseDto {
  /**
   * Constructs a formatted PermissionResponseDto.
   * @param {Object} permissionRecord - Permission model from database
   */
  constructor(permissionRecord) {
    this.id = permissionRecord.id;
    this.name = permissionRecord.name;
    this.description = permissionRecord.description || null;
    this.createdAt = permissionRecord.createdAt;
  }

  /**
   * Utility to map a permission database model.
   * @static
   * @param {Object} permissionRecord
   * @returns {PermissionResponseDto}
   */
  static fromRecord(permissionRecord) {
    return new PermissionResponseDto(permissionRecord);
  }
}

// =========================================================================
// 6. RBAC Constants & Cache
// =========================================================================

/**
 * Standard system role identifiers.
 * @constant
 * @type {Object}
 */
export const RBAC_ROLES = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
};

/**
 * Standard system permission keys.
 * @constant
 * @type {Object}
 */
export const RBAC_PERMISSIONS = {
  DOCUMENTS_READ: 'DOCUMENTS_READ',
  DOCUMENTS_WRITE: 'DOCUMENTS_WRITE',
  DOCUMENTS_DELETE: 'DOCUMENTS_DELETE',
  USERS_MANAGE: 'USERS_MANAGE',
  ROLES_MANAGE: 'ROLES_MANAGE',
  CHECKOUT_CREATE: 'CHECKOUT_CREATE',
  CHECKOUT_VIEW: 'CHECKOUT_VIEW',
  CHECKOUT_UPDATE: 'CHECKOUT_UPDATE',
  CHECKOUT_CANCEL: 'CHECKOUT_CANCEL',
  CHECKOUT_MANAGE: 'CHECKOUT_MANAGE',
  APPROVAL_CREATE: 'APPROVAL_CREATE',
  APPROVAL_VIEW: 'APPROVAL_VIEW',
  APPROVAL_UPDATE: 'APPROVAL_UPDATE',
  APPROVAL_APPROVE: 'APPROVAL_APPROVE',
  APPROVAL_REJECT: 'APPROVAL_REJECT',
  APPROVAL_MANAGE: 'APPROVAL_MANAGE',
  SIGNATURE_CREATE: 'SIGNATURE_CREATE',
  SIGNATURE_VIEW: 'SIGNATURE_VIEW',
  SIGNATURE_VERIFY: 'SIGNATURE_VERIFY',
  SIGNATURE_REVOKE: 'SIGNATURE_REVOKE',
  SIGNATURE_MANAGE: 'SIGNATURE_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',
  AUDIT_SECURITY_VIEW: 'AUDIT_SECURITY_VIEW',
  AUDIT_EXPORT: 'AUDIT_EXPORT',
  AUDIT_ADMIN: 'AUDIT_ADMIN',
};

/**
 * Static mapping of roles to their permitted actions list.
 * Supports wildcard permissions for administrative bypass.
 * @constant
 * @type {Object<string, string[]>}
 */
export const ROLE_PERMISSIONS_MAP = {
  [RBAC_ROLES.ADMIN]: ['*'],
  [RBAC_ROLES.EDITOR]: [
    RBAC_PERMISSIONS.DOCUMENTS_READ,
    RBAC_PERMISSIONS.DOCUMENTS_WRITE,
    RBAC_PERMISSIONS.CHECKOUT_CREATE,
    RBAC_PERMISSIONS.CHECKOUT_VIEW,
    RBAC_PERMISSIONS.CHECKOUT_UPDATE,
    RBAC_PERMISSIONS.CHECKOUT_CANCEL,
    RBAC_PERMISSIONS.CHECKOUT_MANAGE,
    RBAC_PERMISSIONS.APPROVAL_CREATE,
    RBAC_PERMISSIONS.APPROVAL_VIEW,
    RBAC_PERMISSIONS.APPROVAL_UPDATE,
    RBAC_PERMISSIONS.APPROVAL_APPROVE,
    RBAC_PERMISSIONS.APPROVAL_REJECT,
    RBAC_PERMISSIONS.SIGNATURE_CREATE,
    RBAC_PERMISSIONS.SIGNATURE_VIEW,
    RBAC_PERMISSIONS.SIGNATURE_VERIFY,
    RBAC_PERMISSIONS.SIGNATURE_REVOKE,
    RBAC_PERMISSIONS.AUDIT_VIEW,
    RBAC_PERMISSIONS.AUDIT_EXPORT,
    RBAC_PERMISSIONS.AUDIT_SECURITY_VIEW,
  ],
};

/**
 * Standardized system authorization errors.
 * @constant
 * @type {Object}
 */
export const AUTHORIZATION_ERRORS = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Access credentials missing or invalid.',
  },
  SESSION_REVOKED: {
    code: 'SESSION_REVOKED',
    message: 'Active user session is revoked or expired.',
  },
  FORBIDDEN_ROLE: {
    code: 'FORBIDDEN_ROLE',
    message: 'Access denied: insufficient role privileges.',
  },
  FORBIDDEN_PERMISSION: {
    code: 'FORBIDDEN_PERMISSION',
    message: 'Access denied: insufficient permission privilege context.',
  },
};

/**
 * Memory-based cache manager for resolved user permissions.
 * Bypasses redundant database role retrievals during high concurrency.
 */
export class PermissionCache {
  /**
   * Constructs a PermissionCache.
   * @param {number} [ttlMs=30000] - Time to live in milliseconds (defaults to 30s)
   */
  constructor(ttlMs = 30000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  /**
   * Gets cached permissions list for a user.
   * @param {string} userId - User UUID
   * @returns {string[]|null} Cached permissions array or null if expired/missing
   */
  get(userId) {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(userId);
      return null;
    }
    return entry.permissions;
  }

  /**
   * Caches permissions list for a user.
   * @param {string} userId - User UUID
   * @param {string[]} permissions - Permissions array
   */
  set(userId, permissions) {
    this.cache.set(userId, {
      permissions,
      expiry: Date.now() + this.ttlMs,
    });
  }

  /**
   * Invalidates a user's cached entry.
   * @param {string} userId - User UUID
   */
  invalidate(userId) {
    this.cache.delete(userId);
  }

  /**
   * Clears the entire cache store.
   */
  clear() {
    this.cache.clear();
  }
}

// Global cache instance
export const permissionCache = new PermissionCache();

// =========================================================================
// 7. Sessions Constants & DTOs
// =========================================================================

/**
 * Session configurations.
 * @constant
 * @type {Object}
 */
export const SESSION_CONFIG = {
  DEFAULT_EXPIRY_DAYS: 7,
};

/**
 * Success messages returned by session routes.
 * @constant
 * @type {Object}
 */
export const SESSION_MESSAGES = {
  CREATE_SUCCESS: 'Session registered successfully.',
  LIST_SUCCESS: 'Active sessions retrieved successfully.',
  REVOKE_SUCCESS: 'Session revoked successfully.',
  REVOKE_ALL_SUCCESS: 'All other active sessions revoked successfully.',
};

/**
 * Standardized session error codes and messages.
 * @constant
 * @type {Object}
 */
export const SESSION_ERRORS = {
  NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    message: 'Requested session does not exist or has expired.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED_SESSION',
    message: 'You are not authorized to manage this session.',
  },
};

/**
 * DTO representing raw inputs mapped during session creation.
 */
export class CreateSessionDto {
  /**
   * Constructs a CreateSessionDto.
   * @param {Object} rawBody
   */
  constructor(rawBody) {
    this.userId = rawBody.userId;
    this.token = rawBody.token;
    this.userAgent = rawBody.userAgent || null;
    this.ipAddress = rawBody.ipAddress || null;
    
    // Default expiry is 7 days matching Supabase Auth defaults
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + SESSION_CONFIG.DEFAULT_EXPIRY_DAYS);
    this.expiresAt = rawBody.expiresAt ? new Date(rawBody.expiresAt) : defaultExpiry;
  }

  /**
   * Utility parser builder.
   * @static
   * @param {Object} rawBody
   * @returns {CreateSessionDto}
   */
  static fromRequest(rawBody) {
    return new CreateSessionDto(rawBody);
  }
}

/**
 * DTO representing raw inputs mapped during session revocation.
 */
export class RevokeSessionDto {
  /**
   * Constructs a RevokeSessionDto.
   * @param {Object} rawBody
   */
  constructor(rawBody) {
    this.sessionId = rawBody.sessionId;
  }

  /**
   * Utility parser builder.
   * @static
   * @param {Object} rawBody
   * @returns {RevokeSessionDto}
   */
  static fromRequest(rawBody) {
    return new RevokeSessionDto(rawBody);
  }
}

/**
 * DTO representing formatted session profiles returned to clients.
 */
export class SessionResponseDto {
  /**
   * Constructs a formatted SessionResponseDto.
   * @param {Object} sessionRecord - Session model from database
   */
  constructor(sessionRecord) {
    this.id = sessionRecord.id;
    this.device = sessionRecord.device || 'Unknown Device';
    this.browser = sessionRecord.browser || 'Unknown Browser';
    this.os = sessionRecord.os || 'Unknown OS';
    this.ipAddress = sessionRecord.ipAddress || 'Unknown IP';
    this.status = sessionRecord.status;
    this.expiresAt = sessionRecord.expiresAt;
    this.createdAt = sessionRecord.createdAt;
  }

  /**
   * Utility to map a session database model.
   * @static
   * @param {Object} sessionRecord
   * @returns {SessionResponseDto}
   */
  static fromRecord(sessionRecord) {
    return new SessionResponseDto(sessionRecord);
  }
}

// =========================================================================
// 8. Services Definitions
// =========================================================================

/**
 * Service to resolve database-backed security roles.
 */
export class RoleResolutionService {
  /**
   * Resolves the current local database role bound to a user.
   * 
   * @async
   * @method resolveUserRole
   * @param {string} userId - User UUID
   * @returns {Promise<string>} User role identifier string
   */
  async resolveUserRole(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role || RBAC_ROLES.EDITOR;
  }
}

/**
 * Service to compile effective permission states from active role profiles.
 */
export class PermissionResolutionService {
  constructor() {
    this.roleResolutionService = new RoleResolutionService();
  }

  /**
   * Resolves and returns the list of permissions associated with a user's role.
   * Leverages caching to decrease latency during middleware execution.
   * 
   * @async
   * @method resolvePermissions
   * @param {string} userId - User UUID
   * @returns {Promise<string[]>} Resolved permission strings list
   */
  async resolvePermissions(userId) {
    const cached = permissionCache.get(userId);
    if (cached) {
      return cached;
    }

    const role = await this.roleResolutionService.resolveUserRole(userId);
    const permissions = ROLE_PERMISSIONS_MAP[role] || [];

    permissionCache.set(userId, permissions);
    return permissions;
  }

  /**
   * Verifies if a user has a specific permission.
   * Automatically executes wildcard (*) validation maps.
   * 
   * @async
   * @method hasPermission
   * @param {string} userId - User UUID
   * @param {string} permission - Target permission requirement
   * @returns {Promise<boolean>} Resolves to true if validation passes
   */
  async hasPermission(userId, permission) {
    const permissions = await this.resolvePermissions(userId);
    if (permissions.includes('*')) {
      return true; // Super Admin wildcard bypass
    }
    return permissions.includes(permission);
  }
}

/**
 * Core Sessions Business Logic Service
 */
export class SessionsService {
  constructor() {
    this.sessionRepository = new SessionRepository();
  }

  /**
   * Registers a new active user login session in the database.
   * Parses user agent header into device, browser, and OS specifications.
   * 
   * @async
   * @method createSession
   * @param {CreateSessionDto} createSessionDto - Sanitized creation parameters
   * @returns {Promise<Object>} Created session record
   */
  async createSession(createSessionDto) {
    console.log(`[Sessions Service] Creating session record for User: ${createSessionDto.userId}`);
    const { browser, os, device } = parseUserAgent(createSessionDto.userAgent);

    return this.sessionRepository.createSession({
      userId: createSessionDto.userId,
      token: createSessionDto.token,
      device,
      browser,
      os,
      ipAddress: createSessionDto.ipAddress,
      expiresAt: createSessionDto.expiresAt,
    });
  }

  /**
   * Lists all active database sessions matching a user identifier.
   * 
   * @async
   * @method listSessions
   * @param {string} userId - User identifier
   * @returns {Promise<Array<Object>>} List of active user sessions
   */
  async listSessions(userId) {
    console.log(`[Sessions Service] Querying active sessions registry for User ID: ${userId}`);
    return this.sessionRepository.listSessionsByUserId(userId);
  }

  /**
   * Revokes a specific session configuration.
   * Enforces security ownership checks: only the session owner can revoke it.
   * 
   * @async
   * @method revokeSession
   * @param {string} userId - Requesting user identifier
   * @param {string} sessionId - Target session identifier (UUID)
   * @returns {Promise<Object>} Updated session record
   */
  async revokeSession(userId, sessionId) {
    console.log(`[Sessions Service] Revoking Session ID: ${sessionId} for User: ${userId}`);
    const session = await this.sessionRepository.findSessionById(sessionId);

    if (!session) {
      const err = new Error(SESSION_ERRORS.NOT_FOUND.message);
      err.statusCode = 404;
      err.code = SESSION_ERRORS.NOT_FOUND.code;
      throw err;
    }

    if (session.userId !== userId) {
      const err = new Error(SESSION_ERRORS.UNAUTHORIZED.message);
      err.statusCode = 403;
      err.code = SESSION_ERRORS.UNAUTHORIZED.code;
      throw err;
    }

    return this.sessionRepository.revokeSession(sessionId);
  }

  /**
   * Revokes all active database session records for a user, except for their current active token.
   * 
   * @async
   * @method revokeAllSessionsExceptCurrent
   * @param {string} userId - Target user identifier
   * @param {string} currentToken - User's current session token
   * @returns {Promise<void>}
   */
  async revokeAllSessionsExceptCurrent(userId, currentToken) {
    console.log(`[Sessions Service] Clearing other sessions for User ID: ${userId}`);
    await this.sessionRepository.revokeAllSessionsExcept(userId, currentToken);
  }
}

/**
 * Core Devices Business Logic Service
 */
export class DevicesService {
  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  /**
   * Lists all active devices associated with a user's login.
   * 
   * @async
   * @method listDevices
   * @param {string} userId - User UUID
   * @returns {Promise<Array<Object>>} List of active device records
   */
  async listDevices(userId) {
    console.log(`[Devices Service] Fetching active devices registry for user: ${userId}`);
    return this.deviceRepository.listDevicesByUserId(userId);
  }

  /**
   * Marks a specific device as trusted.
   * Enforces security ownership check.
   * 
   * @async
   * @method trustDevice
   * @param {string} userId - Requesting user UUID
   * @param {string} deviceId - Target device ID (Session UUID)
   * @param {boolean} isTrusted - Target trust status
   * @returns {Promise<Object>} Updated device record details
   */
  async trustDevice(userId, deviceId, isTrusted) {
    console.log(`[Devices Service] Marking device ID ${deviceId} trust status as: ${isTrusted}`);
    const device = await this.deviceRepository.findDeviceById(deviceId);

    if (!device) {
      const err = new Error(DEVICE_ERRORS.NOT_FOUND.message);
      err.statusCode = 404;
      err.code = DEVICE_ERRORS.NOT_FOUND.code;
      throw err;
    }

    if (device.userId !== userId) {
      const err = new Error(DEVICE_ERRORS.UNAUTHORIZED.message);
      err.statusCode = 403;
      err.code = DEVICE_ERRORS.UNAUTHORIZED.code;
      throw err;
    }

    return this.deviceRepository.updateDeviceTrust(deviceId, isTrusted);
  }

  /**
   * Revokes/deletes a device registration (terminating the active session).
   * Enforces security ownership check.
   * 
   * @async
   * @method revokeDevice
   * @param {string} userId - Requesting user UUID
   * @param {string} deviceId - Target device ID (Session UUID)
   * @returns {Promise<Object>} Updated device record details
   */
  async revokeDevice(userId, deviceId) {
    console.log(`[Devices Service] Revoking active device registration for ID: ${deviceId}`);
    const device = await this.deviceRepository.findDeviceById(deviceId);

    if (!device) {
      const err = new Error(DEVICE_ERRORS.NOT_FOUND.message);
      err.statusCode = 404;
      err.code = DEVICE_ERRORS.NOT_FOUND.code;
      throw err;
    }

    if (device.userId !== userId) {
      const err = new Error(DEVICE_ERRORS.UNAUTHORIZED.message);
      err.statusCode = 403;
      err.code = DEVICE_ERRORS.UNAUTHORIZED.code;
      throw err;
    }

    return this.deviceRepository.revokeDevice(deviceId);
  }
}

/**
 * Core Identity Activity Business Logic Service
 */
export class IdentityActivityService {
  constructor() {
    this.activityRepository = new IdentityActivityRepository();
  }

  /**
   * Lists paginated identity activities for a target user.
   * 
   * @async
   * @method listActivities
   * @param {string} userId - User UUID
   * @param {Object} filters - Pagination parameters (page, limit)
   * @returns {Promise<{activities: Array<Object>, total: number, page: number, limit: number}>} Paginated results
   */
  async listActivities(userId, filters = {}) {
    console.log(`[Identity Activity Service] Loading activities for User: ${userId}`);
    const page = Math.max(1, parseInt(filters.page || 1, 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || 10, 10)));
    const offset = (page - 1) * limit;

    const { activities, total } = await this.activityRepository.findActivitiesByUserId(
      userId,
      AUTH_LOG_ACTIONS,
      limit,
      offset
    );

    return {
      activities,
      total,
      page,
      limit,
    };
  }
}

/**
 * Core Permissions Business Logic Service
 */
export class PermissionsService {
  /**
   * Handles security permission creation logic.
   * 
   * @async
   * @method createPermission
   * @param {CreatePermissionDto} createPermissionDto - Sanitized parameters
   * @returns {Promise<Object>} Created database permission record placeholder
   */
  async createPermission(createPermissionDto) {
    console.log(`[Permissions Service] Creating custom permission definition: ${createPermissionDto.name}`);
    return {
      id: `permission-${Date.now()}`,
      name: createPermissionDto.name,
      description: createPermissionDto.description,
      createdAt: new Date(),
    };
  }

  /**
   * Handles security permission description updates.
   * 
   * @async
   * @method updatePermission
   * @param {string} permissionId - Permission identifier
   * @param {UpdatePermissionDto} updatePermissionDto - Updated description
   * @returns {Promise<Object>} Updated database permission record placeholder
   */
  async updatePermission(permissionId, updatePermissionDto) {
    console.log(`[Permissions Service] Updating permission description parameters for ID: ${permissionId}`);
    return {
      id: permissionId,
      name: 'CUSTOM_PERMISSION_ACTION',
      description: updatePermissionDto.description || 'Custom corporate permission config.',
      createdAt: new Date(),
    };
  }

  /**
   * Retrieves details for a specific permission ID.
   * 
   * @async
   * @method getPermission
   * @param {string} permissionId - Permission identifier
   * @returns {Promise<Object>} Matching database permission record placeholder
   */
  async getPermission(permissionId) {
    console.log(`[Permissions Service] Querying permission details for ID: ${permissionId}`);
    return {
      id: permissionId,
      name: PERMISSION_NAMES.DOCUMENTS_READ,
      description: 'Permits reading and downloading master credentials documents.',
      createdAt: new Date(),
    };
  }

  /**
   * Lists registered permissions based on pagination limits.
   * 
   * @async
   * @method listPermissions
   * @param {Object} filters - Paginated limits (page, limit)
   * @returns {Promise<Object>} Paginated array of permission records and metadata
   */
  async listPermissions(filters) {
    console.log('[Permissions Service] Loading list registry of permissions records...');
    return {
      permissions: [
        {
          id: 'permission-1',
          name: PERMISSION_NAMES.DOCUMENTS_READ,
          description: 'Permits reading and downloading master credentials documents.',
          createdAt: new Date(),
        },
      ],
      total: 1,
      page: filters.page || 1,
      limit: filters.limit || 10,
    };
  }

  /**
   * Binds a target permission identifier to a designated security role profile.
   * 
   * @async
   * @method assignPermission
   * @param {string} roleId - Target security role identifier
   * @param {string} permissionName - Security permission identifier name
   * @returns {Promise<Object>} Assignment success validation details
   */
  async assignPermission(roleId, permissionName) {
    console.log(`[Permissions Service] Binding permission ${permissionName} to security role ID: ${roleId}`);
    return {
      roleId,
      permission: permissionName,
      assignedAt: new Date(),
    };
  }

  /**
   * Deletes a custom security permission definition.
   * 
   * @async
   * @method deletePermission
   * @param {string} permissionId - Permission identifier
   * @returns {Promise<void>}
   */
  async deletePermission(permissionId) {
    console.log(`[Permissions Service] Purging custom permission definition ID: ${permissionId}`);
  }
}

/**
 * Core Auth Business Logic Service
 */
export class AuthService {
  constructor() {}

  /**
   * Evaluates user login credentials.
   * Calls Supabase signInWithPassword, syncs the user profile locally, and registers a session.
   * 
   * @async
   * @method login
   * @param {string} email - Account email address
   * @param {string} password - User password
   * @param {string} [userAgent] - Requesting User-Agent header
   * @param {string} [ipAddress] - Requesting client IP address
   * @returns {Promise<Object>} Formatted session authentication payload
   */
  async login(email, password, userAgent = null, ipAddress = null) {
    console.log(`[Auth Service] Performing credential logic checks for: ${email}`);
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    const userUuid = data.user.id;
    let localUser = await prisma.user.findUnique({ where: { id: userUuid } });
    if (!localUser) {
      localUser = await prisma.user.create({
        data: {
          id: userUuid,
          email: data.user.email,
          role: 'EDITOR',
        },
      });
    }

    // Sync database session (Static invocation from same file)
    try {
      const sessionsService = new SessionsService();
      await sessionsService.createSession({
        userId: userUuid,
        token: data.session.refresh_token,
        userAgent,
        ipAddress,
      });
    } catch (sessionErr) {
      console.error('[Auth Service] Failed to register database session:', sessionErr);
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: localUser,
    };
  }

  /**
   * Concludes and terminates an active user session.
   * Leverages request-scoped temp Supabase Client for thread-safe logout execution.
   * 
   * @async
   * @method logout
   * @param {Object} params
   * @param {string} params.accessToken - JWT access token
   * @param {string} params.refreshToken - Cryptographic session refresh token
   * @returns {Promise<void>}
   */
  async logout({ accessToken, refreshToken }) {
    console.log('[Auth Service] Processing session logout logic...');
    const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    await tempClient.auth.setSession({
      access_token: accessToken || '',
      refresh_token: refreshToken || '',
    });

    const { error } = await tempClient.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Refreshes a short-lived access token using a long-lived refresh token.
   * Updates old session to EXPIRED and creates a new active session record.
   * 
   * @async
   * @method refreshToken
   * @param {string} refreshToken - Cryptographic session refresh token
   * @param {string} [userAgent] - Requesting User-Agent header
   * @param {string} [ipAddress] - Requesting client IP address
   * @returns {Promise<Object>} Formatted session authentication payload
   */
  async refreshToken(refreshToken, userAgent = null, ipAddress = null) {
    console.log('[Auth Service] Processing token refresh sequence...');
    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    const userUuid = data.user.id;
    // FIXED: Use direct prisma calls instead of non-existent this.authRepository
    let localUser = await prisma.user.findUnique({ where: { id: userUuid } });
    if (!localUser) {
      localUser = await prisma.user.create({
        data: {
          id: userUuid,
          email: data.user.email,
          role: 'EDITOR',
        },
      });
    }

    // Sync database session: transition old refresh token to EXPIRED and create new (Static invocation)
    try {
      const sessionRepo = new SessionRepository();
      const oldSession = await sessionRepo.findSessionByToken(refreshToken);
      if (oldSession) {
        await sessionRepo.updateSessionStatus(oldSession.id, 'EXPIRED');
      }

      const sessionsService = new SessionsService();
      await sessionsService.createSession({
        userId: userUuid,
        token: data.session.refresh_token,
        userAgent,
        ipAddress,
      });
    } catch (sessionErr) {
      console.error('[Auth Service] Failed to transition database sessions during token refresh:', sessionErr);
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: localUser,
    };
  }

  /**
   * Initiates the password recovery flow for a user.
   * 
   * @async
   * @method forgotPassword
   * @param {string} email - Targeted account email address
   * @returns {Promise<void>}
   */
  async forgotPassword(email) {
    console.log(`[Auth Service] Requesting password reset dispatch route for: ${email}`);
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  }

  /**
   * Concludes the password reset flow using a verification token.
   * Leverages request-scoped temp Supabase Client for thread-safe session execution.
   * 
   * @async
   * @method resetPassword
   * @param {string} token - Password recovery reset verification token
   * @param {string} newPassword - New password credential
   * @returns {Promise<void>}
   */
  async resetPassword(token, newPassword) {
    console.log('[Auth Service] Resetting credential passcodes with token...');
    const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { error: sessionError } = await tempClient.auth.setSession({
      access_token: token,
      refresh_token: token, // fallback
    });

    if (sessionError) {
      throw sessionError;
    }

    const { error } = await tempClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }
  }

  /**
   * Verifies a user's email address.
   * Stub endpoint - Supabase email verification redirects clients to verification landing routes directly.
   * 
   * @async
   * @method verifyEmail
   * @param {string} token - Email verification validation token
   * @returns {Promise<void>}
   */
  async verifyEmail(token) {
    console.log('[Auth Service] Confirming email verification token...');
  }

  /**
   * Dispatches a fresh email verification link to a user.
   * 
   * @async
   * @method resendVerification
   * @param {string} email - Targeted account email address
   * @returns {Promise<void>}
   */
  async resendVerification(email) {
    console.log(`[Auth Service] Dispatched email validation verification links to: ${email}`);
    const { error } = await supabaseAnon.auth.resend({
      type: 'signup',
      email,
    });
    if (error) {
      throw error;
    }
  }

  /**
   * Fetches profile information for the currently authenticated user.
   * Queries local PostgreSQL DB, falling back to Supabase Admin lookup if profile isn't cached locally yet.
   * 
   * @async
   * @method getCurrentUser
   * @param {string} userId - Currently authenticated User ID (Supabase UUID)
   * @returns {Promise<Object>} Currently authenticated user model information
   */
  async getCurrentUser(userId) {
    console.log(`[Auth Service] Fetching profile information details for user: ${userId}`);
    const localUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!localUser) {
      const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error || !supabaseUser) {
        throw new Error('User not found in identity provider.');
      }

      return prisma.user.create({
        data: {
          id: userId,
          email: supabaseUser.email,
          role: 'EDITOR',
        },
      });
    }
    return localUser;
  }

  /**
   * Enrolls the user in TOTP MFA.
   * Leverages request-scoped temp Supabase client for thread-safety.
   * 
   * @async
   * @method enrollMfa
   * @param {string} accessToken - Verified user access token JWT
   * @returns {Promise<Object>} Supabase MFA factors details
   */
  async enrollMfa(accessToken) {
    console.log('[Auth Service] Enrolling user in TOTP MFA...');
    const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    await tempClient.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken,
    });

    const { data, error } = await tempClient.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'MITCON Credentia',
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Verifies the MFA challenge.
   * Leverages request-scoped temp Supabase client.
   * 
   * @async
   * @method verifyMfa
   * @param {string} accessToken - Verified user access token JWT
   * @param {string} factorId - Factor ID returned from enrollment
   * @param {string} code - TOTP challenge code
   * @returns {Promise<Object>} Verified challenge response details
   */
  async verifyMfa(accessToken, factorId, code) {
    console.log(`[Auth Service] Verifying MFA challenge for factor ID: ${factorId}`);
    const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    await tempClient.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken,
    });

    // Challenge the factor
    const { data: challengeData, error: challengeError } = await tempClient.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      throw challengeError;
    }

    // Verify the challenge
    const { data: verifyData, error: verifyError } = await tempClient.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      throw verifyError;
    }

    return verifyData;
  }

  /**
   * Disables/unenrolls the TOTP MFA factor.
   * Leverages request-scoped temp Supabase client.
   * 
   * @async
   * @method disableMfa
   * @param {string} accessToken - Verified user access token JWT
   * @param {string} factorId - Active factor ID to disable
   * @returns {Promise<Object>} Unenrollment success response details
   */
  async disableMfa(accessToken, factorId) {
    console.log(`[Auth Service] Disabling MFA factor ID: ${factorId}`);
    const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    await tempClient.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken,
    });

    const { data, error } = await tempClient.auth.mfa.unenroll({
      factorId,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Retrieves secure backup recovery codes.
   * Leverages request-scoped temp Supabase client.
   * 
   * @async
   * @method getRecoveryCodes
   * @param {string} accessToken - Verified user access token JWT
   * @returns {Promise<string[]>} List of recovery codes
   */
  async getRecoveryCodes(accessToken) {
    console.log('[Auth Service] Retrieving secure backup recovery codes...');
    const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    await tempClient.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken,
    });

    const { data, error } = await tempClient.auth.mfa.getRecoveryCodes();

    if (error) {
      throw error;
    }

    return data.recovery_codes || [];
  }
}
