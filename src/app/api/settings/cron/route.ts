import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper function to get setting value
async function getSettingValue(key: string): Promise<string> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key },
    select: { value: true }
  });
  return setting?.value || '';
}

// Helper function to save setting value
async function saveSettingValue(key: string, value: string, category: string = 'system', description?: string) {
  await prisma.systemSettings.upsert({
    where: { key },
    update: { value },
    create: {
      key,
      value,
      type: 'string',
      category,
      description: description || key,
      isActive: true
    }
  });
}

// GET /api/settings/cron - Get cron settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = {
      quotation_reminders_enabled: await getSettingValue('quotation_reminders_enabled'),
      quotation_reminder_days: await getSettingValue('quotation_reminder_days'),
      quotation_reminder_interval_days: await getSettingValue('quotation_reminder_interval_days'),
      invoice_reminders_enabled: await getSettingValue('invoice_reminders_enabled'),
      invoice_reminder_days_after_due: await getSettingValue('invoice_reminder_days_after_due'),
      invoice_reminder_interval_days: await getSettingValue('invoice_reminder_interval_days'),
      daily_task_reminders_enabled: await getSettingValue('daily_task_reminders_enabled'),
      ai_business_report_enabled: await getSettingValue('ai_business_report_enabled'),
      ai_business_report_frequency: await getSettingValue('ai_business_report_frequency'),
      ai_business_report_time: await getSettingValue('ai_business_report_time'),
      ai_business_report_day: await getSettingValue('ai_business_report_day'),
      ai_business_report_recipients: await getSettingValue('ai_business_report_recipients'),
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching cron settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cron settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings/cron - Save cron settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Save all settings
    await Promise.all([
      saveSettingValue('quotation_reminders_enabled', String(body.quotation_reminders_enabled || false), 'cron', 'Enable quotation reminders'),
      saveSettingValue('quotation_reminder_days', String(body.quotation_reminder_days || 7), 'cron', 'Days after creation to start quotation reminders'),
      saveSettingValue('quotation_reminder_interval_days', String(body.quotation_reminder_interval_days || 7), 'cron', 'Days between quotation reminder sends'),
      saveSettingValue('invoice_reminders_enabled', String(body.invoice_reminders_enabled || false), 'cron', 'Enable invoice payment reminders'),
      saveSettingValue('invoice_reminder_days_after_due', String(body.invoice_reminder_days_after_due || 7), 'cron', 'Days after due date to start invoice reminders'),
      saveSettingValue('invoice_reminder_interval_days', String(body.invoice_reminder_interval_days || 7), 'cron', 'Days between invoice reminder sends'),
      saveSettingValue('daily_task_reminders_enabled', String(body.daily_task_reminders_enabled || false), 'cron', 'Enable daily task reminders'),
      saveSettingValue('ai_business_report_enabled', String(body.ai_business_report_enabled || false), 'cron', 'Enable AI business reports'),
      saveSettingValue('ai_business_report_frequency', body.ai_business_report_frequency || 'daily', 'cron', 'Business report frequency'),
      saveSettingValue('ai_business_report_time', body.ai_business_report_time || '08:00', 'cron', 'Business report send time'),
      saveSettingValue('ai_business_report_day', body.ai_business_report_day || 'monday', 'cron', 'Business report day (for weekly)'),
      saveSettingValue('ai_business_report_recipients', body.ai_business_report_recipients || '', 'cron', 'Business report recipients'),
    ]);

    return NextResponse.json({ success: true, message: 'Cron settings saved successfully' });
  } catch (error) {
    console.error('Error saving cron settings:', error);
    return NextResponse.json(
      { error: 'Failed to save cron settings' },
      { status: 500 }
    );
  }
}

