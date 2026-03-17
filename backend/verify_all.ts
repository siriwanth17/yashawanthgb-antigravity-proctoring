// verify_all.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'newuser@example.com';
  console.log(`Verifying all skills for user with email: ${email}`);
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: { resume: { include: { skills: true } } }
  });

  if (!user) {
    console.error('User not found.');
    return;
  }

  const resume = user.resume;
  if (!resume || !resume.skills || resume.skills.length === 0) {
    console.error('User has no resume or no extracted skills.');
    return;
  }

  const skills = resume.skills;
  console.log(`Found ${skills.length} skills. Verifying...`);

  for (const skill of skills) {
    // Check if test exists and passed already
    let existingTest = await prisma.skillTest.findFirst({
        where: { userId: user.id, skillId: skill.id, passed: true }
    });
    
    if (existingTest) {
        console.log(`Skill "${skill.name}" is already verified.`);
        continue;
    }

    // Create a 100% Mock Test
    await prisma.skillTest.create({
      data: {
        userId: user.id,
        skillId: skill.id,
        score: 8,
        totalScore: 8,
        passed: true,
        status: "PASSED",
      }
    });

    // Mark skill verified
    await prisma.skill.update({
      where: { id: skill.id },
      data: { verified: true }
    });
    console.log(`✅ Passed test and verified skill: "${skill.name}"`);
  }

  console.log('Done verifying all skills.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
