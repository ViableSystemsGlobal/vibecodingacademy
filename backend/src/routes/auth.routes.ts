import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter, passwordResetLimiter } from '../middleware/rate-limit';

const router = Router();

router.post(
  '/login',
  authLimiter, // Apply rate limiting to login
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login.bind(authController)
);

router.post(
  '/register-admin',
  validate([
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ]),
  authController.registerAdmin.bind(authController)
);

router.post(
  '/forgot-password',
  passwordResetLimiter, // Apply rate limiting to password reset
  validate([body('email').isEmail().normalizeEmail()]),
  authController.forgotPassword.bind(authController)
);

router.post(
  '/reset-password',
  passwordResetLimiter, // Apply rate limiting to password reset
  validate([
    body('token').notEmpty().withMessage('Token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ]),
  authController.resetPassword.bind(authController)
);

router.get(
  '/me',
  authenticate,
  authController.getMe.bind(authController)
);

export default router;

