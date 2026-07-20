import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { shutdownQueuesAndWorkers } from './jobs/index.js';
import redis from './config/redis.js';
import { initSocketServer, getIO } from './config/socket.js';
import { prisma } from './config/database.js';
import { supabaseAdmin } from './config/supabase.js';

// Load environmental parameters
dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = createServer(app);

// ==========================================
// Graceful Shutdown Management
// ==========================================

/**
 * Executes a graceful server shutdown. Closes incoming network ports
 * and disconnects downstream connection pools (Postgres, Redis, Workers).
 * 
 * @async
 * @function handleGracefulShutdown
 * @param {string} signal - The OS signal intercepted (e.g. SIGINT, SIGTERM)
 * @returns {Promise<void>}
 */
async function handleGracefulShutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown sequence initiated...`);

  // Refuse new incoming HTTP connections while processing existing pipelines
  server.close(async () => {
    console.log('HTTP connection ports successfully closed.');

    try {
      // Close Socket.IO server connections
      const io = getIO();
      if (io) {
        io.close();
        console.log('Socket.IO server closed.');
      }

      // 1. Gracefully stop BullMQ queue connections and worker processes
      await shutdownQueuesAndWorkers();

      // 2. Disconnect the main Redis ioredis client
      await redis.quit();
      console.log('Redis cache client connection closed.');

      // PLACEHOLDER: Disconnect Prisma database client
      // await prisma.$disconnect();
      // console.log('Database client disconnected.');

      console.log('Graceful cleanup completed. Exiting process.');
      process.exit(0);
    } catch (err) {
      console.error('Error encountered during database/cache resource cleanup:', err);
      process.exit(1);
    }
  });

  // Forcefully terminate process after a 10-second safety timeout
  setTimeout(() => {
    console.error('Forced shutdown triggered: Cleanup took too long.');
    process.exit(1);
  }, 10000);
}

// OS system signal hooks
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Uncaught system-level runtime monitors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection detected at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception detected:', error);
  // Immediately exit on uncaught synchronous errors to avoid runtime corruption
  process.exit(1);
});

// ==========================================
// Application Bootstrap Initiation
// ==========================================

/**
 * Tests downstream infrastructure bindings and boots up the Express HTTP server.
 * 
 * @async
 * @function startBootstrap
 * @returns {Promise<void>}
 */
async function startBootstrap() {
  try {
    let dbReady = false;
    let redisReady = false;
    let storageReady = false;

    // Verify Prisma database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch (dbErr) {
      console.error('❌ Database connection failed:', dbErr.message);
    }

    // Verify Redis connection client gracefully
    try {
      await redis.ping();
      redisReady = true;
    } catch (redisErr) {
      console.warn('⚠️ Redis Cache connection failed. Background job workers may be offline.');
    }

    // Verify Supabase Storage connection
    try {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) throw error;
      storageReady = true;
    } catch (storageErr) {
      console.warn('⚠️ Supabase Storage connection failed:', storageErr.message);
    }

    const isReady = dbReady && (NODE_ENV !== 'production' || (redisReady && storageReady));

    if (!isReady) {
      console.error('❌ Startup Health Check: FAILED');
      if (NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // Initialize Socket.IO server
    initSocketServer(server);

    server.listen(PORT);
  } catch (err) {
    console.error('❌ Critical bootstrap initiation failure:', err);
    process.exit(1);
  }
}

startBootstrap();
