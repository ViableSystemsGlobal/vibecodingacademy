import { Router } from 'express';
import { body } from 'express-validator';
import { classService } from '../services/class.service';
import { cmsService } from '../services/cms.service';
import { registrationController } from '../controllers/registration.controller';
import { paymentController } from '../controllers/payment.controller';
import { validate } from '../middleware/validate';
import { registrationLimiter } from '../middleware/rate-limit';
import { ClassStatus } from '@prisma/client';
import { settingsService } from '../services/settings.service';

const router = Router();

// Public settings (logo, site name, etc.)
router.get('/settings', async (req, res) => {
  try {
    const allSettings = await settingsService.getAll();
    // Only return public-facing settings
    const publicSettings = {
      logo_url: allSettings.logo_url || null,
      site_name: allSettings.site_name || null,
    };

    res.json({
      success: true,
      data: publicSettings,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch settings' },
    });
  }
});

// Public landing page data
router.get('/landing', async (req, res) => {
  try {
    const [hero, faq, testimonials, experts, classes, publicSettings] = await Promise.all([
      cmsService.getBlock('hero'),
      cmsService.getBlock('faq'),
      cmsService.getBlock('testimonials'),
      cmsService.getBlock('experts'),
      classService.getAll(
        { status: ClassStatus.PUBLISHED },
        1,
        6
      ),
      settingsService.getAll().then(settings => ({
        logo_url: settings.logo_url || null,
        site_name: settings.site_name || null,
      })),
    ]);

    res.json({
      success: true,
      data: {
        hero: hero?.content || null,
        faq: faq?.content || null,
        testimonials: testimonials?.content || null,
        experts: experts?.content || null,
        featuredClasses: classes.classes,
        settings: publicSettings,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch landing data' },
    });
  }
});

// Public classes listing
router.get('/classes', async (req, res) => {
  try {
    const type = req.query.type as 'FREE' | 'BOOTCAMP' | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await classService.getAll(
      { type, status: ClassStatus.PUBLISHED },
      page,
      limit
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch classes' },
    });
  }
});

// Public class detail
router.get('/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const classItem = await classService.getById(id);

    if (classItem.status !== ClassStatus.PUBLISHED) {
      return res.status(404).json({
        success: false,
        error: { message: 'Class not found' },
      });
    }

    res.json({
      success: true,
      data: classItem,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: { message: error.message || 'Class not found' },
    });
  }
});

// Public registration (for free classes only - no payment required)
router.post(
  '/register',
  registrationLimiter, // Apply rate limiting to registrations
  validate([
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('parentName').trim().notEmpty().withMessage('Parent name is required'),
    body('parentEmail').isEmail().normalizeEmail(),
    body('students').isArray({ min: 1 }).withMessage('At least one student is required'),
    body('students.*.name').trim().notEmpty().withMessage('Student name is required'),
  ]),
  registrationController.create.bind(registrationController)
);

// Public payment attempt creation (for bootcamp checkout)
router.post(
  '/payment-attempts/create',
  validate([
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('parentName').trim().notEmpty().withMessage('Parent name is required'),
    body('parentEmail').isEmail().normalizeEmail(),
    body('students').isArray({ min: 1 }).withMessage('At least one student is required'),
    body('students.*.name').trim().notEmpty().withMessage('Student name is required'),
    body('amountCents').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  ]),
  paymentController.createPaymentAttempt.bind(paymentController)
);

// Public payment creation (for payment attempt)
router.post(
  '/payments/create',
  validate([
    body('paymentAttemptId').notEmpty().withMessage('Payment Attempt ID is required'),
  ]),
  paymentController.createPaymentFromAttempt.bind(paymentController)
);

// Public payment verification (callback from Paystack)
router.get('/payments/verify', paymentController.verify.bind(paymentController));

export default router;
