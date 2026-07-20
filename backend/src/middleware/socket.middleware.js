import { supabaseAnon } from '../config/supabase.js';

/**
 * Resolves user role from database.
 */
async function prismaSelectUserRole(userId) {
  try {
    const { prisma } = await import('../config/database.js');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role || 'EDITOR';
  } catch {
    return 'EDITOR';
  }
}

/**
 * Intercepts Socket.IO handshake request to perform JWT token authentication and session verification.
 * 
 * @function socketAuthMiddleware
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {function} next - Callback function
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    // Attempt to extract token from various handshake positions
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

    if (!token) {
      return next(new Error('Authentication error: Token missing.'));
    }

    // Try mock auth resolution for development credentials
    if (token.startsWith('mock-jwt-token-for-')) {
      const email = token.substring('mock-jwt-token-for-'.length);
      const { prisma } = await import('../config/database.js');
      const matchedUser = await prisma.user.findUnique({ where: { email } });
      if (matchedUser) {
        socket.user = {
          id: matchedUser.id,
          email: matchedUser.email,
          role: matchedUser.role,
          departmentId: null
        };
        return next();
      }
    }

    // Authenticate JWT directly against Supabase Identity provider
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Authentication error: Invalid or expired token.'));
    }

    // Sync database-backed role context onto user object
    const role = await prismaSelectUserRole(user.id);

    // Bind authentication context to socket session
    socket.user = {
      id: user.id,
      email: user.email,
      role,
      departmentId: null,
    };

    next();
  } catch (err) {
    console.error('[SocketAuth] Handshake error:', err);
    next(new Error('Authentication error: Internal validation failure.'));
  }
}

export default socketAuthMiddleware;
