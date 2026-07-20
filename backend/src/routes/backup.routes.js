import { Router } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

router.get('/backup', async (req, res) => {
  try {
    const policies = await prisma.securityPolicy.findMany();
    const users = await prisma.user.findMany();
    const documents = await prisma.document.findMany();
    const checkouts = await prisma.checkout.findMany();
    const returns = await prisma.return.findMany();
    const notifications = await prisma.notification.findMany();
    const approvals = await prisma.approvalRequest.findMany();

    const backupData = {
      policies: policies[0] || null,
      users,
      documents,
      checkouts,
      returns,
      notifications,
      approvals
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    console.error("Backup failed in PostgreSQL:", err);
    res.status(500).json({ message: "Backup operation failed." });
  }
});

router.post('/backup/restore', async (req, res) => {
  const { backupPayload } = req.body;

  if (!backupPayload || !backupPayload.users || !backupPayload.documents) {
    return res.status(400).json({ message: "Invalid backup payload format." });
  }

  try {
    await prisma.document.deleteMany();
    await prisma.checkout.deleteMany();
    await prisma.return.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.securityPolicy.deleteMany();
    await prisma.user.deleteMany();

    // Restore Policies
    if (backupPayload.policies) {
      const p = backupPayload.policies;
      await prisma.securityPolicy.create({
        data: {
          key: "global_policy",
          passwordMinLength: p.passwordMinLength ?? 8,
          requireMfa: p.requireMfa ?? false,
          sessionTimeoutMinutes: p.sessionTimeoutMinutes ?? 30,
          allowedUploadFormats: p.allowedUploadFormats ?? ["pdf", "docx", "xlsx"],
          autoRejectExpiredCheckouts: p.autoRejectExpiredCheckouts ?? false,
          maxCheckoutDurationDays: p.maxCheckoutDurationDays ?? 30
        }
      });
    } else {
      await prisma.securityPolicy.create({
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

    // Restore Users
    if (backupPayload.users && Array.isArray(backupPayload.users)) {
      for (const u of backupPayload.users) {
        await prisma.user.create({
          data: {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            status: u.status || "active"
          }
        });
      }
    }

    // Restore Documents
    if (backupPayload.documents && Array.isArray(backupPayload.documents)) {
      for (const d of backupPayload.documents) {
        await prisma.document.create({
          data: {
            id: d.id,
            documentId: d.documentId,
            documentName: d.documentName,
            owner: d.owner || d.uploadedBy,
            dateUploaded: d.dateUploaded ? new Date(d.dateUploaded) : new Date(),
            expiryDate: d.expiryDate,
            filePath: d.filePath,
            status: d.status || "Available",
            uploadedBy: d.uploadedBy,
            client: d.client || "Internal Core"
          }
        });
      }
    }

    // Restore Checkouts
    if (backupPayload.checkouts && Array.isArray(backupPayload.checkouts)) {
      for (const c of backupPayload.checkouts) {
        await prisma.checkout.create({
          data: {
            id: c.id,
            documentId: c.documentId,
            documentDbId: c.documentDbId,
            documentName: c.documentName,
            employeeName: c.employeeName,
            employeeId: c.employeeId,
            designation: c.designation,
            checkoutDate: c.checkoutDate,
            destination: c.destination,
            purpose: c.purpose,
            expectedReturnDate: c.expectedReturnDate,
            approvalAuthority: c.approvalAuthority,
            status: c.status
          }
        });
      }
    }

    // Restore Returns
    if (backupPayload.returns && Array.isArray(backupPayload.returns)) {
      for (const r of backupPayload.returns) {
        await prisma.return.create({ data: r });
      }
    }

    // Restore Approvals
    if (backupPayload.approvals && Array.isArray(backupPayload.approvals)) {
      for (const a of backupPayload.approvals) {
        await prisma.approvalRequest.create({
          data: {
            id: a.id,
            documentDbId: a.documentDbId,
            documentId: a.documentId,
            documentName: a.documentName,
            employeeName: a.employeeName,
            employeeId: a.employeeId,
            designation: a.designation,
            destination: a.destination,
            purpose: a.purpose,
            expectedReturnDate: a.expectedReturnDate,
            signature: a.signature,
            signatureType: a.signatureType,
            status: a.status || "Pending Approval",
            requestedAt: a.requestedAt ? new Date(a.requestedAt) : new Date()
          }
        });
      }
    }

    // Restore Notifications
    if (backupPayload.notifications && Array.isArray(backupPayload.notifications)) {
      for (const n of backupPayload.notifications) {
        await prisma.notification.create({
          data: {
            id: n.id,
            title: n.title,
            message: n.message,
            status: n.status || "unread",
            timestamp: n.timestamp ? new Date(n.timestamp) : new Date()
          }
        });
      }
    }

    res.status(200).json({ success: true, message: "Database restored successfully." });
  } catch (err) {
    console.error("Database restore operation failed in PostgreSQL:", err);
    res.status(500).json({ message: "Database restore failed." });
  }
});

export default router;
