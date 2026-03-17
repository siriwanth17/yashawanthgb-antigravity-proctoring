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

// Enhanced CORS configuration for ngrok and cross-origin access
app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins during development (necessary for ngrok tunneling)
    // In production, you would specify allowed origins
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400 // 24 hours
}));

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

// Debug Logging Middleware - Log all API requests
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', { ...req.body, password: req.body.password ? '***' : undefined });
  }
  if (req.headers.authorization) {
    console.log('Authorization header present:', 'Bearer [TOKEN]');
  }
  next();
});

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
  res.json({ status: 'ok', message: 'Backend API is running!', port: PORT, timestamp: new Date().toISOString() });
});

// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err.message || err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
  console.log(`✅ CORS enabled for all origins (ngrok compatible)`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});
