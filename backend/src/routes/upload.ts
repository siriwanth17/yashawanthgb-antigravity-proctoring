import express from 'express';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, protectRoute } from '../middlewares/authHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthRequest).user?.id || 'unknown';
    cb(null, `${userId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      return cb(new Error('Only PDF and DOCX files are allowed'));
    }
    cb(null, true);
  }
});

router.post('/resume', protectRoute, upload.single('resume'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'Please upload a valid file' });
    }

    // Local file URL to serve the file
    // Assuming backend runs on 5000
    const fileUrl = `http://localhost:5000/uploads/${file.filename}`;

    const resumeRecord = await prisma.resume.upsert({
      where: { userId: userId },
      update: { fileUrl, status: 'EXTRACTING', uploadDate: new Date() },
      create: { userId, fileUrl, status: 'EXTRACTING' }
    });

    // Fire & Forget to Python Service
    axios.post('http://localhost:8000/api/ai/parse-resume', {
      resumeId: resumeRecord.id,
      fileUrl: fileUrl,
      userId: userId
    }).catch(err => console.error("AI Service failed to start:", err.message));

    return res.status(200).json({ 
      message: 'Upload successful. AI parsing started.', 
      resume: resumeRecord 
    });

  } catch (error: any) {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Server error during upload' });
  }
});

// Configure Multer for Generic Documents
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthRequest).user?.id || 'unknown';
    cb(null, `doc-${userId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for documents
});

router.post('/document', protectRoute, uploadDoc.single('document'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Please upload a valid document' });
    }

    const fileUrl = `http://localhost:5000/uploads/${file.filename}`;
    const format = path.extname(file.originalname).substring(1).toUpperCase() || 'UNKNOWN';

    const newDoc = await prisma.document.create({
      data: {
        userId,
        name: file.originalname,
        fileUrl,
        format
      }
    });

    return res.status(200).json({ 
      message: 'Document uploaded securely.', 
      document: newDoc 
    });

  } catch (error: any) {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Doc upload error:", error);
    return res.status(500).json({ error: 'Server error during document upload' });
  }
});

export default router;
