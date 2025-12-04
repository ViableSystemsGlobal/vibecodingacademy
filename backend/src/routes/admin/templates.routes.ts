import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import prisma from '../../config/database';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

// Email Templates
router.get('/email', async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch email templates' },
    });
  }
});

router.get('/email/:key', async (req, res) => {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { key: req.params.key },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: { message: 'Email template not found' },
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch email template' },
    });
  }
});

router.post(
  '/email',
  validate([
    body('key').trim().notEmpty(),
    body('subject').trim().notEmpty(),
    body('htmlBody').trim().notEmpty(),
  ]),
  async (req, res) => {
    try {
      const template = await prisma.emailTemplate.create({
        data: {
          key: req.body.key,
          subject: req.body.subject,
          htmlBody: req.body.htmlBody,
          isActive: req.body.isActive !== false,
        },
      });

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: { message: 'Template key already exists' },
        });
      }
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create email template' },
      });
    }
  }
);

router.put(
  '/email/:key',
  validate([body('subject').trim().notEmpty(), body('htmlBody').trim().notEmpty()]),
  async (req, res) => {
    try {
      const template = await prisma.emailTemplate.update({
        where: { key: req.params.key },
        data: {
          subject: req.body.subject,
          htmlBody: req.body.htmlBody,
          isActive: req.body.isActive,
        },
      });

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: { message: 'Email template not found' },
        });
      }
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update email template' },
      });
    }
  }
);

router.delete('/email/:key', async (req, res) => {
  try {
    await prisma.emailTemplate.delete({
      where: { key: req.params.key },
    });

    res.json({
      success: true,
      data: { message: 'Email template deleted' },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { message: 'Email template not found' },
      });
    }
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to delete email template' },
    });
  }
});

// SMS Templates
router.get('/sms', async (req, res) => {
  try {
    const templates = await prisma.smsTemplate.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch SMS templates' },
    });
  }
});

router.get('/sms/:key', async (req, res) => {
  try {
    const template = await prisma.smsTemplate.findUnique({
      where: { key: req.params.key },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: { message: 'SMS template not found' },
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch SMS template' },
    });
  }
});

router.post(
  '/sms',
  validate([body('key').trim().notEmpty(), body('content').trim().notEmpty()]),
  async (req, res) => {
    try {
      const template = await prisma.smsTemplate.create({
        data: {
          key: req.body.key,
          content: req.body.content,
          isActive: req.body.isActive !== false,
        },
      });

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: { message: 'Template key already exists' },
        });
      }
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create SMS template' },
      });
    }
  }
);

router.put(
  '/sms/:key',
  validate([body('content').trim().notEmpty()]),
  async (req, res) => {
    try {
      const template = await prisma.smsTemplate.update({
        where: { key: req.params.key },
        data: {
          content: req.body.content,
          isActive: req.body.isActive,
        },
      });

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: { message: 'SMS template not found' },
        });
      }
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update SMS template' },
      });
    }
  }
);

router.delete('/sms/:key', async (req, res) => {
  try {
    await prisma.smsTemplate.delete({
      where: { key: req.params.key },
    });

    res.json({
      success: true,
      data: { message: 'SMS template deleted' },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { message: 'SMS template not found' },
      });
    }
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to delete SMS template' },
    });
  }
});

export default router;

