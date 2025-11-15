"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Star, Image, Globe, Mail, Video } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/contexts/toast-context";
import { isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/youtube-utils";

interface BrandingSettings {
  companyName: string;
  companyLogo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  description: string;
  pdfHeaderImage: string;
  pdfFooterImage: string;
  chatButtonImage: string;
  emailTemplateHeader: string;
  emailTemplateFooter: string;
  heroVideo: string;
}

export default function BrandingSettingsPage() {
  const [settings, setSettings] = useState<BrandingSettings>({
    companyName: "AdPools Group",
    companyLogo: "/uploads/branding/company_logo_default.svg",
    favicon: "/uploads/branding/favicon_default.svg",
    primaryColor: "#3B82F6",
    secondaryColor: "#1E40AF",
    description: "A practical, single-tenant system for sales and distribution management",
    pdfHeaderImage: "",
    pdfFooterImage: "",
    chatButtonImage: "",
    emailTemplateHeader: "",
    emailTemplateFooter: "",
    heroVideo: ""
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/branding');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading branding settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        success('Branding settings saved successfully!');
        // Update favicon if changed
        if (settings.favicon) {
          updateFavicon(settings.favicon);
        }
      } else {
        error('Failed to save branding settings');
      }
    } catch (err) {
      console.error('Error saving branding settings:', err);
      error('Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const updateFavicon = (faviconUrl: string) => {
    // Remove existing favicon
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.remove();
    }

    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = faviconUrl;
    document.head.appendChild(link);
  };

  const handleFileUpload = async (field: 'companyLogo' | 'favicon' | 'pdfHeaderImage' | 'pdfFooterImage' | 'chatButtonImage' | 'heroVideo', file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', field);

      const response = await fetch('/api/upload/branding', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          [field]: data.url
        }));
        const fieldNames: Record<string, string> = {
          companyLogo: 'Company logo',
          favicon: 'Favicon',
          pdfHeaderImage: 'PDF header image',
          pdfFooterImage: 'PDF footer image',
          chatButtonImage: 'Chat button image',
          heroVideo: 'Hero video'
        };
        success(`${fieldNames[field]} uploaded successfully!`);
      } else {
        error(`Failed to upload ${field}`);
      }
    } catch (err) {
      console.error(`Error uploading ${field}:`, err);
      error(`Failed to upload ${field}`);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading branding settings...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Branding Settings</h1>
            <p className="text-gray-600">Customize your company's visual identity and branding</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5" />
                <span>Company Information</span>
              </CardTitle>
              <CardDescription>
                Basic company details and branding information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Enter company name"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter company description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="#1E40AF"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Assets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="h-5 w-5" />
                <span>Visual Assets</span>
              </CardTitle>
              <CardDescription>
                Upload and manage your company logo and favicon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Logo */}
              <div>
                <Label>Company Logo</Label>
                <div className="mt-2 space-y-3">
                  {settings.companyLogo && (
                    <div className="flex items-center space-x-3">
                      <img 
                        src={settings.companyLogo} 
                        alt="Company Logo" 
                        className="h-16 w-auto object-contain border rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Current logo</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload('companyLogo', file);
                        }
                      }}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload logo</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div>
                <Label>Favicon</Label>
                <div className="mt-2 space-y-3">
                  {settings.favicon && (
                    <div className="flex items-center space-x-3">
                      <img 
                        src={settings.favicon} 
                        alt="Favicon" 
                        className="h-8 w-8 object-contain border rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Current favicon</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload('favicon', file);
                        }
                      }}
                      className="hidden"
                      id="favicon-upload"
                    />
                    <Label htmlFor="favicon-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                        <div className="text-center">
                          <Globe className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload favicon</p>
                          <p className="text-xs text-gray-500">Recommended: 32x32 or 16x16 pixels</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PDF Document Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="h-5 w-5" />
                <span>PDF Document Images</span>
              </CardTitle>
              <CardDescription>
                Upload header and footer images for quotes and invoices PDFs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PDF Header Image */}
              <div>
                <Label>PDF Header Image</Label>
                <p className="text-xs text-gray-500 mb-2">This image will appear at the top of all quote and invoice PDFs</p>
                <div className="mt-2 space-y-3">
                  {settings.pdfHeaderImage && (
                    <div className="flex items-center space-x-3">
                      <img 
                        src={settings.pdfHeaderImage} 
                        alt="PDF Header" 
                        className="h-20 w-auto object-contain border rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Current header image</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload('pdfHeaderImage', file);
                        }
                      }}
                      className="hidden"
                      id="header-upload"
                    />
                    <Label htmlFor="header-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload header image</p>
                          <p className="text-xs text-gray-500">Recommended width: 800-1200px</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </div>

              {/* PDF Footer Image */}
              <div>
                <Label>PDF Footer Image</Label>
                <p className="text-xs text-gray-500 mb-2">This image will appear at the bottom of all quote and invoice PDFs</p>
                <div className="mt-2 space-y-3">
                  {settings.pdfFooterImage && (
                    <div className="flex items-center space-x-3">
                      <img 
                        src={settings.pdfFooterImage} 
                        alt="PDF Footer" 
                        className="h-20 w-auto object-contain border rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Current footer image</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload('pdfFooterImage', file);
                        }
                      }}
                      className="hidden"
                      id="footer-upload"
                    />
                    <Label htmlFor="footer-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload footer image</p>
                          <p className="text-xs text-gray-500">Recommended width: 800-1200px</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Button Image */}
          <Card>
            <CardHeader>
              <CardTitle>Chat Button Image</CardTitle>
              <CardDescription>
                Upload an image for the floating chat button (AI Assistant). This will be visible to all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.chatButtonImage && (
                <div className="flex items-center space-x-3">
                  <img 
                    src={settings.chatButtonImage} 
                    alt="Chat Button" 
                    className="h-20 w-20 object-cover rounded-full border"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Current chat button image</p>
                  </div>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload('chatButtonImage', file);
                    }
                  }}
                  className="hidden"
                  id="chat-button-upload"
                />
                <Label htmlFor="chat-button-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                    <div className="text-center">
                      <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        {settings.chatButtonImage ? 'Change chat button image' : 'Upload chat button image'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Recommended: Square image (200x200px)</p>
                    </div>
                  </div>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Ecommerce Hero Video */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Video className="h-5 w-5" />
                <span>Ecommerce Hero Video</span>
              </CardTitle>
              <CardDescription>
                Upload a video file or enter a YouTube URL to display as the background of the e-commerce homepage hero section. Supported: MP4 files or YouTube URLs (e.g., https://youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.heroVideo && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    {isYouTubeUrl(settings.heroVideo) ? (
                      <iframe
                        src={getYouTubeEmbedUrl(settings.heroVideo) || ''}
                        className="h-32 w-56 object-cover border rounded"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    ) : (
                      <video 
                        src={settings.heroVideo} 
                        className="h-32 w-auto object-cover border rounded"
                        controls
                        muted
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Current hero video</p>
                      <p className="text-xs text-gray-500 mt-1 break-all">{settings.heroVideo}</p>
                      {isYouTubeUrl(settings.heroVideo) && (
                        <p className="text-xs text-blue-600 mt-1">YouTube video detected</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload('heroVideo', file);
                    }
                  }}
                  className="hidden"
                  id="hero-video-upload"
                />
                <Label htmlFor="hero-video-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                    <div className="text-center">
                      <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        {settings.heroVideo ? 'Change hero video' : 'Upload hero video'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Recommended: MP4 format, optimized for web</p>
                    </div>
                  </div>
                </Label>
              </div>
              <div>
                <Label htmlFor="hero-video-url">Or enter video URL</Label>
                <Input
                  id="hero-video-url"
                  type="url"
                  value={settings.heroVideo}
                  onChange={(e) => setSettings(prev => ({ ...prev, heroVideo: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID or https://example.com/video.mp4"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a YouTube URL (youtube.com/watch?v=... or youtu.be/...) or a direct URL to a video file (MP4)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Email Template</span>
              </CardTitle>
              <CardDescription>
                Customize the header and footer HTML for all outgoing emails. Colors will automatically use your theme colors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Available Variables */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <Label className="text-sm font-semibold mb-2 block">Available Variables</Label>
                <p className="text-xs text-gray-600 mb-3">
                  Use these variables in your HTML templates. They will be replaced with actual values when emails are sent.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{companyName}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{companyAddress}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{companyPhone}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{companyEmail}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{companyWebsite}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{primaryColor}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{secondaryColor}'}</code>
                  <code className="text-xs bg-white px-2 py-1 rounded border">{'{currentYear}'}</code>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <strong>Example:</strong> <code className="bg-white px-1 py-0.5 rounded">{'{companyName}'}</code> will be replaced with your company name.
                </p>
              </div>

              {/* Email Header */}
              <div>
                <Label htmlFor="email-header">Email Header (HTML)</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Custom HTML for the email header. Leave empty to use default header with company name.
                  <br />
                  <strong>Note:</strong> The primary theme color will be automatically applied to the header background.
                </p>
                <Textarea
                  id="email-header"
                  value={settings.emailTemplateHeader}
                  onChange={(e) => setSettings({ ...settings, emailTemplateHeader: e.target.value })}
                  placeholder={`<div style="background-color: {primaryColor}; padding: 20px; text-align: center;">
  <h1 style="color: #ffffff; margin: 0;">{companyName}</h1>
  <p style="color: #ffffff; margin: 8px 0 0; font-size: 14px;">{companyAddress}</p>
</div>`}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              {/* Email Footer */}
              <div>
                <Label htmlFor="email-footer">Email Footer (HTML)</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Custom HTML for the email footer. Leave empty to use default footer with copyright.
                  <br />
                  <strong>Note:</strong> The footer will have a border in your primary theme color.
                </p>
                <Textarea
                  id="email-footer"
                  value={settings.emailTemplateFooter}
                  onChange={(e) => setSettings({ ...settings, emailTemplateFooter: e.target.value })}
                  placeholder={`<div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 3px solid {primaryColor};">
  <p style="color: #6c757d; margin: 0 0 8px; font-size: 14px;">
    © {currentYear} {companyName}. All rights reserved.
  </p>
  <p style="color: #6c757d; margin: 0; font-size: 12px;">
    {companyAddress} | {companyPhone} | {companyEmail}
  </p>
</div>`}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </>
  );
}
