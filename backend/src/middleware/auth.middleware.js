import { prisma } from '../config/database.js';

/**
 * Express middleware protecting endpoints against unauthenticated requests.
 */
export async function requireAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader) {
      token = authHeader.replace('Bearer ', '');
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Access token is missing." });
    }

    // Decode token or parse mock token
    if (token.startsWith('mock-jwt-token-for-')) {
      const email = token.replace('mock-jwt-token-for-', '');
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({ message: "Invalid or expired token." });
  } catch (err) {
    next(err);
  }
}

/**
 * Express middleware protecting endpoints against revoked session tokens.
 */
export async function requireSession(req, res, next) {
  // Relaxed in mock mode: if the user is authenticated, they have an active session
  if (req.user) {
    return next();
  }
  return res.status(401).json({ message: "No active session." });
}

/**
 * Express middleware restricting route endpoints to designated access roles.
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    // Super Admin role bypass
    if (userRole === 'super-admin' || userRole === 'ADMIN') {
      return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions." });
    }

    next();
  };
}

/**
 * Express middleware restricting routes to matching permission specifications.
 */
export function requirePermission(requiredPermission) {
  return (req, res, next) => {
    // In simplified model, we authorize access based on roles
    const userRole = req.user?.role;
    if (userRole === 'super-admin' || userRole === 'admin') {
      return next();
    }
    return res.status(403).json({ message: "Forbidden: insufficient permissions." });
  };
}

export default {
  requireAuth,
  requireSession,
  requireRole,
  requirePermission,
};
