import cron from 'node-cron';
import { AttendanceSession } from '../models/attendanceSession.model';
import { StudentProfile } from '../models/studentProfile.model';
import { AttendanceStatus } from '../constants/statusEnums';
import { logger } from '../config/logger';

export class AutoCheckoutService {
  private static isRunning = false;

  /**
   * Executes automatic daily checkout for all currently active student attendance sessions.
   * Scalable for 200-300+ libraries via batch/chunk processing.
   * Idempotent & fault-tolerant per session.
   */
  static async executeDailyCheckout(customCutoffDate?: Date): Promise<{
    processedCount: number;
    successCount: number;
    failedCount: number;
    durationMs: number;
  }> {
    if (this.isRunning) {
      logger.warn('[AutoCheckoutJob] Job already running. Skipping concurrent execution.');
      return { processedCount: 0, successCount: 0, failedCount: 0, durationMs: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const checkoutTime = customCutoffDate || new Date();

    logger.info(`[AutoCheckoutJob] 🕒 Starting daily auto-checkout process at ${checkoutTime.toISOString()}`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const BATCH_SIZE = 100;

    try {
      // Chunk processing loop for 200-300+ libraries
      let hasMore = true;

      while (hasMore) {
        const activeBatch = await AttendanceSession.find({
          status: AttendanceStatus.ACTIVE,
        })
          .sort({ checkInAt: 1 })
          .limit(BATCH_SIZE)
          .lean();

        if (activeBatch.length === 0) {
          hasMore = false;
          break;
        }

        logger.info(`[AutoCheckoutJob] Processing batch of ${activeBatch.length} active sessions...`);

        for (const session of activeBatch) {
          processedCount++;
          try {
            const checkInTime = new Date(session.checkInAt).getTime();
            const checkOutTimeMs = checkoutTime.getTime();
            const durationMinutes = Math.max(1, Math.round((checkOutTimeMs - checkInTime) / (1000 * 60)));

            // Idempotent atomic update: only update if STILL ACTIVE
            const updated = await AttendanceSession.findOneAndUpdate(
              {
                _id: session._id,
                status: AttendanceStatus.ACTIVE,
              },
              {
                $set: {
                  status: AttendanceStatus.COMPLETED,
                  checkOutAt: checkoutTime,
                  durationMinutes,
                  isAutoCheckedOut: true,
                },
              },
              { new: true }
            );

            if (updated) {
              successCount++;

              // Update student monthly stats safely
              const currentMonthStr = checkoutTime.toISOString().slice(0, 7);
              try {
                const student = await StudentProfile.findById(session.studentId);
                if (student) {
                  if (student.monthlyStats?.lastCalculatedMonth === currentMonthStr) {
                    student.monthlyStats.totalStudyMinutes += durationMinutes;
                  } else {
                    student.monthlyStats = {
                      totalStudyMinutes: durationMinutes,
                      lastCalculatedMonth: currentMonthStr,
                    };
                  }
                  await student.save();
                }
              } catch (statErr: any) {
                logger.error(`[AutoCheckoutJob] Failed to update monthlyStats for student ${session.studentId}: ${statErr.message}`);
              }
            }
          } catch (sessionErr: any) {
            failedCount++;
            logger.error(`[AutoCheckoutJob] Error checking out session ${session._id}: ${sessionErr.message}`);
          }
        }

        if (activeBatch.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        `[AutoCheckoutJob] ✅ Daily auto-checkout completed in ${durationMs}ms. Processed: ${processedCount}, Success: ${successCount}, Failures: ${failedCount}`
      );

      return { processedCount, successCount, failedCount, durationMs };
    } catch (err: any) {
      logger.error(`[AutoCheckoutJob] ❌ Unhandled error in auto-checkout job: ${err.message}`, { stack: err.stack });
      return { processedCount, successCount, failedCount, durationMs: Date.now() - startTime };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Initializes the scheduled background cron job.
   * Runs at 12:00 AM (00:00) every night in Asia/Kolkata (IST).
   */
  static initScheduledCron(): any {
    logger.info('[AutoCheckoutJob] ⏰ Initializing scheduled cron worker (Runs daily at 12:00 AM IST)');

    // Immediate check on startup for any leftover active sessions and purge past logs
    AutoCheckoutService.executeDailyCheckout()
      .then(async () => {
        const { AttendanceService } = await import('./attendance.service');
        await AttendanceService.purgePastAttendanceLogs();
      })
      .catch((err) => {
        logger.error(`[AutoCheckoutJob] Startup auto-checkout/purge check failed: ${err.message}`);
      });

    return cron.schedule(
      '0 0 * * *',
      async () => {
        logger.info('[AutoCheckoutJob] Triggering midnight auto-checkout & log cleanup cron job...');
        await AutoCheckoutService.executeDailyCheckout();
        const { AttendanceService } = await import('./attendance.service');
        await AttendanceService.purgePastAttendanceLogs();
      },
      {
        timezone: process.env.TZ || 'Asia/Kolkata',
      }
    );
  }
}
