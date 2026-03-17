import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import uploadRoutes from './routes/upload';
import internalRoutes from './routes/internal';
import testRoutes from './routes/tests';
import skillsRoutes from './routes/skills';
import proctoringRoutes from './routes/proctoring';
import path from 'path';

const app = express();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow static files to be served cross-origin
}));

app.use(cors());
app.use(express.json({ limit: '2mb' })); // Increased limit for base64 encoded screenshots

// Basic Input Sanitization Middleware to strip extra spaces or dangerous characters
const sanitizeData = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
     for (let key in req.body) {
        if (typeof req.body[key] === 'string') {
           req.body[key] = req.body[key].trim().replace(/<script.*?>.*?<\/script>/gi, ''); // basic xss remove
        }
     }
  }
  next();
};
app.use(sanitizeData);

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', globalLimiter);

// Specific stricter rate limiting for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 login/register requests
  message: { error: 'Too many authentication attempts, please try again later.' }
});

// Expose static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/proctoring', proctoringRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is running!' });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
