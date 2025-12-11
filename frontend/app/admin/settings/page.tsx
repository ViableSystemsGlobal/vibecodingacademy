'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Settings, Mail, MessageSquare, Save, Send, Upload, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';

interface AppSettings {
  [key: string]: string | number | boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>({});
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const { data, isLoading, refetch } = useQuery<AppSettings>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const result = await apiClient.get<AppSettings>('/admin/settings');
      console.log('Fetched settings:', result);
      return result;
    },
  });

  // Update settings state when data changes
  useEffect(() => {
    if (data) {
      console.log('Updating settings state with data:', data);
      // Replace '***SET***' placeholders with empty strings for password fields
      const processedData = { ...data };
      const passwordFields = ['smtp_pass', 'deywuro_password', 'paystack_secret_key', 'paystack_webhook_secret'];
      passwordFields.forEach((field) => {
        if (processedData[field] === '***SET***') {
          processedData[field] = '';
        }
      });
      setSettings(processedData);
    }
  }, [data]);

  const updateSettingsMutation = useMutation({
    mutationFn: (updates: AppSettings) => {
      // Filter out empty password fields to avoid overwriting existing passwords
      const filteredUpdates = { ...updates };
      const passwordFields = ['smtp_pass', 'deywuro_password', 'paystack_secret_key', 'paystack_webhook_secret'];
      passwordFields.forEach((field) => {
        if (filteredUpdates[field] === '' || filteredUpdates[field] === null || filteredUpdates[field] === undefined) {
          delete filteredUpdates[field];
        }
      });
      console.log('Saving settings:', filteredUpdates);
      return apiClient.put('/admin/settings', filteredUpdates);
    },
    onSuccess: async () => {
      console.log('Settings saved, refetching...');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      // Refetch settings to update the UI
      const newData = await refetch();
      console.log('Refetched settings:', newData.data);
      if (newData.data) {
        setSettings(newData.data);
      }
      toast.success('Settings saved successfully!');
    },
    onError: (error: any) => {
      console.error('Settings update error:', error);
      // If 401, the token might be expired - user should re-login
      if (error.message?.includes('401') || error.message?.includes('token') || error.message?.includes('Unauthorized')) {
        toast.error('Your session has expired. Please log out and log back in.');
        // Clear any stale tokens
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
        }
      } else {
        toast.error(error.message || 'Failed to save settings');
      }
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: (email: string) => apiClient.post('/admin/settings/test-email', { email }),
    onSuccess: () => {
      toast.success('Test email sent successfully! Check your inbox.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send test email');
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: (phone: string) => apiClient.post('/admin/settings/test-sms', { phone }),
    onSuccess: () => {
      toast.success('Test SMS sent successfully! Check your phone.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send test SMS');
    },
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    console.log('Saving settings from state:', settings);
    // Only send fields that have been changed or have values
    const settingsToSave = { ...settings };
    console.log('Settings to save:', settingsToSave);
    updateSettingsMutation.mutate(settingsToSave);
  };

  const handleTestEmail = () => {
    if (testEmail) {
      testEmailMutation.mutate(testEmail);
    }
  };

  const handleTestSms = () => {
    if (testPhone) {
      testSmsMutation.mutate(testPhone);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/admin/settings/upload-logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Update settings with the new logo URL immediately
        const newLogoUrl = result.data.url;
        setSettings((prev) => ({ ...prev, logo_url: newLogoUrl }));
        setLogoFile(null);
        toast.success('Logo uploaded successfully!');
        
        // Invalidate and refetch settings to ensure UI is updated
        queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
        const refetchedData = await refetch();
        
        // Update settings state with fresh data
        if (refetchedData.data) {
          setSettings(refetchedData.data);
        }
      } else {
        toast.error(result.error?.message || 'Failed to upload logo');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setLogoFile(file);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">Manage application settings and test notifications</p>
      </div>

      <Tabs defaultValue="app" className="space-y-6">
        <TabsList>
          <TabsTrigger value="app">App Settings</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* App Settings Tab */}
        <TabsContent value="app" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>
                Configure general application settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_upload">Upload Logo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="logo_upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="flex-1"
                    />
                    {logoFile && (
                      <>
                        <Button
                          type="button"
                          onClick={handleLogoUpload}
                          disabled={logoUploading}
                          size="sm"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {logoUploading ? 'Uploading...' : 'Upload'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setLogoFile(null)}
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  {logoFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {logoFile.name} ({(logoFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload an image file (JPG, PNG, GIF, WebP, or SVG). Max size: 5MB.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo_url">Or Enter Logo URL</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={typeof settings.logo_url === 'string' ? settings.logo_url : ''}
                    onChange={(e) => handleSettingChange('logo_url', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alternatively, enter a URL to your logo image. Will be displayed in the header and landing page.
                  </p>
                </div>

                {settings.logo_url && typeof settings.logo_url === 'string' && (
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="text-xs text-muted-foreground mb-2">Current Logo Preview:</p>
                    <div className="flex items-center justify-center min-h-[80px] bg-white rounded p-2">
                      <img
                        src={settings.logo_url}
                        alt="Logo preview"
                        className="max-h-20 max-w-full object-contain"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const parent = img.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="text-center">
                                <p class="text-xs text-red-500 mb-1">Failed to load logo</p>
                                <p class="text-xs text-gray-500 break-all">${settings.logo_url}</p>
                                <p class="text-xs text-gray-400 mt-1">Check if the file exists and the URL is correct</p>
                              </div>
                            `;
                          }
                        }}
                        onLoad={() => {
                          console.log('Logo loaded successfully:', settings.logo_url);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="site_name">Site Name</Label>
                  <Input
                    id="site_name"
                    value={settings.site_name || ''}
                    onChange={(e) => handleSettingChange('site_name', e.target.value)}
                    placeholder="Vibe Coding Academy"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={settings.contact_email || ''}
                    onChange={(e) => handleSettingChange('contact_email', e.target.value)}
                    placeholder="info@vibecoding.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={settings.contact_phone || ''}
                    onChange={(e) => handleSettingChange('contact_phone', e.target.value)}
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={settings.timezone || 'Africa/Accra'}
                    onChange={(e) => handleSettingChange('timezone', e.target.value)}
                    placeholder="Africa/Accra"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenance_mode">Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable to put the site in maintenance mode
                    </p>
                  </div>
                  <Switch
                    id="maintenance_mode"
                    checked={settings.maintenance_mode === true}
                    onCheckedChange={(checked) => handleSettingChange('maintenance_mode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="registration_enabled">Registration Enabled</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow new class registrations
                    </p>
                  </div>
                  <Switch
                    id="registration_enabled"
                    checked={settings.registration_enabled !== false}
                    onCheckedChange={(checked) => handleSettingChange('registration_enabled', checked)}
                  />
                </div>
              </div>

              {updateSettingsMutation.isError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md space-y-2">
                  <p>
                    {updateSettingsMutation.error instanceof Error
                      ? (updateSettingsMutation.error.message.includes('401') || updateSettingsMutation.error.message.includes('token') || updateSettingsMutation.error.message.includes('Unauthorized')
                          ? 'Your session has expired. Please log out and log back in, then try again.'
                          : updateSettingsMutation.error.message)
                      : 'Failed to update settings'}
                  </p>
                  {updateSettingsMutation.error instanceof Error && 
                   (updateSettingsMutation.error.message.includes('401') || updateSettingsMutation.error.message.includes('token') || updateSettingsMutation.error.message.includes('Unauthorized')) && (
                    <Button
                      onClick={() => {
                        logout();
                        router.push('/admin/login');
                      }}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Log Out & Log In Again
                    </Button>
                  )}
                </div>
              )}

              {updateSettingsMutation.isSuccess && (
                <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                  Settings saved successfully!
                </div>
              )}

              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Paystack Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Paystack Payment Gateway</CardTitle>
              <CardDescription>
                Configure your Paystack API keys for payment processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> These settings are stored in the database. For security, sensitive keys should also be set in environment variables (.env file) which take precedence.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paystack_public_key">Paystack Public Key</Label>
                  <Input
                    id="paystack_public_key"
                    type="password"
                    value={settings.paystack_public_key || ''}
                    onChange={(e) => handleSettingChange('paystack_public_key', e.target.value)}
                    placeholder="pk_test_..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Paystack public key (starts with pk_test_ or pk_live_)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paystack_secret_key">Paystack Secret Key</Label>
                  <Input
                    id="paystack_secret_key"
                    type="password"
                    value={settings.paystack_secret_key || ''}
                    onChange={(e) => handleSettingChange('paystack_secret_key', e.target.value)}
                    placeholder={settings.paystack_secret_key ? '•••••••• (key is set)' : 'sk_test_...'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.paystack_secret_key ? 'Secret key is set. Leave empty to keep current key, or enter a new key to change it.' : 'Your Paystack secret key (starts with sk_test_ or sk_live_). Keep this secure!'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paystack_webhook_secret">Paystack Webhook Secret</Label>
                  <Input
                    id="paystack_webhook_secret"
                    type="password"
                    value={settings.paystack_webhook_secret || ''}
                    onChange={(e) => handleSettingChange('paystack_webhook_secret', e.target.value)}
                    placeholder="whsec_..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Webhook secret for verifying Paystack webhook requests
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paystack_webhook_url">Webhook URL</Label>
                  <Input
                    id="paystack_webhook_url"
                    value={settings.paystack_webhook_url || (typeof window !== 'undefined' ? `${window.location.origin.replace('3005', '3001')}/webhooks/paystack` : 'http://localhost:3001/webhooks/paystack')}
                    onChange={(e) => handleSettingChange('paystack_webhook_url', e.target.value)}
                    readOnly
                    className="bg-gray-50 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    <strong>Configure this URL in your Paystack dashboard:</strong> Settings → API Keys & Webhooks → Add Webhook URL
                    <br />
                    <strong>Events to subscribe:</strong> charge.success, charge.failed, transaction.success, transaction.failed
                    <br />
                    <strong>Note:</strong> Update the port (3001) to match your backend server. In production, use your production domain.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Webhook Security:</strong> The webhook secret is used to verify that webhook requests are actually from Paystack. 
                    Make sure to set this in your Paystack dashboard and keep it secure.
                  </p>
                </div>
              </div>

              {updateSettingsMutation.isError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md space-y-2">
                  <p>
                    {updateSettingsMutation.error instanceof Error
                      ? (updateSettingsMutation.error.message.includes('401') || updateSettingsMutation.error.message.includes('token') || updateSettingsMutation.error.message.includes('Unauthorized')
                          ? 'Your session has expired. Please log out and log back in, then try again.'
                          : updateSettingsMutation.error.message)
                      : 'Failed to update settings'}
                  </p>
                  {updateSettingsMutation.error instanceof Error && 
                   (updateSettingsMutation.error.message.includes('401') || updateSettingsMutation.error.message.includes('token') || updateSettingsMutation.error.message.includes('Unauthorized')) && (
                    <Button
                      onClick={() => {
                        logout();
                        router.push('/admin/login');
                      }}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Log Out & Log In Again
                    </Button>
                  )}
                </div>
              )}

              {updateSettingsMutation.isSuccess && (
                <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                  Paystack settings saved successfully!
                </div>
              )}

              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Paystack Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* SMTP Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Email (SMTP) Configuration</CardTitle>
              <CardDescription>
                Configure SMTP settings for sending emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> These settings are stored in the database. For security, sensitive credentials should also be set in environment variables (.env file) which take precedence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    value={settings.smtp_host || ''}
                    onChange={(e) => handleSettingChange('smtp_host', e.target.value)}
                    placeholder="smtp.hostinger.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={settings.smtp_port || ''}
                    onChange={(e) => handleSettingChange('smtp_port', e.target.value)}
                    placeholder="465"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_user">SMTP Username</Label>
                  <Input
                    id="smtp_user"
                    value={settings.smtp_user || ''}
                    onChange={(e) => handleSettingChange('smtp_user', e.target.value)}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_from">From Email Address</Label>
                  <Input
                    id="smtp_from"
                    type="email"
                    value={settings.smtp_from || ''}
                    onChange={(e) => handleSettingChange('smtp_from', e.target.value)}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_pass">SMTP Password</Label>
                <Input
                  id="smtp_pass"
                  type="password"
                  value={settings.smtp_pass || ''}
                  onChange={(e) => handleSettingChange('smtp_pass', e.target.value)}
                  placeholder={settings.smtp_pass ? '•••••••• (password is set)' : 'Enter SMTP password'}
                />
                <p className="text-xs text-muted-foreground">
                  {settings.smtp_pass ? 'Password is set. Leave empty to keep current password, or enter a new password to change it.' : 'Your SMTP password (stored securely)'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="smtp_secure">Use SSL/TLS</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable for secure SMTP connection (port 465)
                  </p>
                </div>
                <Switch
                  id="smtp_secure"
                  checked={settings.smtp_secure === true}
                  onCheckedChange={(checked) => handleSettingChange('smtp_secure', checked)}
                />
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save SMTP Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* SMS Settings */}
          <Card>
            <CardHeader>
              <CardTitle>SMS (Deywuro) Configuration</CardTitle>
              <CardDescription>
                Configure Deywuro API settings for sending SMS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>API Documentation:</strong> Deywuro NPONTU SMS API
                </p>
                <p className="text-xs text-blue-700">
                  Endpoint: <code className="bg-white px-1 rounded">https://deywuro.com/api/sms</code>
                  <br />
                  Methods: POST or GET
                  <br />
                  Parameters: username, password, destination, source, message
                  <br />
                  <a 
                    href="https://www.deywuro.com/NewUI/Landing/images/NPONTU_SMS_API_DOCUMENT_NEW.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900"
                  >
                    View Full Documentation (PDF)
                  </a>
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> These settings are stored in the database. For security, sensitive credentials should also be set in environment variables (.env file) which take precedence.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deywuro_username">Deywuro Username</Label>
                  <Input
                    id="deywuro_username"
                    value={settings.deywuro_username || ''}
                    onChange={(e) => handleSettingChange('deywuro_username', e.target.value)}
                    placeholder="Your Deywuro username"
                  />
                  <p className="text-xs text-muted-foreground">
                    Client deywuro username (provided by Npontu)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deywuro_password">Deywuro Password</Label>
                  <Input
                    id="deywuro_password"
                    type="password"
                    value={settings.deywuro_password || ''}
                    onChange={(e) => handleSettingChange('deywuro_password', e.target.value)}
                    placeholder={settings.deywuro_password ? '•••••••• (password is set)' : 'Your Deywuro password'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.deywuro_password ? 'Password is set. Leave empty to keep current password, or enter a new password to change it.' : 'Client deywuro password (provided by Npontu)'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deywuro_sender">Sender ID (Source)</Label>
                  <Input
                    id="deywuro_sender"
                    value={settings.deywuro_sender || ''}
                    onChange={(e) => handleSettingChange('deywuro_sender', e.target.value)}
                    placeholder="VIBECODING"
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sender title from which the message will be delivered (max 11 characters, alphanumeric only)
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-700">
                    <strong>API Endpoint:</strong> https://deywuro.com/api/sms
                    <br />
                    <strong>Methods:</strong> POST or GET
                    <br />
                    <strong>Parameters:</strong> username, password, destination, source, message
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save SMS Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          {/* Email Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Test Email
              </CardTitle>
              <CardDescription>
                Test your email configuration by sending a test email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_email">Email Address</Label>
                <Input
                  id="test_email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>

              {testEmailMutation.isError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {testEmailMutation.error instanceof Error
                    ? testEmailMutation.error.message
                    : 'Failed to send test email'}
                </div>
              )}

              {testEmailMutation.isSuccess && (
                <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                  Test email sent successfully! Check your inbox.
                </div>
              )}

              <Button
                onClick={handleTestEmail}
                disabled={testEmailMutation.isPending || !testEmail}
                variant="outline"
              >
                <Send className="w-4 h-4 mr-2" />
                {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
              </Button>
            </CardContent>
          </Card>

          {/* SMS Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Test SMS
              </CardTitle>
              <CardDescription>
                Test your SMS configuration by sending a test message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_phone">Phone Number</Label>
                <Input
                  id="test_phone"
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+233241234567"
                />
                <p className="text-xs text-muted-foreground">
                  Include country code (e.g., +233 for Ghana)
                </p>
              </div>

              {testSmsMutation.isError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {testSmsMutation.error instanceof Error
                    ? testSmsMutation.error.message
                    : 'Failed to send test SMS'}
                </div>
              )}

              {testSmsMutation.isSuccess && (
                <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                  Test SMS sent successfully! Check your phone.
                </div>
              )}

              <Button
                onClick={handleTestSms}
                disabled={testSmsMutation.isPending || !testPhone}
                variant="outline"
              >
                <Send className="w-4 h-4 mr-2" />
                {testSmsMutation.isPending ? 'Sending...' : 'Send Test SMS'}
              </Button>
            </CardContent>
          </Card>

          {/* Email/SMS Template Management Link */}
          <Card>
            <CardHeader>
              <CardTitle>Email & SMS Templates</CardTitle>
              <CardDescription>
                Manage email and SMS templates used for notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>Email Templates:</strong> Used for registration confirmations, payment
                    notifications, and class reminders.
                  </p>
                  <p>
                    <strong>SMS Templates:</strong> Used for class reminders and important
                    notifications.
                  </p>
                  <p className="pt-2">
                    Templates support variables like <code className="bg-gray-100 px-1 rounded">
                      {'{{parent_name}}'}
                    </code>
                    , <code className="bg-gray-100 px-1 rounded">{'{{student_name}}'}</code>, etc.
                  </p>
                </div>
                <Link href="/admin/settings/templates">
                  <Button variant="outline" className="w-full">
                    Manage Templates
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

