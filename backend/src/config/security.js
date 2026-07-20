import env from './env.js';

/**
 * Parses and splits whitelisted CORS origins from environment strings.
 * 
 * @type {string[]}
 */
export const corsWhitelist = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

/**
 * Global Security Parameters configuration.
 * Maps cryptographic, CORS, and HTTP header properties.
 * 
 * @type {Object}
 */
export const securityConfig = {
  bcrypt: {
    rounds: env.BCRYPT_ROUNDS,
  },
  jwt: {
    secret: env.SUPABASE_JWT_SECRET,
    expiresIn: env.JWT_EXPIRE_IN,
    algorithms: ['HS256'], // Supabase tokens sign standard HS256 HMAC JWTs
  },
  cookieSecret: env.SUPABASE_JWT_SECRET, // Unified cookie signature secret
  bodyLimits: {
    json: '10mb',
    urlEncoded: '10mb',
  },
  cors: {
    origin: corsWhitelist,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Preflight cache lifespan: 24 hours (86400 seconds)
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
        imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    referrerPolicy: { policy: 'same-origin' },
  },
  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // Limit each IP to 20 auth attempts per windowMs
      message: 'Too many login attempts from this IP, please try again after 15 minutes',
    },
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50, // Limit each IP to 50 uploads per windowMs
      message: 'Upload limit exceeded from this IP, please try again after an hour',
    },
  },
};

export default securityConfig;
