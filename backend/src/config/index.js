import { env, config } from './env.js';
import prisma from './database.js';
import { supabaseAnon, supabaseAdmin, STORAGE_BUCKETS } from './supabase.js';
import redis from './redis.js';
import { queueConnectionOptions, defaultJobOptions, queueConfigs } from './bullmq.js';
import { logger } from './logger.js';
import { securityConfig } from './security.js';

/**
 * Validated configuration constants mapping.
 * 
 * @type {Readonly<Object>}
 */
export { config, env };

export {
  prisma,
  supabaseAnon,
  supabaseAdmin,
  STORAGE_BUCKETS,
  redis,
  queueConnectionOptions,
  defaultJobOptions,
  queueConfigs,
  logger,
  securityConfig,
};

export default {
  config,
  prisma,
  supabaseAnon,
  supabaseAdmin,
  STORAGE_BUCKETS,
  redis,
  queueConnectionOptions,
  defaultJobOptions,
  queueConfigs,
  logger,
  securityConfig,
};
