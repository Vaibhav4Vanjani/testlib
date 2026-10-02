import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const defaultUploadDir = process.env.UPLOAD_DIR || process.env.LOCAL_UPLOAD_DIR || './public/uploads';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().default(defaultUploadDir),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000,http://localhost:8081'),
});

const _env = envSchema.safeParse({
  ...process.env,
  LOCAL_UPLOAD_DIR: process.env.UPLOAD_DIR || process.env.LOCAL_UPLOAD_DIR || defaultUploadDir,
});

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

