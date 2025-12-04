import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '@prisma/client';
import { paymentReminderService } from '../../services/payment-reminder.service';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

// Get pending payments
router.get('/pending', async (req, res) => {
  try {
    const classId = req.query.classId as string | undefined;
    const daysSinceRegistration = req.query.daysSinceRegistration
      ? parseInt(req.query.daysSinceRegistration as string)
      : undefined;

    const pendingPayments = await paymentReminderService.getPendingPayments({
      classId,
      daysSinceRegistration,
    });

    res.json({
      success: true,
      data: pendingPayments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch pending payments' },
    });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await paymentReminderService.getPendingPaymentStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch statistics' },
    });
  }
});

// Send reminder for a single registration
router.post('/send/:registrationId', async (req, res) => {
  try {
    const { registrationId } = req.params;
    const result = await paymentReminderService.sendReminder(registrationId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to send reminder' },
    });
  }
});

// Send bulk reminders
router.post('/send-bulk', async (req, res) => {
  try {
    const { registrationIds } = req.body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'registrationIds array is required and must not be empty' },
      });
    }

    const result = await paymentReminderService.sendBulkReminders(registrationIds);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to send reminders' },
    });
  }
});

export default router;

