import { Router } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { timestamp: 'desc' }
    });
    res.status(200).json(notifications);
  } catch (err) {
    console.error("Error reading notifications from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read notifications." });
  }
});

router.put('/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await prisma.notification.update({
      where: { id },
      data: { status: "read" }
    });
    res.status(200).json({ success: true, notification: updated });
  } catch (err) {
    console.error("Error marking notification as read in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to update notification status." });
  }
});

router.post('/clear-all', async (req, res) => {
  try {
    await prisma.notification.deleteMany();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error clearing notifications in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to clear notifications." });
  }
});

export default router;
