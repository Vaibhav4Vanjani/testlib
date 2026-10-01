import fs from 'fs';
import path from 'path';
import { env } from './env';
import { logger } from './logger';

export interface IStorageService {
  uploadFile(file: Express.Multer.File, relativePath: string): Promise<string>;
  getFileStream(fileKey: string): fs.ReadStream;
  deleteFile(fileKey: string): Promise<void>;
  getFileUrl(fileKey: string): string;
}

class LocalStorageProvider implements IStorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, relativePath: string): Promise<string> {
    const targetDir = path.join(this.baseDir, relativePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = `${Date.now()}_${path.basename(file.originalname).replace(/\s+/g, '_')}`;
    const fullPath = path.join(targetDir, fileName);

    await fs.promises.writeFile(fullPath, file.buffer);
    
    // Normalized fileKey stored in DB
    const fileKey = path.join(relativePath, fileName).replace(/\\/g, '/');
    logger.info(`File uploaded locally: ${fileKey}`);
    return fileKey;
  }

  getFileStream(fileKey: string): fs.ReadStream {
    const fullPath = path.join(this.baseDir, fileKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(fullPath);
  }

  async deleteFile(fileKey: string): Promise<void> {
    const fullPath = path.join(this.baseDir, fileKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      logger.info(`File deleted locally: ${fileKey}`);
    }
  }

  getFileUrl(fileKey: string): string {
    if (!fileKey) return '';
    const cleanKey = fileKey.replace(/^\/+/, '');
    if (cleanKey.startsWith('uploads/')) {
      return `/${cleanKey}`;
    }
    return `/uploads/${cleanKey}`;
  }
}

export const storageService: IStorageService = new LocalStorageProvider();
