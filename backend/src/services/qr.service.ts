import crypto from 'crypto';
import { Library } from '../models/library.model';
import { ValidationError, NotFoundError } from '../utils/customErrors';
import { logger } from '../config/logger';

export interface IQRPayload {
  libraryId: string;
  timestamp: number;
  nonce: string;
  expiry: number;
  signature: string;
}

export class QRService {
  /**
   * Generates a signed dynamic QR code payload for a given library (Admin screen view)
   * Valid for 24 hours (86,400,000 milliseconds) for daily desk display.
   */
  static async generateDynamicQRPayload(libraryId: string): Promise<IQRPayload> {
    const library = await Library.findById(libraryId);
    if (!library || !library.isActive) {
      throw new NotFoundError('Library not found or inactive');
    }

    const timestamp = Date.now();
    const expiry = timestamp + 24 * 60 * 60 * 1000; // Valid for 24 hours (1 Day)
    const nonce = crypto.randomBytes(16).toString('hex');

    const dataToSign = `${libraryId}:${timestamp}:${nonce}:${expiry}`;
    const signature = crypto
      .createHmac('sha256', library.qrSecretKey)
      .update(dataToSign)
      .digest('hex');

    return {
      libraryId,
      timestamp,
      nonce,
      expiry,
      signature,
    };
  }

  /**
   * Validates dynamic QR code payload scanned by student app
   */
  static async validateQRPayload(payload: IQRPayload): Promise<{ libraryId: string; nonce: string }> {
    const { libraryId, timestamp, nonce, expiry, signature } = payload;

    if (!libraryId || !timestamp || !nonce || !expiry || !signature) {
      throw new ValidationError('Invalid or corrupted QR payload format');
    }

    const now = Date.now();

    // 1. Time Expiration Check (24-hour daily TTL)
    if (now > expiry) {
      throw new ValidationError('Daily QR code has expired. Please scan the current code on display at reception.', 'QR_EXPIRED');
    }

    // 2. Fetch Library Secret
    const library = await Library.findById(libraryId);
    if (!library || !library.isActive) {
      throw new NotFoundError('Target library is inactive or invalid');
    }

    // 3. Re-calculate & Verify HMAC Signature
    const dataToSign = `${libraryId}:${timestamp}:${nonce}:${expiry}`;
    const expectedSignature = crypto
      .createHmac('sha256', library.qrSecretKey)
      .update(dataToSign)
      .digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)) === false) {
      throw new ValidationError('QR code signature verification failed', 'QR_SIGNATURE_MISMATCH');
    }

    return { libraryId, nonce };
  }
}
