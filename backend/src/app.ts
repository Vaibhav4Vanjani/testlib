import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';
import path from 'path';

const app = express();

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS Whitelist
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Global Rate Limiting
app.use(globalRateLimiter);

// Payload Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static local file serving (secured route handled in storage service)
const resolvedUploadDir = path.isAbsolute(env.LOCAL_UPLOAD_DIR)
  ? env.LOCAL_UPLOAD_DIR
  : path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);

app.use('/uploads', express.static(path.resolve(process.cwd(), 'public/uploads')));
app.use('/uploads', express.static(resolvedUploadDir));

// Direct Health Check endpoints for load balancers / Nginx
app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount API v1 Routes
app.use('/api/v1', routes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource or endpoint does not exist',
    },
  });
});

// Centralized Error Middleware
app.use(errorHandler);

export default app;
