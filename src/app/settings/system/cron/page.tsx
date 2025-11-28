"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/contexts/toast-context";
import { Clock, Mail, FileText, DollarSign, CheckSquare, Activity } from "lucide-react";

interface CronSettings {
  // Quotation Reminders
  quotation_reminders_enabled: boolean;
  quotation_reminder_days: number;
  quotation_reminder_interval_days: number;

  // Invoice Reminders
  invoice_reminders_enabled: boolean;
  invoice_reminder_days_after_due: number;
  invoice_reminder_interval_days: number;

  // Daily Task Reminders
  daily_task_reminders_enabled: boolean;

  // Business Reports (already exists, but we'll show it)
  ai_business_report_enabled: boolean;
  ai_business_report_frequency: string;
  ai_business_report_time: string;
  ai_business_report_day: string;
  ai_business_report_recipients: string;
}

const defaultSettings: CronSettings = {
  quotation_reminders_enabled: false,
  quotation_reminder_days: 7,
  quotation_reminder_interval_days: 7,
  invoice_reminders_enabled: false,
  invoice_reminder_days_after_due: 7,
  invoice_reminder_interval_days: 7,
  daily_task_reminders_enabled: false,
  ai_business_report_enabled: false,
  ai_business_report_frequency: 'daily',
  ai_business_report_time: '08:00',
  ai_business_report_day: 'monday',
  ai_business_report_recipients: '',
};

