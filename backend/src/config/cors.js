import cors from 'cors';
import env from './env.js';

// Parse and clean whitelist, stripping any potential leading/trailing quotes from dotenv
const whitelist = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/^["']|["']$/g, ''))
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

export const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin || 
      whitelist.indexOf(origin) !== -1 || 
      (origin.endsWith('.vercel.app') && origin.includes('mitcon-credentia'))
    ) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: origin ${origin} is not in whitelist`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Operator-Name', 'X-Operator-Role'],
  credentials: true,
  maxAge: 86400, // Cache preflight response for 24 hours
};

export const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
