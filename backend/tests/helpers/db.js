import { prisma } from '../../src/config/database.js';

/**
 * Cleans up the test database tables in correct dependency order.
 * 
 * @async
 * @function cleanupDb
 * @returns {Promise<void>}
 */
export async function cleanupDb() {
  try {
    await prisma.return.deleteMany({});
    await prisma.checkout.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.securityPolicy.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (err) {
    console.error('[DB Cleanup Error]:', err);
  }
}
