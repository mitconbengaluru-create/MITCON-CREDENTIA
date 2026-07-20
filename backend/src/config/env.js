import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const envName = process.env.NODE_ENV || 'development';

// 1. Automatically load correct environment file
dotenv.config({ path: path.resolve(process.cwd(), `.env.${envName}`) });
dotenv.config(); // Fallback to standard .env

// 2. Define strict validation schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_NAME: z.string().default('MITCON Ledger'),
  APP_URL: z.string().url().default('http://localhost:5000'),
  API_VERSION: z.string().default('v1'),
  
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_BUCKET: z.string().default('documents'),
  SUPABASE_ANON_KEY: z.string().min(1).optional().default('anon-key-fallback'),
  SUPABASE_JWT_SECRET: z.string().min(1).optional().default('supabase-jwt-secret-fallback'),

  JWT_SECRET: z.string().min(8).default('jwt-secret-default-string-fallback-key'),
  JWT_EXPIRY: z.string().default('1h'),
  REFRESH_SECRET: z.string().min(8).default('refresh-secret-default-string-fallback-key'),
  SESSION_SECRET: z.string().min(8).default('session-secret-default-string-fallback-key'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_ENABLED: z.enum(['true', 'false']).transform((v) => v === 'true').default('true'),

  CORS_ORIGIN: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW: z.coerce.number().default(15),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration validation failed:', parsedEnv.error.format());
  process.exit(1);
}

// Extract parsed data
const data = parsedEnv.data;

/**
 * Nested structured configuration object.
 * Fully frozen at runtime to prevent accidental modifications.
 */
export const config = Object.freeze({
  app: Object.freeze({
    port: data.PORT,
    env: data.NODE_ENV,
    name: data.APP_NAME,
    url: data.APP_URL,
    apiVersion: data.API_VERSION,
  }),
  database: Object.freeze({
    url: data.DATABASE_URL,
    directUrl: data.DIRECT_DATABASE_URL || data.DATABASE_URL,
  }),
  supabase: Object.freeze({
    url: data.SUPABASE_URL,
    serviceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY,
    bucket: data.SUPABASE_BUCKET,
    anonKey: data.SUPABASE_ANON_KEY,
    jwtSecret: data.SUPABASE_JWT_SECRET,
  }),
  storage: Object.freeze({
    bucket: data.SUPABASE_BUCKET,
    provider: 'SUPABASE',
    region: 'ap-northeast-1',
    limitBytes: 52428800, // 50 MB
  }),
  jwt: Object.freeze({
    secret: data.JWT_SECRET,
    expiry: data.JWT_EXPIRY,
    refreshSecret: data.REFRESH_SECRET,
    sessionSecret: data.SESSION_SECRET,
  }),
  redis: Object.freeze({
    host: data.REDIS_HOST,
    port: data.REDIS_PORT,
    password: data.REDIS_PASSWORD || '',
    url: data.REDIS_URL,
    enabled: data.REDIS_ENABLED,
  }),
  security: Object.freeze({
    corsOrigin: data.CORS_ORIGIN || data.CORS_ORIGINS,
    rateLimitWindow: data.RATE_LIMIT_WINDOW,
    rateLimitMax: data.RATE_LIMIT_MAX,
  }),
  email: Object.freeze({
    smtpHost: data.SMTP_HOST || '',
    smtpPort: data.SMTP_PORT || 587,
    smtpUser: data.SMTP_USER || '',
    smtpPassword: data.SMTP_PASSWORD || '',
  }),
});

/**
 * Legacy flat environment reference helper for backward compatibility.
 */
export const env = Object.freeze(data);

export default env;
