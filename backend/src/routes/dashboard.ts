import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, protectRoute } from '../middlewares/authHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dashboard - Fetches aggregate data for Dashboard UI
router.get('/', protectRoute, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;

    // Fetch user with their relations (Resume, Skills, Badges)
    const dashboardData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        careerInterest: true,
        githubLink: true,
        codingProfiles: true,
        resume: {
          include: { 
            skills: {
              include: { tests: true }
            } 
          }
        },
        badges: true,
        documents: true,
      }
    });
    
    if (!dashboardData) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// POST /api/dashboard/productivity - Update developer profiles
router.post('/productivity', protectRoute, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const { github, linkedin, leetcode, hackerrank, certifications } = req.body;
    
    // Store extra profiles as a JSON string in codingProfiles
    const codingProfiles = JSON.stringify({
       linkedin: linkedin || "",
       leetcode: leetcode || "",
       hackerrank: hackerrank || "",
       certifications: certifications || ""
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubLink: github || "",
        codingProfiles: codingProfiles
      }
    });

    res.json({ message: 'Productivity profile updated successfully' });
  } catch (error) {
    console.error('Productivity update error:', error);
    res.status(500).json({ error: 'Failed to update productivity profile' });
  }
});

export default router;
