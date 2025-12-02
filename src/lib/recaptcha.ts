/**
 * Google reCAPTCHA verification utility
 */

import { prisma } from '@/lib/prisma';

const RECAPTCHA_SECRET_KEY = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;

async function isRecaptchaEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'ECOMMERCE_ENABLE_RECAPTCHA' },
    });
    return setting?.value === 'true';
  } catch (error) {
    console.error('Error checking reCAPTCHA setting:', error);
    return false;
  }
}

export async function verifyRecaptcha(token: string): Promise<boolean> {
  // Check if reCAPTCHA is enabled in settings
  const enabled = await isRecaptchaEnabled();
  if (!enabled) {
    return true; // Skip verification if disabled
  }

  if (!RECAPTCHA_SECRET_KEY) {
    console.warn('⚠️ GOOGLE_RECAPTCHA_SECRET_KEY not set, skipping reCAPTCHA verification');
    return true; // Allow if key not set (for development)
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return false;
  }
}

