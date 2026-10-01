import { Router } from 'express';
import { storageService } from '../config/storage';

const router = Router();

router.get('/file', (req, res) => {
  try {
    const rawKey = (req.query.key as string) || '';
    if (!rawKey) {
      return res.status(400).json({ error: 'File key required' });
    }

    const cleanKey = rawKey.replace(/^\/?uploads\//, '').replace(/^\/+/, '');
    const stream = storageService.getFileStream(cleanKey);

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    stream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
