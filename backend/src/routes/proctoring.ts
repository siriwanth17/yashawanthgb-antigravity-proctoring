import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, protectRoute } from '../middlewares/authHandler';

const router = express.Router();
const prisma = new PrismaClient();

// 1. Log a real-time violation during an exam
router.post('/violation', protectRoute, async (req: AuthRequest, res) => {
  try {
    const { testId, eventType, severity, screenshot } = req.body;
    const userId = req.user.id;

    if (!testId || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify test belongs to user and is active
    const test = await prisma.skillTest.findUnique({ where: { id: testId } });
    if (!test || test.userId !== userId || test.status !== 'PENDING') {
      return res.status(403).json({ error: 'Invalid or inactive test session' });
    }

    const log = await prisma.proctoringLog.create({
      data: {
        testId,
        userId,
        eventType,
        severity: severity || 'LOW',
        screenshot: screenshot || null,
      }
    });

    res.json({ message: 'Violation logged', logId: log.id });
  } catch (error) {
    console.error('Logging violation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
