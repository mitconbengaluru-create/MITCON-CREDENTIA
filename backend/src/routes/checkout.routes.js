import { Router } from 'express';
import { prisma } from '../config/database.js';
import { getIO } from '../config/socket.js';

const router = Router();

router.get('/checkouts', async (req, res) => {
  try {
    const checkouts = await prisma.checkout.findMany();
    res.status(200).json(checkouts);
  } catch (err) {
    console.error("Error fetching checkouts from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read checkouts." });
  }
});

router.post('/checkouts', async (req, res) => {
  const body = req.body;
  try {
    const doc = await prisma.document.findUnique({ where: { id: body.documentDbId } });
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    const newCheckout = await prisma.checkout.create({
      data: {
        id: `chk-${Date.now()}`,
        documentId: doc.documentId,
        documentDbId: doc.id,
        documentName: doc.documentName,
        employeeName: body.employeeName,
        employeeId: body.employeeId,
        designation: body.designation,
        checkoutDate: new Date().toISOString().split('T')[0],
        destination: body.destination,
        purpose: body.purpose,
        expectedReturnDate: body.expectedReturnDate,
        approvalAuthority: body.approvalAuthority || "Self Check",
        status: "Checked Out",
        signature: body.signature,
        signatureType: body.signatureType
      }
    });

    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "Checked Out" }
    });

    // Notify admins
    const notification = await prisma.notification.create({
      data: {
        id: `not-${Date.now()}`,
        title: "Document Checked Out",
        message: `${newCheckout.employeeName} checked out document ${newCheckout.documentId} (${newCheckout.documentName}) for ${newCheckout.destination}.`,
        status: "unread",
        timestamp: new Date()
      }
    });

    const io = getIO();
    if (io) {
      io.emit('notification:new', notification);
    }

    res.status(200).json(newCheckout);
  } catch (err) {
    console.error("Error creating checkout in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to perform checkout." });
  }
});

router.post('/checkouts/:id/return', async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  try {
    const checkout = await prisma.checkout.findUnique({ where: { id } });
    if (!checkout) {
      return res.status(404).json({ message: "Checkout record not found." });
    }

    const updatedCheckout = await prisma.checkout.update({
      where: { id },
      data: { status: "Returned" }
    });

    await prisma.document.update({
      where: { id: checkout.documentDbId },
      data: { status: "Available" }
    });

    await prisma.return.create({
      data: {
        id: `ret-${Date.now()}`,
        checkoutId: checkout.id,
        documentId: checkout.documentId,
        documentName: checkout.documentName,
        returnDate: new Date().toISOString().split('T')[0],
        returnTime: new Date().toLocaleTimeString(),
        condition: body.condition || "Perfect",
        notes: body.notes || "",
        returningEmployeeSignature: body.returningEmployeeSignature,
        returningEmployeeName: body.returningEmployeeName
      }
    });

    // Notify admins
    const notification = await prisma.notification.create({
      data: {
        id: `not-${Date.now()}`,
        title: "Document Returned",
        message: `${body.returningEmployeeName} checked in/returned document ${checkout.documentId} (${checkout.documentName}).`,
        status: "unread",
        timestamp: new Date()
      }
    });

    const io = getIO();
    if (io) {
      io.emit('notification:new', notification);
    }

    res.status(200).json(updatedCheckout);
  } catch (err) {
    console.error("Error execution return in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to perform return." });
  }
});

router.get('/returns', async (req, res) => {
  try {
    const returns = await prisma.return.findMany();
    res.status(200).json(returns);
  } catch (err) {
    console.error("Error fetching returns from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read returns." });
  }
});

export default router;
