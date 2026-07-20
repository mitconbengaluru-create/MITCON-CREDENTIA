import { Router } from 'express';
import { prisma } from '../config/database.js';
import { getIO } from '../config/socket.js';
import crypto from 'crypto';
import { initialDocuments } from '../config/initialDocuments.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const documents = await prisma.document.findMany();
    res.status(200).json(documents);
  } catch (err) {
    console.error("Error reading documents from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read documents." });
  }
});

router.post('/', async (req, res) => {
  const doc = req.body;

  if (!doc.client || !doc.client.trim()) {
    return res.status(400).json({ message: "Client name is required." });
  }
  if (!doc.documentName || !doc.documentName.trim()) {
    return res.status(400).json({ message: "Document Name is required." });
  }
  if (!doc.dateOfRegistration || !doc.dateOfRegistration.trim()) {
    return res.status(400).json({ message: "Date of registration is required." });
  }
  if (!doc.placeOfHolding || !doc.placeOfHolding.trim()) {
    return res.status(400).json({ message: "Place of document holding is required." });
  }

  try {
    const newDocId = `doc-${Date.now()}`;
    const newDoc = await prisma.document.create({
      data: {
        id: newDocId,
        documentId: crypto.randomUUID(), // unique id assigned on random
        documentName: doc.documentName.trim(),
        dateUploaded: new Date(),
        expiryDate: doc.expiryDate || null,
        filePath: `secure/repository/${newDocId}.pdf`,
        status: "Available",
        uploadedBy: doc.uploadedBy || "System",
        client: doc.client.trim(),
        dateOfRegistration: doc.dateOfRegistration.trim(),
        placeOfHolding: doc.placeOfHolding.trim()
      }
    });

    // Notify admins
    const notification = await prisma.notification.create({
      data: {
        id: `not-${Date.now()}`,
        title: "New Document Uploaded",
        message: `${newDoc.uploadedBy} registered a new document (${newDoc.documentName}) for ${newDoc.client}.`,
        status: "unread",
        timestamp: new Date()
      }
    });

    const io = getIO();
    if (io) {
      io.emit('notification:new', notification);
    }

    res.status(200).json(newDoc);
  } catch (err) {
    console.error("Error creating document in PostgreSQL:", err);
    if (err.code === 'P2002') {
      return res.status(400).json({ message: "A document with this randomly assigned ID already exists (collision). Please try again." });
    }
    res.status(500).json({ message: err.message || "Failed to create document record." });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    await prisma.document.delete({ where: { id } });
    res.sendStatus(204);
  } catch (err) {
    console.error("Error deleting document from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to delete document." });
  }
});

router.post('/restore-seed', async (req, res) => {
  try {
    await prisma.document.deleteMany();

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

    res.status(200).json({ message: "Seed documents successfully restored." });
  } catch (err) {
    console.error("Error restoring documents seed in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to restore seed." });
  }
});

export default router;
