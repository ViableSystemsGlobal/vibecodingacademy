/**
 * Client-side reCAPTCHA utility
 */

export async function isRecaptchaEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/ecommerce/settings');
    if (response.ok) {
      const data = await response.json();
      return data.enableRecaptcha === true;
    }
    return false;
  } catch (error) {
    console.error('Error checking reCAPTCHA setting:', error);
    return false;
  }
}