export default function CronSettingsPage() {
  const { success, error: showError } = useToast();
  const [settings, setSettings] = useState<CronSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/cron', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load cron settings');
      }
      const data = await response.json();
      setSettings({
        quotation_reminders_enabled: data.quotation_reminders_enabled === 'true',
        quotation_reminder_days: parseInt(data.quotation_reminder_days || '7', 10),
        quotation_reminder_interval_days: parseInt(data.quotation_reminder_interval_days || '7', 10),
        invoice_reminders_enabled: data.invoice_reminders_enabled === 'true',
        invoice_reminder_days_after_due: parseInt(data.invoice_reminder_days_after_due || '7', 10),
        invoice_reminder_interval_days: parseInt(data.invoice_reminder_interval_days || '7', 10),
        daily_task_reminders_enabled: data.daily_task_reminders_enabled === 'true',
        ai_business_report_enabled: data.ai_business_report_enabled === 'true',
        ai_business_report_frequency: data.ai_business_report_frequency || 'daily',
        ai_business_report_time: data.ai_business_report_time || '08:00',
        ai_business_report_day: data.ai_business_report_day || 'monday',
        ai_business_report_recipients: data.ai_business_report_recipients || '',
      });
    } catch (err) {
      console.error('Error loading cron settings:', err);
      showError('Failed to load cron settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings/cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save cron settings');
      }

      success('Cron settings saved successfully');
    } catch (err) {
      console.error('Error saving cron settings:', err);
      showError('Failed to save cron settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof CronSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cron Jobs & Reminders</h1>
          <p className="text-gray-600">Configure automated reminders and scheduled tasks</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">Loading settings...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cron Jobs & Reminders</h1>
        <p className="text-gray-600">Configure automated reminders and scheduled tasks</p>
      </div>

      {/* CRON_SECRET Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            CRON_SECRET Configuration
          </CardTitle>
          <CardDescription>
            Set this environment variable to secure your cron job endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-white p-4 border border-blue-200">
            <p className="text-sm font-medium text-gray-900 mb-2">How to set CRON_SECRET:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Generate a secure random string (e.g., use: <code className="bg-gray-100 px-1 rounded">openssl rand -hex 32</code>)</li>
              <li>Add it to your <code className="bg-gray-100 px-1 rounded">.env</code> file: <code className="bg-gray-100 px-1 rounded">CRON_SECRET=your_secret_here</code></li>
              <li>In your cron job commands, use: <code className="bg-gray-100 px-1 rounded">-H "Authorization: Bearer YOUR_CRON_SECRET"</code></li>
              <li>Restart your server after adding the environment variable</li>
            </ol>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> If CRON_SECRET is not set, cron endpoints will accept requests without authentication (not recommended for production).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quotation Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            Quotation Reminders
          </CardTitle>
          <CardDescription>
            Automatically send reminders for quotations that haven't been won
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="quotation-reminders-enabled">Enable Quotation Reminders</Label>
              <p className="text-sm text-gray-500">Send reminders for quotations with status: DRAFT, SENT, REJECTED, or EXPIRED</p>
            </div>
            <Switch
              id="quotation-reminders-enabled"
              checked={settings.quotation_reminders_enabled}
              onCheckedChange={(checked) => updateSetting('quotation_reminders_enabled', checked)}
            />
          </div>

          {settings.quotation_reminders_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-indigo-200">
              <div className="space-y-2">
                <Label htmlFor="quotation-reminder-days">Days After Creation</Label>
                <Input
                  id="quotation-reminder-days"
                  type="number"
                  min="1"
                  value={settings.quotation_reminder_days}
                  onChange={(e) => updateSetting('quotation_reminder_days', parseInt(e.target.value, 10))}
                />
                <p className="text-xs text-gray-500">Start sending reminders X days after quotation creation</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quotation-reminder-interval">Reminder Interval (Days)</Label>
                <Input
                  id="quotation-reminder-interval"
                  type="number"
                  min="1"
                  value={settings.quotation_reminder_interval_days}
                  onChange={(e) => updateSetting('quotation_reminder_interval_days', parseInt(e.target.value, 10))}
                />
                <p className="text-xs text-gray-500">Days between reminder sends</p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
                <p className="font-semibold mb-2">Cron Setup:</p>
                <code className="block bg-white p-2 rounded border">
                  0 9 * * * curl -X POST https://your-domain.com/api/cron/quotation-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
                </code>
                <p className="mt-2">Recommended: Daily at 9 AM</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Invoice Payment Reminders
          </CardTitle>
          <CardDescription>
            Automatically send payment reminders for unpaid or partially paid invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="invoice-reminders-enabled">Enable Invoice Reminders</Label>
              <p className="text-sm text-gray-500">Send reminders for invoices with payment status: UNPAID or PARTIALLY_PAID</p>
            </div>
            <Switch
              id="invoice-reminders-enabled"
              checked={settings.invoice_reminders_enabled}
              onCheckedChange={(checked) => updateSetting('invoice_reminders_enabled', checked)}
            />
          </div>

          {settings.invoice_reminders_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-green-200">
              <div className="space-y-2">
                <Label htmlFor="invoice-reminder-days">Days After Due Date</Label>
                <Input
                  id="invoice-reminder-days"
                  type="number"
                  min="0"
                  value={settings.invoice_reminder_days_after_due}
                  onChange={(e) => updateSetting('invoice_reminder_days_after_due', parseInt(e.target.value, 10))}
                />
                <p className="text-xs text-gray-500">Start sending reminders X days after invoice due date (0 = on due date)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-reminder-interval">Reminder Interval (Days)</Label>
                <Input
                  id="invoice-reminder-interval"
                  type="number"
                  min="1"
                  value={settings.invoice_reminder_interval_days}
                  onChange={(e) => updateSetting('invoice_reminder_interval_days', parseInt(e.target.value, 10))}
                />
                <p className="text-xs text-gray-500">Days between reminder sends</p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
                <p className="font-semibold mb-2">Cron Setup:</p>
                <code className="block bg-white p-2 rounded border">
                  0 10 * * * curl -X POST https://your-domain.com/api/cron/invoice-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
                </code>
                <p className="mt-2">Recommended: Daily at 10 AM</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Task Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-purple-500" />
            Daily Task Reminders
          </CardTitle>
          <CardDescription>
            Send daily reminders to users about their incomplete tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="daily-task-reminders-enabled">Enable Daily Task Reminders</Label>
              <p className="text-sm text-gray-500">Send daily email/SMS to users with their incomplete tasks (PENDING or IN_PROGRESS)</p>
            </div>
            <Switch
              id="daily-task-reminders-enabled"
              checked={settings.daily_task_reminders_enabled}
              onCheckedChange={(checked) => updateSetting('daily_task_reminders_enabled', checked)}
            />
          </div>

          {settings.daily_task_reminders_enabled && (
            <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
              <p className="font-semibold mb-2">Cron Setup:</p>
              <code className="block bg-white p-2 rounded border">
                0 8 * * * curl -X POST https://your-domain.com/api/cron/daily-task-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
              </code>
              <p className="mt-2">Recommended: Daily at 8 AM</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            AI Business Reports
          </CardTitle>
          <CardDescription>
            Automated daily, weekly, or monthly business reports from the AI analyst
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="business-report-enabled">Enable Business Reports</Label>
              <p className="text-sm text-gray-500">Send automated business reports via email</p>
            </div>
            <Switch
              id="business-report-enabled"
              checked={settings.ai_business_report_enabled}
              onCheckedChange={(checked) => updateSetting('ai_business_report_enabled', checked)}
            />
          </div>

          {settings.ai_business_report_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-blue-200">
              <div className="space-y-2">
                <Label htmlFor="report-frequency">Frequency</Label>
                <select
                  id="report-frequency"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={settings.ai_business_report_frequency}
                  onChange={(e) => updateSetting('ai_business_report_frequency', e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-time">Send Time</Label>
                <Input
                  id="report-time"
                  type="time"
                  value={settings.ai_business_report_time}
                  onChange={(e) => updateSetting('ai_business_report_time', e.target.value)}
                />
              </div>

              {settings.ai_business_report_frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label htmlFor="report-day">Day of Week</Label>
                  <select
                    id="report-day"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    value={settings.ai_business_report_day}
                    onChange={(e) => updateSetting('ai_business_report_day', e.target.value)}
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="report-recipients">Recipients (Email addresses, comma-separated)</Label>
                <Input
                  id="report-recipients"
                  type="text"
                  placeholder="admin@example.com, manager@example.com"
                  value={settings.ai_business_report_recipients}
                  onChange={(e) => updateSetting('ai_business_report_recipients', e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
                <p className="font-semibold mb-2">Cron Setup:</p>
                <code className="block bg-white p-2 rounded border">
                  0 8 * * * curl -X POST https://your-domain.com/api/cron/business-report -H "Authorization: Bearer YOUR_CRON_SECRET"
                </code>
                <p className="mt-2">Recommended: Daily at 8 AM (the endpoint handles frequency internally)</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

