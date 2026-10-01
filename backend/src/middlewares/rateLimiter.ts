import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/apiResponse';
import { env } from '../config/env';

const isDevelopment = () => env.NODE_ENV === 'development' || process.env.NODE_ENV === 'development';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment(),
  handler: (_req, res) => {
    return ApiResponse.error(res, 'Too many requests from this IP, please try again after 15 minutes.', 429, 'RATE_LIMIT_EXCEEDED');
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // Limit login attempts to 15 per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment(),
  handler: (_req, res) => {
    return ApiResponse.error(res, 'Too many authentication attempts. Account temporarily throttled.', 429, 'AUTH_RATE_LIMIT');
  },
});

export const qrScanRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 QR scan requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment(),
  handler: (_req, res) => {
    return ApiResponse.error(res, 'QR scan rate limit exceeded.', 429, 'QR_RATE_LIMIT');
  },
});

