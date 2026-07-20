import { Router } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (err) {
    console.error("Error reading users from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read users." });
  }
});

router.post('/users', async (req, res) => {
  const body = req.body;
  try {
    const email = (body.email || "").trim().toLowerCase();
    if (!email.endsWith('@mitconindia.com') && !email.endsWith('@mitconcredentia.in')) {
      return res.status(400).json({ message: "Invalid email domain. Authorized organizational domains are: @mitconindia.com or @mitconcredentia.in" });
    }

    const newUser = await prisma.user.create({
      data: {
        id: `usr-${Date.now()}`,
        name: body.name,
        email: email,
        role: body.role || "developer",
        createdAt: new Date(),
        status: "active",
        designation: body.designation || null
      }
    });

    res.status(200).json(newUser);
  } catch (err) {
    console.error("Error creating user in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to create user." });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.sendStatus(204);
  } catch (err) {
    console.error("Error deleting user from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to delete user." });
  }
});

router.get('/policies', async (req, res) => {
  try {
    let policy = await prisma.securityPolicy.findUnique({ where: { key: "global_policy" } });
    if (!policy) {
      policy = await prisma.securityPolicy.create({
        data: {
          key: "global_policy",
          passwordMinLength: 8,
          requireMfa: false,
          sessionTimeoutMinutes: 30,
          allowedUploadFormats: ["pdf", "docx", "xlsx"],
          autoRejectExpiredCheckouts: false,
          maxCheckoutDurationDays: 30
        }
      });
    }
    res.status(200).json(policy);
  } catch (err) {
    console.error("Error reading policies from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read policies." });
  }
});

router.put('/policies', async (req, res) => {
  const body = req.body;
  try {
    let policy = await prisma.securityPolicy.findUnique({ where: { key: "global_policy" } });
    if (!policy) {
      policy = await prisma.securityPolicy.create({
        data: {
          key: "global_policy",
          passwordMinLength: 8,
          requireMfa: false,
          sessionTimeoutMinutes: 30,
          allowedUploadFormats: ["pdf", "docx", "xlsx"],
          autoRejectExpiredCheckouts: false,
          maxCheckoutDurationDays: 30
        }
      });
    }

    const prev = { ...policy };

    const updatedPolicy = await prisma.securityPolicy.update({
      where: { key: "global_policy" },
      data: {
        passwordMinLength: body.passwordMinLength ?? prev.passwordMinLength,
        requireMfa: body.requireMfa ?? prev.requireMfa,
        sessionTimeoutMinutes: body.sessionTimeoutMinutes ?? prev.sessionTimeoutMinutes,
        allowedUploadFormats: body.allowedUploadFormats ?? prev.allowedUploadFormats,
        autoRejectExpiredCheckouts: body.autoRejectExpiredCheckouts ?? prev.autoRejectExpiredCheckouts,
        maxCheckoutDurationDays: body.maxCheckoutDurationDays ?? prev.maxCheckoutDurationDays
      }
    });

    res.status(200).json(updatedPolicy);
  } catch (err) {
    console.error("Error updating policies in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to update policies." });
  }
});

export default router;
