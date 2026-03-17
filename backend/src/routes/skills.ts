import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, protectRoute } from '../middlewares/authHandler';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/:skillId/trust-score', protectRoute, async (req: AuthRequest, res) => {
  try {
    const { skillId } = req.params;
    const userId = req.user.id;

    // 1. Get Skill, verify ownership
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      include: {
        tests: true,
        resume: {
          include: { user: true }
        }
      }
    });

    if (!skill || skill.resume.userId !== userId) {
      return res.status(404).json({ error: 'Skill not found or unauthorized' });
    }

    // 2. Base formulation
    let score = 0;

    // A. Resume Extraction Match (+20)
    score += 20;

    // B. Test Performance (Up to +50)
    if (skill.tests && skill.tests.length > 0) {
      // Take the best test score
      const bestTest = skill.tests.reduce((prev, current) => (prev.score > current.score) ? prev : current);
      const testPercentage = bestTest.totalScore > 0 ? (bestTest.score / bestTest.totalScore) : 0;
      score += Math.round(testPercentage * 50);
    }

    // C. GitHub Analysis (Up to +30)
    let githubScore = 0;
    const githubLink = skill.resume.user.githubLink;
    
    if (githubLink && githubLink.includes('github.com/')) {
      const usernamePath = githubLink.split('github.com/')[1];
      const username = usernamePath.split('/')[0];
      
      try {
        const ghRes = await axios.get(`https://api.github.com/users/${username}`, {
          // If you face rate limits, pass a PAT here. For now, public unauthenticated fetch:
          headers: { 'User-Agent': 'Antigravity-Trust-Score' }
        });
        
        const data = ghRes.data;
        const reposWeight = (data.public_repos || 0) * 2;
        const followersWeight = (data.followers || 0);
        
        // Simple heuristic for demo purposes
        githubScore = Math.min(30, reposWeight + followersWeight);
      } catch (ghErr) {
        console.error('GitHub fetch failed:', ghErr);
      }
    }

    score += githubScore;
    
    // Cap at 100
    score = Math.min(100, score);

    // Save to DB
    const updatedSkill = await prisma.skill.update({
      where: { id: skillId },
      data: { trustScore: score }
    });

    res.json({ trustScore: score, breakdown: { resume: 20, test: score - 20 - githubScore, github: githubScore }, skill: updatedSkill });

  } catch (error) {
    console.error('Trust Score error:', error);
    res.status(500).json({ error: 'Internal server error calculating trust score' });
  }
});

export default router;
