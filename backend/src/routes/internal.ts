import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Internal webhook for Python AI
router.post('/save-skills', async (req, res) => {
  const { resumeId, status, skills } = req.body;

  try {
    // 1. Update Resume Status
    await prisma.resume.update({
      where: { id: resumeId },
      data: { status }
    });

    // 2. Insert detected skills into the database
    if (skills && Array.isArray(skills) && skills.length > 0) {
      
      const skillsData = skills.map((skillName: string) => ({
        resumeId,
        name: skillName,
        verified: false 
      }));

      // In Prisma SQLite, createMany is supported but skipDuplicates may be restricted. 
      // Manually creating to be safe or using createMany if using PG later.
      for (const sk of skillsData) {
         try {
             await prisma.skill.create({ data: sk });
         } catch(e) { /* Ignore unique constraint duplicates if any */ }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to save AI skills:", error);
    res.status(500).json({ error: "Internal db error" });
  }
});

export default router;
