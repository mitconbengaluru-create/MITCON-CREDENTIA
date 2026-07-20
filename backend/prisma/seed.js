import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { initialDocuments } from '../src/config/initialDocuments.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up existing database records...');
  await prisma.document.deleteMany();
  await prisma.checkout.deleteMany();
  await prisma.return.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.securityPolicy.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding security policies...');
  const policy = await prisma.securityPolicy.create({
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

  console.log('Seeding core users...');
  const users = [
    {
      id: "1038",
      name: "Vibin Cariappa",
      email: "vibin.cariappa@mitconindia.com",
      role: "developer",
      createdAt: new Date(),
      status: "active",
      designation: "Data Analyst Intern (BDS)"
    },
    {
      id: "10841",
      name: "Ankita Agrawal",
      email: "ankita.agarwal@mitconindia.com",
      role: "super-admin",
      createdAt: new Date(),
      status: "active",
      designation: "Regional Head"
    },
    {
      id: "90092",
      name: "Ravi Injolkar",
      email: "ravi@mitconcredentia.in",
      role: "admin",
      createdAt: new Date(),
      status: "active",
      designation: "BD Manager"
    },
    {
      id: "11150",
      name: "Mahesh Madhavarm",
      email: "mahesh.madhavarm@mitconindia.com",
      role: "admin",
      createdAt: new Date(),
      status: "active",
      designation: "HR & Admin Executive"
    }
  ];

  for (const u of users) {
    await prisma.user.create({ data: u });
  }

  console.log('Seeding standard document library...');
  for (const d of initialDocuments) {
    await prisma.document.create({
      data: {
        id: d.id,
        documentId: crypto.randomUUID(),
        documentName: d.documentName,
        dateUploaded: new Date(),
        expiryDate: null,
        filePath: `secure/repository/${d.id}.pdf`,
        status: "Available",
        uploadedBy: "System",
        client: d.client,
        dateOfRegistration: d.dateOfRegistration,
        placeOfHolding: "Bengaluru Office"
      }
    });
  }

  console.log('Seeding initial notifications...');
  await prisma.notification.create({
    data: {
      id: "not-1",
      title: "System Seeding Active",
      message: "Welcome to MITCON Credentia. The secure node is fully database-synchronized.",
      status: "unread",
      timestamp: new Date()
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
