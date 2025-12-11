import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { settingsService } from '../../services/settings.service';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '@prisma/client';
import { emailService } from '../../services/email.service';
import { smsService } from '../../services/sms.service';
import { config } from '../../config/env';

const router = Router();

// Configure multer for file uploads
// Use process.cwd() to get the project root, then navigate to uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', async (req, res) => {
  try {
    const allSettings = await settingsService.getAll();
    console.log('Fetching settings, found keys:', Object.keys(allSettings));
    
    // Remove sensitive fields from response (never send passwords/secret keys to frontend)
    const sensitiveFields = ['smtp_pass', 'deywuro_password', 'paystack_secret_key', 'paystack_webhook_secret'];
    const safeSettings = { ...allSettings };
    
    sensitiveFields.forEach((field) => {
      if (safeSettings[field]) {
        // Replace with a placeholder to indicate it's set, but don't send the actual value
        safeSettings[field] = '***SET***';
      }
    });
    
    res.json({
      success: true,
      data: safeSettings,
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch settings' },
    });
  }
});

router.put('/', async (req, res) => {
  try {
    const { SettingType } = require('@prisma/client');
    const updates = req.body;
    console.log('Received settings update:', updates);

    // Filter out undefined/null values and empty strings for password fields
    // This prevents overwriting existing passwords with empty strings
    const passwordFields = ['smtp_pass', 'deywuro_password', 'paystack_secret_key', 'paystack_webhook_secret'];
    const filteredUpdates = Object.entries(updates).filter(([key, value]) => {
      // Skip password fields if they're empty (to preserve existing values)
      if (passwordFields.includes(key) && (value === '' || value === null || value === undefined)) {
        console.log(`Skipping empty password field: ${key}`);
        return false;
      }
      // For non-password fields, allow empty strings (they might be clearing a value)
      // Only skip undefined and null
      return value !== undefined && value !== null;
    });

    console.log('Filtered updates:', filteredUpdates);

    const settings = filteredUpdates.map(([key, value]) => {
      let type = SettingType.STRING;
      if (typeof value === 'boolean') {
        type = SettingType.BOOL;
      } else if (typeof value === 'number') {
        type = SettingType.NUMBER;
      }
      // Fix logo URL if it has wrong port
      if (key === 'logo_url' && typeof value === 'string' && value.includes('localhost:3004')) {
        value = value.replace('localhost:3004', `localhost:${config.port}`);
        console.log('Fixed logo URL port:', value);
      }
      return { key, value, type };
    });

    console.log('Saving settings to database:', settings.map(s => ({ key: s.key, type: s.type, hasValue: !!s.value })));
    await settingsService.setMultiple(settings);

    // Verify settings were saved
    const savedSettings = await settingsService.getAll();
    console.log('Settings after save:', Object.keys(savedSettings));

    res.json({
      success: true,
      data: { message: 'Settings updated' },
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update settings' },
    });
  }
});

router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    await emailService.sendEmail(
      email,
      'Test Email - Vibe Coding Academy',
      '<p>This is a test email from Vibe Coding Academy.</p>'
    );

    res.json({
      success: true,
      data: { message: 'Test email sent' },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to send test email' },
    });
  }
});

router.post('/test-sms', async (req, res) => {
  try {
    const { phone } = req.body;
    await smsService.sendSms(phone, 'Test SMS from Vibe Coding Academy');

    res.json({
      success: true,
      data: { message: 'Test SMS sent' },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to send test SMS' },
    });
  }
});

// Upload logo file
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    // Generate the URL for the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Construct backend URL - use API domain in production, localhost in development
    let backendUrl: string;
    if (config.nodeEnv === 'production' && config.frontendUrl && !config.frontendUrl.includes('localhost')) {
      // Extract domain from FRONTEND_URL and use api subdomain
      const frontendDomain = config.frontendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (frontendDomain.includes('vibecoding.africa')) {
        backendUrl = `https://api.vibecoding.africa`;
      } else {
        // Fallback: use request host
        const protocol = req.protocol || 'https';
        const host = req.get('host') || `api.${frontendDomain}`;
        backendUrl = `${protocol}://${host}`;
      }
    } else {
      // Development: use request host or localhost
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${config.port}`;
      backendUrl = `${protocol}://${host}`;
    }
    
    const fullUrl = `${backendUrl}${fileUrl}`;

    // Save the logo URL to settings
    const { SettingType } = require('@prisma/client');
    await settingsService.set('logo_url', fullUrl, SettingType.STRING);

    // If there was a previous logo, optionally delete it
    // (For now, we'll keep old logos to avoid breaking references)

    res.json({
      success: true,
      data: {
        url: fullUrl,
        message: 'Logo uploaded successfully',
      },
    });
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to upload logo' },
    });
  }
});

// General image upload for CMS (experts, etc.)
router.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    // Generate the URL for the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Use the backend's configured URL to ensure correct port (3005)
    // This avoids port mismatches when the request comes from the frontend
    const backendUrl = `http://localhost:${config.port}`;
    const fullUrl = `${backendUrl}${fileUrl}`;

    res.json({
      success: true,
      data: {
        url: fullUrl,
        message: 'Image uploaded successfully',
      },
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to upload image' },
    });
  }
});

export default router;

