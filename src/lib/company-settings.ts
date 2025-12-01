import { prisma } from '@/lib/prisma';

/**
 * Get company name from settings
 * Falls back to 'AdPools Group' if not found
 */
export async function getCompanyName(): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'company_name' }
    });
    
    return setting?.value || 'AdPools Group';
  } catch (error) {
    console.error('Error fetching company name:', error);
    return 'AdPools Group';
  }
}

/**
 * Get company name from SystemSettings table (alternative method)
 * Falls back to 'AdPools Group' if not found
 */
export async function getCompanyNameFromSystemSettings(): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'company_name' }
    });
    
    return setting?.value || 'AdPools Group';
  } catch (error) {
    console.error('Error fetching company name from system settings:', error);
    return 'AdPools Group';
  }
}

/**
 * Get SMTP from name with company name
 * Uses company name from settings as the sender name
 */
export async function getSMTPFromName(): Promise<string> {
  try {
    // First try to get from SystemSettings
    const systemSetting = await prisma.systemSettings.findUnique({
      where: { key: 'SMTP_FROM_NAME' }
    });
    
    if (systemSetting?.value) {
      return systemSetting.value;
    }
    
    // If not found, use company name
    const companyName = await getCompanyNameFromSystemSettings();
    return companyName;
  } catch (error) {
    console.error('Error fetching SMTP from name:', error);
    return 'AdPools Group';
  }
}
