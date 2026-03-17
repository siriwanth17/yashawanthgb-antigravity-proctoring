import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, protectRoute } from '../middlewares/authHandler';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, education, careerInterest, githubLink, codingProfiles } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: { 
        name, 
        email, 
        passwordHash, 
        education, 
        careerInterest, 
        githubLink, 
        codingProfiles 
      }
    });

    const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ 
      token, 
      user: { id: newUser.id, name: newUser.name, email: newUser.email } 
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ 
      token, 
      user: { id: user.id, name: user.name, email: user.email } 
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// GET PROFILE (Protected Route)
router.get('/profile', protectRoute, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, education: true, careerInterest: true, githubLink: true, codingProfiles: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
