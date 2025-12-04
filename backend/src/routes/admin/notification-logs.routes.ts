import { Router } from 'express';
import { notificationLogsService } from '../../services/notification-logs.service';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

// Get notification logs with filters
router.get('/', async (req, res) => {
  try {
    const {
      type,
      status,
      toAddress,
      templateKey,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const filters: any = {};

    if (type) {
      filters.type = type as 'EMAIL' | 'SMS';
    }

    if (status) {
      filters.status = status as 'SUCCESS' | 'FAILED';
    }

    if (toAddress) {
      filters.toAddress = toAddress as string;
    }

    if (templateKey) {
      filters.templateKey = templateKey as string;
    }

    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }

    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    if (page) {
      filters.page = parseInt(page as string);
    }

    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    const result = await notificationLogsService.getAll(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching notification logs:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch notification logs' },
    });
  }
});

// Get notification log by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await notificationLogsService.getById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: { message: 'Notification log not found' },
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error('Error fetching notification log:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch notification log' },
    });
  }
});

// Get notification statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await notificationLogsService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch notification stats' },
    });
  }
});

// Resend failed notification
router.post('/:id/resend', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await notificationLogsService.getById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: { message: 'Notification log not found' },
      });
    }

    if (log.status === 'SUCCESS') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot resend a successful notification' },
      });
    }

    // Extract payload data to resend
    const payload = log.payloadJson as any;

    // Resend based on type
    if (log.type === 'EMAIL') {
      // For email, we'd need the subject and html from the template
      // This is a simplified version - in production, you'd want to reconstruct the email
      res.json({
        success: false,
        error: { message: 'Email resend requires template reconstruction. Please use the notification service directly.' },
      });
    } else if (log.type === 'SMS') {
      // For SMS, we can extract the message from payload
      const message = payload?.message || 'Notification message';
      const { smsService } = require('../../services/sms.service');
      await smsService.sendSms(log.toAddress, message);

      res.json({
        success: true,
        data: { message: 'SMS resent successfully' },
      });
    } else {
      res.status(400).json({
        success: false,
        error: { message: 'Unknown notification type' },
      });
    }
  } catch (error: any) {
    console.error('Error resending notification:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to resend notification' },
    });
  }
});

export default router;

