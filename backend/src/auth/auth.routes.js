import { Router } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const matchedUser = await prisma.user.findUnique({ where: { email } });

  if (!matchedUser) {
    return res.status(401).json({ message: "No organizational records found matching this email address." });
  }

  const validPasswords = [
    "password123",
    "admin",
    "Vibin1806@1038",
    "Ankita0207@10841",
    "Ravi2608@90092",
    "Mahesh0607@11150"
  ];

  if (!validPasswords.includes(password)) {
    return res.status(401).json({ message: "Invalid credentials entered." });
  }

  return res.status(200).json({
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      status: matchedUser.status,
      designation: matchedUser.designation
    },
    token: `mock-jwt-token-for-${matchedUser.email}`
  });
});

export default router;
