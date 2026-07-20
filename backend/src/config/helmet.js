import helmet from 'helmet';

export const helmetOptions = {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: true,
};

export const helmetMiddleware = helmet(helmetOptions);

export default helmetMiddleware;
