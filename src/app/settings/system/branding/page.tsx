"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Star, Image, Globe, Mail, Video, Sparkles, Wand2, XCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/contexts/toast-context";
import { isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/youtube-utils";
import { DEFAULT_STOREFRONT_CONTENT } from "@/lib/storefront-content";

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
  footerLogo: string;
}

interface PromoBannerContent {
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  gradient?: string;
}

interface HeroSlideContent {
  id: string;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  image?: string;
  accentColor?: string;
}

interface ProductPromoContent {
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  gradient?: string;
}

const DEFAULT_PROMO_BANNER = DEFAULT_STOREFRONT_CONTENT.home_promo_banner as PromoBannerContent;
const DEFAULT_HERO_SLIDES = (
  (DEFAULT_STOREFRONT_CONTENT.home_hero as unknown as { slides: HeroSlideContent[] })?.slides || []
) as HeroSlideContent[];
const DEFAULT_PRODUCT_PROMO =
  (DEFAULT_STOREFRONT_CONTENT.product_promo_banner as ProductPromoContent) || {};

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
    heroVideo: "",
    footerLogo: ""
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoBanner, setPromoBanner] = useState<PromoBannerContent>(DEFAULT_PROMO_BANNER);
  const [heroSlides, setHeroSlides] = useState<HeroSlideContent[]>(DEFAULT_HERO_SLIDES);
  const [productPromo, setProductPromo] = useState<ProductPromoContent>(DEFAULT_PRODUCT_PROMO);
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [brandingResponse, contentResponse] = await Promise.all([
        fetch('/api/settings/branding'),
        fetch(
          '/api/settings/storefront/content?keys=home_promo_banner,home_hero,product_promo_banner'
        ),
      ]);

      if (brandingResponse.ok) {
        const data = await brandingResponse.json();
        setSettings(data);
      }

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        const promo = contentData?.content?.home_promo_banner;
        const hero = contentData?.content?.home_hero?.slides;
        const productBanner = contentData?.content?.product_promo_banner;

        if (promo) {
          setPromoBanner(promo);
        } else {
          setPromoBanner(DEFAULT_PROMO_BANNER);
        }

        if (Array.isArray(hero) && hero.length > 0) {
          setHeroSlides(hero);
        } else {
          setHeroSlides(DEFAULT_HERO_SLIDES);
        }

        if (productBanner) {
          setProductPromo(productBanner);
        } else {
          setProductPromo(DEFAULT_PRODUCT_PROMO);
        }
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
      const [brandingResponse, cmsResponse] = await Promise.all([
        fetch('/api/settings/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
        }),
        fetch('/api/settings/storefront/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sections: [
              {
                key: 'home_promo_banner',
                data: promoBanner,
              },
              {
                key: 'home_hero',
                data: {
                  slides: heroSlides,
                },
              },
              {
                key: 'product_promo_banner',
                data: productPromo,
              },
            ],
          }),
        }),
      ]);

      if (!brandingResponse.ok || !cmsResponse.ok) {
        error('Failed to save branding settings');
        return;
      }

        success('Branding settings saved successfully!');
        if (settings.favicon) {
          updateFavicon(settings.favicon);
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

  const handleFileUpload = async (field: 'companyLogo' | 'favicon' | 'pdfHeaderImage' | 'pdfFooterImage' | 'chatButtonImage' | 'heroVideo' | 'footerLogo', file: File) => {
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
          heroVideo: 'Hero video',
          footerLogo: 'Footer logo'
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

  const generateSlideId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `slide-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const updateHeroSlide = (index: number, patch: Partial<HeroSlideContent>) => {
    setHeroSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addHeroSlide = () => {
    setHeroSlides((prev) => [
      ...prev,
      {
        id: generateSlideId(),
        eyebrow: 'New Highlight',
        heading: 'Add a bold headline',
        description: 'Describe what makes this offer special.',
        ctaText: 'Shop now',
        ctaLink: '/shop',
        image: '',
        accentColor: '#23185c',
      },
    ]);
  };

  const removeHeroSlide = (index: number) => {
    setHeroSlides((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateProductPromo = (patch: Partial<ProductPromoContent>) => {
    setProductPromo((prev) => ({ ...prev, ...patch }));
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

              {/* Footer Logo */}
              <div>
                <Label>Footer Logo</Label>
                <p className="text-xs text-gray-500 mb-2">This logo will appear in the admin sidebar footer</p>
                <div className="mt-2 space-y-3">
                  {settings.footerLogo && (
                    <div className="flex items-center space-x-3">
                      <img 
                        src={settings.footerLogo} 
                        alt="Footer Logo" 
                        className="h-12 w-auto object-contain border rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Current footer logo</p>
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
                          handleFileUpload('footerLogo', file);
                        }
                      }}
                      className="hidden"
                      id="footer-logo-upload"
                    />
                    <Label htmlFor="footer-logo-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload footer logo</p>
                          <p className="text-xs text-gray-500">Recommended: 200-300px width</p>
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

        {/* Storefront Hero Slider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wand2 className="h-5 w-5" />
              <span>Homepage Hero Slider</span>
            </CardTitle>
            <CardDescription>
              Manage the primary hero carousel on the storefront home page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {heroSlides.map((slide, index) => (
                <div key={slide.id ?? index} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Slide {index + 1}</h4>
                    {heroSlides.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeHeroSlide(index)}
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Eyebrow</Label>
                      <Input
                        value={slide.eyebrow || ''}
                        onChange={(e) => updateHeroSlide(index, { eyebrow: e.target.value })}
                        placeholder="Summer Essentials"
                      />
                    </div>
                    <div>
                      <Label>Accent Color</Label>
                      <Input
                        value={slide.accentColor || ''}
                        onChange={(e) => updateHeroSlide(index, { accentColor: e.target.value })}
                        placeholder="#23185c"
                      />
                    </div>
                    <div>
                      <Label>Heading</Label>
                      <Input
                        value={slide.heading}
                        onChange={(e) => updateHeroSlide(index, { heading: e.target.value })}
                        placeholder="Everything You Need for a Sparkling Pool"
                      />
                    </div>
                    <div>
                      <Label>Subheading</Label>
                      <Input
                        value={slide.subheading || ''}
                        onChange={(e) => updateHeroSlide(index, { subheading: e.target.value })}
                        placeholder="Expert curated essentials"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={slide.description || ''}
                        onChange={(e) => updateHeroSlide(index, { description: e.target.value })}
                        rows={3}
                        placeholder="Shop pumps, filters, chemicals, and accessories curated by professionals."
                      />
                    </div>
                    <div>
                      <Label>CTA Text</Label>
                      <Input
                        value={slide.ctaText || ''}
                        onChange={(e) => updateHeroSlide(index, { ctaText: e.target.value })}
                        placeholder="Shop All Products"
                      />
                    </div>
                    <div>
                      <Label>CTA Link</Label>
                      <Input
                        value={slide.ctaLink || ''}
                        onChange={(e) => updateHeroSlide(index, { ctaLink: e.target.value })}
                        placeholder="/shop"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Image URL</Label>
                      <Input
                        value={slide.image || ''}
                        onChange={(e) => updateHeroSlide(index, { image: e.target.value })}
                        placeholder="https://…"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use a hosted image (JPG/PNG/WebP). Recommended aspect ratio 16:9.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" type="button" onClick={addHeroSlide}>
              <Sparkles className="mr-2 h-4 w-4" /> Add Slide
            </Button>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview</p>
              <div className="grid gap-3">
                {heroSlides.map((slide, index) => (
                  <div key={`preview-${slide.id ?? index}`} className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-gray-500">{slide.eyebrow || 'Eyebrow'}</p>
                    <p className="text-lg font-bold text-gray-900">{slide.heading || 'Heading goes here'}</p>
                    <p className="text-sm text-gray-600">{slide.description || 'Description preview'}</p>
                    <p className="text-xs text-gray-400">CTA: {slide.ctaText || 'N/A'} → {slide.ctaLink || 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Page Promo Banner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span>Product Page Promo Banner</span>
            </CardTitle>
            <CardDescription>
              Controls the promotional banner displayed beneath the product details page.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="productPromoEyebrow">Eyebrow Text</Label>
              <Input
                id="productPromoEyebrow"
                value={productPromo.eyebrow ?? ''}
                onChange={(e) => updateProductPromo({ eyebrow: e.target.value })}
                placeholder="Poolside Upgrade"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="productPromoTitle">Title</Label>
              <Input
                id="productPromoTitle"
                value={productPromo.title ?? ''}
                onChange={(e) => updateProductPromo({ title: e.target.value })}
                placeholder="Bundle & Save on Spa Accessories"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="productPromoDescription">Description</Label>
              <Textarea
                id="productPromoDescription"
                value={productPromo.description ?? ''}
                onChange={(e) => updateProductPromo({ description: e.target.value })}
                placeholder="Complete your relaxation setup with curated accessories. Members enjoy an extra 10% off when buying two or more."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="productPromoCtaText">CTA Text</Label>
              <Input
                id="productPromoCtaText"
                value={productPromo.ctaText ?? ''}
                onChange={(e) => updateProductPromo({ ctaText: e.target.value })}
                placeholder="Explore Accessories"
              />
            </div>
            <div>
              <Label htmlFor="productPromoCtaHref">CTA Link</Label>
              <Input
                id="productPromoCtaHref"
                value={productPromo.ctaHref ?? ''}
                onChange={(e) => updateProductPromo({ ctaHref: e.target.value })}
                placeholder="/shop?category=accessories"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="productPromoGradient">Background Gradient</Label>
              <Input
                id="productPromoGradient"
                value={productPromo.gradient ?? ''}
                onChange={(e) => updateProductPromo({ gradient: e.target.value })}
                placeholder="from-sky-500 via-cyan-500 to-emerald-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Tailwind gradient classes. Example: <code>from-emerald-500 via-teal-500 to-sky-500</code>
              </p>
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setProductPromo(DEFAULT_PRODUCT_PROMO)}
              >
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Storefront Promo Banner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span>Storefront Promo Banner</span>
            </CardTitle>
            <CardDescription>
              Control the promotional banner shown on the home and product pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Eyebrow</Label>
                <Input
                  value={promoBanner.eyebrow || ''}
                  onChange={(e) => setPromoBanner({ ...promoBanner, eyebrow: e.target.value })}
                  placeholder="Limited Time Offer"
                />
              </div>
              <div>
                <Label>Background Gradient</Label>
                <Input
                  value={promoBanner.gradient || ''}
                  onChange={(e) => setPromoBanner({ ...promoBanner, gradient: e.target.value })}
                  placeholder="from-indigo-600 via-purple-500 to-pink-500"
                />
                <p className="text-xs text-gray-500 mt-1">Provide Tailwind gradient classes.</p>
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={promoBanner.title || ''}
                onChange={(e) => setPromoBanner({ ...promoBanner, title: e.target.value })}
                placeholder="Turn Your Backyard into a Paradise"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={promoBanner.description || ''}
                onChange={(e) => setPromoBanner({ ...promoBanner, description: e.target.value })}
                rows={3}
                placeholder="Pool floats, lights, speakers, and more—bundle and save…"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>CTA Text</Label>
                <Input
                  value={promoBanner.ctaText || ''}
                  onChange={(e) => setPromoBanner({ ...promoBanner, ctaText: e.target.value })}
                  placeholder="Shop Backyard Kits"
                />
              </div>
              <div>
                <Label>CTA Link</Label>
                <Input
                  value={promoBanner.ctaHref || ''}
                  onChange={(e) => setPromoBanner({ ...promoBanner, ctaHref: e.target.value })}
                  placeholder="/shop?category=accessories"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview</p>
              <div
                className={`flex flex-col overflow-hidden rounded-2xl bg-gradient-to-r ${promoBanner.gradient || 'from-indigo-600 via-purple-500 to-pink-500'} p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between`}
              >
                <div className="max-w-xl">
                  {promoBanner.eyebrow ? (
                    <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      {promoBanner.eyebrow}
                    </span>
                  ) : null}
                  <h3 className="mt-4 text-2xl font-bold leading-tight">
                    {promoBanner.title || 'Add a headline'}
                  </h3>
                  <p className="mt-3 text-sm text-white/80">
                    {promoBanner.description || 'Describe the promotion or message you want to highlight.'}
                  </p>
                </div>
                <div className="mt-4 md:mt-0">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-indigo-600 shadow">
                    {promoBanner.ctaText || 'Shop now'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
