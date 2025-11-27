"use server";

import { prisma } from "@/lib/prisma";

export interface StorefrontSeoSettings {
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

const SETTINGS_KEY_MAP = {
  metaTitle: "ecommerce_seo_default_title",
  metaDescription: "ecommerce_seo_default_description",
  metaKeywords: "ecommerce_seo_default_keywords",
  canonicalUrl: "ecommerce_seo_canonical_url",
  ogTitle: "ecommerce_seo_og_title",
  ogDescription: "ecommerce_seo_og_description",
  ogImage: "ecommerce_seo_og_image",
  twitterHandle: "ecommerce_seo_twitter_handle",
  pixelId: "ecommerce_pixel_id",
  pixelEnabled: "ecommerce_pixel_enabled",
  gaMeasurementId: "ecommerce_ga_measurement_id",
  gaEnabled: "ecommerce_ga_enabled",
} as const;

export async function getStorefrontSeoSettings(): Promise<StorefrontSeoSettings> {
  const settings = await prisma.systemSettings.findMany({
    where: {
      key: {
        in: Object.values(SETTINGS_KEY_MAP),
      },
    },
  });

  const map = settings.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value ?? "";
    return acc;
  }, {});

  return {
    metaTitle: map[SETTINGS_KEY_MAP.metaTitle] ?? "",
    metaDescription: map[SETTINGS_KEY_MAP.metaDescription] ?? "",
    metaKeywords: map[SETTINGS_KEY_MAP.metaKeywords] ?? "",
    canonicalUrl: map[SETTINGS_KEY_MAP.canonicalUrl] ?? "",
    ogTitle: map[SETTINGS_KEY_MAP.ogTitle] ?? "",
    ogDescription: map[SETTINGS_KEY_MAP.ogDescription] ?? "",
    ogImage: map[SETTINGS_KEY_MAP.ogImage] ?? "",
    twitterHandle: map[SETTINGS_KEY_MAP.twitterHandle] ?? "",
    pixelId: map[SETTINGS_KEY_MAP.pixelId] ?? "",
    pixelEnabled: (map[SETTINGS_KEY_MAP.pixelEnabled] ?? "false") === "true",
    gaMeasurementId: map[SETTINGS_KEY_MAP.gaMeasurementId] ?? "",
    gaEnabled: (map[SETTINGS_KEY_MAP.gaEnabled] ?? "false") === "true",
  };
}

