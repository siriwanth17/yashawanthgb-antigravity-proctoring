import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, protectRoute } from '../middlewares/authHandler';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000/api/ai';

// 1. Generate Test
router.post('/generate', protectRoute, async (req: AuthRequest, res) => {
  try {
    const { skillId } = req.body;
    const userId = req.user.id;

    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Ensure user owns this skill via resume
    const resume = await prisma.resume.findUnique({ where: { id: skill.resumeId } });
    const user = await prisma.user.findUnique({ where: { id: userId }});
    if (!resume || resume.userId !== userId || !user) {
      return res.status(403).json({ error: 'Unauthorized to test for this skill' });
    }

    // Check 72-Hour Lockout for Phone Detection / Cheating
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
       return res.status(403).json({ 
         error: 'Account locked from taking tests due to a severe exam integrity violation (e.g., cell phone usage).',
         lockedUntil: user.lockoutUntil
       });
    }

    // Check 48-Hour Lockout for Rejected Tests (Global Ban across all skills)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentRejection = await prisma.skillTest.findFirst({
      where: {
        userId,
        status: "REJECTED",
        createdAt: { gte: fortyEightHoursAgo }
      }
    });

    if (recentRejection) {
       return res.status(403).json({ 
         error: 'Test locked due to suspicious activity.',
         lockedUntil: new Date(recentRejection.createdAt.getTime() + 48 * 60 * 60 * 1000)
       });
    }

    // Ping Python AI to generate 8 questions
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate-test`, {
      skill: skill.name,
      num_questions: 8
    });

    const questionsData = aiResponse.data.questions;
    if (!questionsData || questionsData.length === 0) {
      return res.status(500).json({ error: 'AI failed to generate questions' });
    }

    // Create Test in DB
    const newTest = await prisma.skillTest.create({
      data: {
        userId,
        skillId,
        totalScore: questionsData.length,
        questions: {
          create: questionsData.map((q: any) => ({
            text: q.text,
            options: JSON.stringify(q.options),
            answerIndex: q.answerIndex
          }))
        }
      },
      include: { questions: true }
    });

    res.json({ message: 'Test created', testId: newTest.id });
  } catch (error: any) {
    console.error('Test generation error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error while generating test' });
  }
});

// 2. Fetch specific test questions (obfuscating answerIndex)
router.get('/:testId', protectRoute, async (req: AuthRequest, res) => {
  try {
    const testId = req.params.testId as string;
    const test = await prisma.skillTest.findUnique({
      where: { id: testId },
      include: { questions: true }
    });

    if (!test || test.userId !== req.user.id) {
       return res.status(404).json({ error: 'Test not found or unauthorized' });
    }

    // Hide answers before sending to client
    const safeQuestions = test.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: JSON.parse(q.options)
    }));

    res.json({ testId: test.id, skillId: test.skillId, passed: test.passed, score: test.score, questions: safeQuestions });
  } catch (error) {
    console.error('Test fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Submit Test answers & Handle Cheating Terminations
// Payload: { answers?: { [qId]: number }, terminationEvent?: string }
router.post('/:testId/submit', protectRoute, async (req: AuthRequest, res) => {
  try {
    const { answers, terminationEvent } = req.body;
    const testId = req.params.testId as string;
    const userId = req.user.id as string;

    const test = await prisma.skillTest.findUnique({
      where: { id: testId },
      include: { questions: true }
    });

    if (!test || test.userId !== userId) {
       return res.status(404).json({ error: 'Test not found or unauthorized' });
    }

    // Check if test was already processed
    if (test.status !== "PENDING") {
       return res.status(400).json({ error: 'Test has already been submitted or rejected.' });
    }

    // Evaluate cumulative cheating score if test wasn't already rejected
    let cheatingScore = 0;
    const logs = await prisma.proctoringLog.findMany({ where: { testId } });
    
    logs.forEach(log => {
      switch (log.eventType) {
         case "TALKING_DETECTED": cheatingScore += 2; break;
         case "LOOKING_AWAY": cheatingScore += 3; break;
         case "TAB_SWITCH": cheatingScore += 4; break;
         case "PHONE_DETECTED": cheatingScore += 5; break;
         case "NO_FACE": cheatingScore += 3; break;
         case "MULTIPLE_FACE": cheatingScore += 10; break;
      }
    });

    if (terminationEvent) {
       // if frontend abruptly terminates it with an event, add it to score
       switch (terminationEvent) {
         case "TALKING_DETECTED": cheatingScore += 2; break;
         case "LOOKING_AWAY": cheatingScore += 3; break;
         case "TAB_SWITCH": cheatingScore += 4; break;
         case "PHONE_DETECTED": cheatingScore += 5; break;
         case "NO_FACE": cheatingScore += 3; break;
         case "MULTIPLE_FACE": cheatingScore += 10; break;
         default: cheatingScore += 5; break;
       }
       // Log the final termination event
       await prisma.proctoringLog.create({
         data: { testId, userId, eventType: terminationEvent, severity: "HIGH" }
       });
    }

    // Classification
    let cheatingClassification = "Normal";
    if (cheatingScore >= 6 && cheatingScore <= 15) cheatingClassification = "Suspicious";
    if (cheatingScore >= 16) cheatingClassification = "Cheating";

    if (cheatingClassification === "Cheating") {
       // Reject Test Status
       await prisma.skillTest.update({
         where: { id: testId },
         data: { 
           status: "REJECTED",
           passed: false,
           score: 0,
           terminationLog: `Cheating detected. Score: ${cheatingScore}`
         }
       });

       // Issue 72-Hour Lockout for actual cheating conviction
       await prisma.user.update({
          where: { id: userId },
          data: { lockoutUntil: new Date(Date.now() + 72 * 60 * 60 * 1000) }
       });

       return res.status(403).json({ error: `Test rejected due to severe suspicious activity. (Score: ${cheatingScore})` });
    }

    // Standard Grading Execution
    let score = 0;
    if (answers) {
      test.questions.forEach((q) => {
         const userAnswer = answers[q.id];
         if (userAnswer !== undefined && userAnswer === q.answerIndex) {
            score += 1;
         }
      });
    }

    // Pass >= 5 threshold
    const passed = score >= 5;
    const status = passed ? "PASSED" : "FAILED";

    // Update test
    await prisma.skillTest.update({
      where: { id: testId },
      data: { score, passed, status }
    });

    // Mark skill verified if passed
    if (passed) {
       await prisma.skill.update({
         where: { id: test.skillId },
         data: { verified: true }
       });
    }

    res.json({ message: 'Test submitted successfully', score, passed, status });
  } catch (error) {
    console.error('Test submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Fetch Test Proctoring Report
router.get('/:testId/report', protectRoute, async (req: AuthRequest, res) => {
  try {
    const testId = req.params.testId as string;
    const userId = req.user.id as string;

    const testReport = await prisma.skillTest.findUnique({
      where: { id: testId },
      include: {
        skill: true,
        proctorLogs: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!testReport || testReport.userId !== userId) {
       return res.status(404).json({ error: 'Report not found or unauthorized' });
    }

    res.json(testReport);
  } catch (error) {
    console.error('Test report fetch error:', error);
    res.status(500).json({ error: 'Internal server error while fetching report' });
  }
});

export default router;
