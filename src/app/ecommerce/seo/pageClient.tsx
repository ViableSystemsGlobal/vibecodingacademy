"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/toast-context";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Code,
  Link as LinkIcon,
  Globe,
  Share2,
  Upload,
  Trash2,
  ActivitySquare,
} from "lucide-react";

interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterHandle: string;
  pixelId: string;
  pixelEnabled: boolean;
  gaMeasurementId: string;
  gaEnabled: boolean;
}

const initialSettings: SeoSettings = {
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  twitterHandle: "",
  pixelId: "",
  pixelEnabled: false,
  gaMeasurementId: "",
  gaEnabled: false,
};

export default function EcommerceSeoPageClient() {
  const { success, error } = useToast();
  const [settings, setSettings] = useState<SeoSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/settings/seo", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch SEO settings");
        }
        const data = await response.json();
        setSettings({
          metaTitle: data.metaTitle ?? "",
          metaDescription: data.metaDescription ?? "",
          metaKeywords: data.metaKeywords ?? "",
          canonicalUrl: data.canonicalUrl ?? "",
          ogTitle: data.ogTitle ?? "",
          ogDescription: data.ogDescription ?? "",
          ogImage: data.ogImage ?? "",
          twitterHandle: data.twitterHandle ?? "",
          pixelId: data.pixelId ?? "",
          pixelEnabled: Boolean(data.pixelEnabled),
          gaMeasurementId: data.gaMeasurementId ?? "",
          gaEnabled: Boolean(data.gaEnabled),
        });
      } catch (err) {
        console.error("Error loading SEO settings:", err);
        error("Failed to load SEO settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [error]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/settings/seo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save SEO settings");
      }

      success("SEO settings updated");
    } catch (err) {
      console.error("Error saving SEO settings:", err);
      error("Failed to save SEO settings");
    } finally {
      setSaving(false);
    }
  };

  const handleOgImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingOgImage(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "seoOgImage");

      const response = await fetch("/api/upload/branding", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      setSettings((prev) => ({
        ...prev,
        ogImage: data.url ?? "",
      }));
      success("Social sharing image uploaded");
    } catch (err) {
      console.error("Failed to upload OG image:", err);
      error("Failed to upload image. Please try again.");
    } finally {
      setUploadingOgImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFieldChange = (field: keyof SeoSettings) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SEO & Tracking</h1>
        <p className="text-gray-600">
          Configure default meta tags, social sharing data, and analytics for the storefront.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="border border-gray-200">
              <CardContent>
                <div className="animate-pulse space-y-4 py-6">
                  <div className="h-6 w-40 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-10 w-full rounded bg-gray-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-500" />
                General Metadata
              </CardTitle>
              <CardDescription>
                Default meta tags that apply across the storefront. Individual pages can override these.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="meta-title">Default Meta Title</Label>
                <Input
                  id="meta-title"
                  placeholder="e.g. Premium Pool Care Products & Accessories"
                  value={settings.metaTitle}
                  onChange={handleFieldChange("metaTitle")}
                />
                <p className="text-xs text-gray-500">
                  Keep titles under 60 characters so they display fully in search results.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta-description">Meta Description</Label>
                <Textarea
                  id="meta-description"
                  placeholder="Summarise your storefront in 150–160 characters."
                  value={settings.metaDescription}
                  onChange={handleFieldChange("metaDescription")}
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  Search engines often use this copy. Focus on key value propositions and primary keywords.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta-keywords">Meta Keywords (optional)</Label>
                <Input
                  id="meta-keywords"
                  placeholder="e.g. pool care, pool accessories, pool chemicals"
                  value={settings.metaKeywords}
                  onChange={handleFieldChange("metaKeywords")}
                />
                <p className="text-xs text-gray-500">
                  Optional and largely ignored by modern search engines. Separate each keyword with a comma.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="canonical-url">Canonical URL</Label>
                <Input
                  id="canonical-url"
                  placeholder="https://thepoolshop.africa"
                  value={settings.canonicalUrl}
                  onChange={handleFieldChange("canonicalUrl")}
                />
                <p className="text-xs text-gray-500">
                  Added as the default <code className="font-mono">rel="canonical"</code> for storefront pages.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border border-gray-200", settings.ogImage ? "border-emerald-200" : "")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-indigo-500" />
                Social Sharing
              </CardTitle>
              <CardDescription>
                Control how your store appears when shared on social platforms and messaging apps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="og-title">Open Graph Title</Label>
                  <Input
                    id="og-title"
                    placeholder="This appears on Facebook, LinkedIn & WhatsApp shares"
                    value={settings.ogTitle}
                    onChange={handleFieldChange("ogTitle")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-handle">Twitter / X Handle (optional)</Label>
                  <Input
                    id="twitter-handle"
                    placeholder="@thepoolshop"
                    value={settings.twitterHandle}
                    onChange={handleFieldChange("twitterHandle")}
                  />
                  <p className="text-xs text-gray-500">Do not include the full URL—just the handle.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-description">Social Description</Label>
                <Textarea
                  id="og-description"
                  placeholder="Highlight the benefits customers see when they discover your store."
                  value={settings.ogDescription}
                  onChange={handleFieldChange("ogDescription")}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <Label>Social Share Image</Label>
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex-1 rounded-xl border border-dashed border-gray-300 p-4">
                    {settings.ogImage ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={settings.ogImage}
                          alt="Social preview"
                          className="h-40 w-full rounded-lg object-cover"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 bg-white/90 text-red-600 hover:bg-red-50"
                          onClick={() => setSettings((prev) => ({ ...prev, ogImage: "" }))}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                        1200 × 630px image recommended for best rendering.
                      </div>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2 md:w-48">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleOgImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingOgImage}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingOgImage ? "Uploading..." : "Upload image"}
                    </Button>
                    {settings.ogImage && (
                      <Input
                        readOnly
                        value={settings.ogImage}
                        className="text-xs"
                        onFocus={(event) => event.target.select()}
                      />
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  This image is used for Open Graph and Twitter cards. Use high contrast visuals with minimal text.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "border border-gray-200",
              (settings.pixelEnabled && settings.pixelId) || (settings.gaEnabled && settings.gaMeasurementId)
                ? "border-indigo-200"
                : ""
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivitySquare className="h-5 w-5 text-indigo-500" />
                Tracking & Analytics
              </CardTitle>
              <CardDescription>
                Manage analytics scripts and pixels. These load on every storefront page when enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Meta Pixel</p>
                    <p className="text-xs text-gray-500">
                      Tracks conversions, optimises ads, and builds remarketing audiences across Meta platforms.
                    </p>
                  </div>
                  <Switch
                    checked={settings.pixelEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        pixelEnabled: checked,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixel-id">Meta Pixel ID</Label>
                  <Input
                    id="pixel-id"
                    placeholder="e.g. 123456789012345"
                    value={settings.pixelId}
                    onChange={handleFieldChange("pixelId")}
                    className="max-w-md"
                  />
                  <p className="text-xs text-gray-500">
                    Keep the pixel enabled only when a valid ID is provided to avoid console warnings.
                  </p>
                </div>
                <div className="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-xs text-gray-600">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
                    <Code className="h-4 w-4" />
                    Meta Pixel tips
                  </div>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>The script automatically fires a <code className="font-mono">PageView</code> event on load.</li>
                    <li>Use the Facebook Pixel Helper extension to confirm events fire correctly.</li>
                    <li>You can wire up additional events (AddToCart, Purchase, etc.) in the storefront later.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Google Analytics 4</p>
                    <p className="text-xs text-gray-500">
                      Capture traffic insights and ecommerce events with your GA4 Measurement ID.
                    </p>
                  </div>
                  <Switch
                    checked={settings.gaEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        gaEnabled: checked,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ga-measurement">Measurement ID</Label>
                  <Input
                    id="ga-measurement"
                    placeholder="G-XXXXXXXXXX"
                    value={settings.gaMeasurementId}
                    onChange={handleFieldChange("gaMeasurementId")}
                    className="max-w-md uppercase"
                  />
                  <p className="text-xs text-gray-500">
                    You can find this in Google Analytics under Admin → Data Streams. Starts with <code>G-</code>.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
                  <LinkIcon className="h-4 w-4" />
                  Helpful resources
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <a
                      href="https://www.facebook.com/business/help/952192354843755"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Find your Meta Pixel ID
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://developers.facebook.com/docs/meta-pixel/get-started"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Meta Pixel developer docs
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://support.google.com/analytics/answer/9304139"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Locate your GA4 Measurement ID
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://developers.google.com/analytics/devguides/collection/ga4"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      GA4 developer documentation
                    </a>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

