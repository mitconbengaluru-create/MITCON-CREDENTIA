import { PrismaClient } from '@prisma/client';
import env from './env.js';

let prismaInstance = null;

/**
 * Initializes and configures the Prisma Client database singleton.
 * Sets query logging options dynamically based on the current environment.
 * 
 * @function getPrismaInstance
 * @returns {PrismaClient} Instantiated database connection pool client
 */
function getPrismaInstance() {
  if (!prismaInstance) {
    const isDev = env.NODE_ENV === 'development';
    
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' }
      ],
    });

    const SLOW_QUERY_MS = 500;

    prismaInstance.$on('query', (event) => {
      if (event.duration > SLOW_QUERY_MS) {
        import('../utils/performance.util.js').then(({ slowQueryDetected }) => {
          slowQueryDetected(event.query, event.duration);
        }).catch(() => {});
      }
    });
  }

  return prismaInstance;
}

export const prisma = getPrismaInstance();

// =========================================================================
// 📘 REPOSITORY INTEGRATION GUIDELINE
// =========================================================================
/**
 * REPOSITORY GUIDELINES:
 * All database CRUD operations must be encapsulated inside clean Repository files.
 * Modifying service files must not make direct Prisma queries.
 *
 * Example Repository Layout:
 * 
 * ```javascript
 * import { prisma } from '../../config/database.js';
 * 
 * export class DocumentRepository {
 *   static async findById(id) {
 *     return prisma.document.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */

// =========================================================================
// 📘 PRISMA TRANSACTION (ACID) GUIDELINE
// =========================================================================
/**
 * TRANSACTION GUIDELINES:
 * For concurrent operations that depend on atomicity (e.g. Checkout checks, version promotions),
 * use Prisma's transactional APIs.
 * 
 * 1. Standard Batch (Parallel updates):
 * ```javascript
 * const [updatedDoc, newAuditLog] = await prisma.$transaction([
 *   prisma.document.update(...),
 *   prisma.auditLog.create(...)
 * ]);
 * ```
 * 
 * 2. Interactive Transactions (Sequential logic dependent on database checks):
 * ```javascript
 * await prisma.$transaction(async (tx) => {
 *   const doc = await tx.document.findUnique({ where: { id } });
 *   if (doc.isLocked) throw new Error('Locked');
 *   await tx.document.update(...);
 * });
 * ```
 */

// =========================================================================
// 📘 DATABASE MIGRATION & SEED WORKFLOWS
// =========================================================================
/**
 * MIGRATION WORKFLOW:
 * 1. Modify the `prisma/schema.prisma` file to add models/relations.
 * 2. Generate and run the migration against PostgreSQL:
 *    `npx prisma migrate dev --name <migration_name>`
 * 3. In production, execute the generated migrations:
 *    `npx prisma migrate deploy`
 * 
 * SEED WORKFLOW:
 * Populate base configurations and admin user records:
 * 1. Setup mock profiles inside `prisma/seed.js`.
 * 2. Execute the seed runner:
 *    `npx prisma db seed`
 */

export default prisma;
