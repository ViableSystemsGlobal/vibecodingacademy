"use server";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorefrontSeoSettings } from "@/lib/storefront-seo";

const PIXEL_ID_KEY = "ecommerce_pixel_id";
const PIXEL_ENABLED_KEY = "ecommerce_pixel_enabled";
const DEFAULT_TITLE_KEY = "ecommerce_seo_default_title";
const DEFAULT_DESCRIPTION_KEY = "ecommerce_seo_default_description";
const DEFAULT_KEYWORDS_KEY = "ecommerce_seo_default_keywords";
const CANONICAL_URL_KEY = "ecommerce_seo_canonical_url";
const OG_TITLE_KEY = "ecommerce_seo_og_title";
const OG_DESCRIPTION_KEY = "ecommerce_seo_og_description";
const OG_IMAGE_KEY = "ecommerce_seo_og_image";
const TWITTER_HANDLE_KEY = "ecommerce_seo_twitter_handle";
const GA_MEASUREMENT_ID_KEY = "ecommerce_ga_measurement_id";
const GA_ENABLED_KEY = "ecommerce_ga_enabled";

async function handleGet() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const seo = await getStorefrontSeoSettings();

    return NextResponse.json({
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      metaKeywords: seo.metaKeywords,
      canonicalUrl: seo.canonicalUrl,
      ogTitle: seo.ogTitle,
      ogDescription: seo.ogDescription,
      ogImage: seo.ogImage,
      twitterHandle: seo.twitterHandle,
      pixelId: seo.pixelId,
      pixelEnabled: seo.pixelEnabled,
      gaMeasurementId: seo.gaMeasurementId,
      gaEnabled: seo.gaEnabled,
    });
  } catch (error) {
    console.error("Error fetching SEO settings:", error);
    return NextResponse.json({ error: "Failed to load SEO settings" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const data = {
      metaTitle: typeof body?.metaTitle === "string" ? body.metaTitle.trim() : "",
      metaDescription:
        typeof body?.metaDescription === "string" ? body.metaDescription.trim() : "",
      metaKeywords: typeof body?.metaKeywords === "string" ? body.metaKeywords.trim() : "",
      canonicalUrl: typeof body?.canonicalUrl === "string" ? body.canonicalUrl.trim() : "",
      ogTitle: typeof body?.ogTitle === "string" ? body.ogTitle.trim() : "",
      ogDescription: typeof body?.ogDescription === "string" ? body.ogDescription.trim() : "",
      ogImage: typeof body?.ogImage === "string" ? body.ogImage.trim() : "",
      twitterHandle: typeof body?.twitterHandle === "string" ? body.twitterHandle.trim() : "",
      pixelId: typeof body?.pixelId === "string" ? body.pixelId.trim() : "",
      pixelEnabled: Boolean(body?.pixelEnabled),
      gaMeasurementId:
        typeof body?.gaMeasurementId === "string" ? body.gaMeasurementId.trim() : "",
      gaEnabled: Boolean(body?.gaEnabled),
    };

    const operations = [
      {
        key: DEFAULT_TITLE_KEY,
        value: data.metaTitle,
      },
      {
        key: DEFAULT_DESCRIPTION_KEY,
        value: data.metaDescription,
      },
      {
        key: DEFAULT_KEYWORDS_KEY,
        value: data.metaKeywords,
      },
      {
        key: CANONICAL_URL_KEY,
        value: data.canonicalUrl,
      },
      {
        key: OG_TITLE_KEY,
        value: data.ogTitle,
      },
      {
        key: OG_DESCRIPTION_KEY,
        value: data.ogDescription,
      },
      {
        key: OG_IMAGE_KEY,
        value: data.ogImage,
      },
      {
        key: TWITTER_HANDLE_KEY,
        value: data.twitterHandle,
      },
      {
        key: PIXEL_ID_KEY,
        value: data.pixelId,
      },
      {
        key: PIXEL_ENABLED_KEY,
        value: data.pixelEnabled ? "true" : "false",
      },
      {
        key: GA_MEASUREMENT_ID_KEY,
        value: data.gaMeasurementId,
      },
      {
        key: GA_ENABLED_KEY,
        value: data.gaEnabled ? "true" : "false",
      },
    ];

    await Promise.all(
      operations.map((operation) =>
        prisma.systemSettings.upsert({
          where: { key: operation.key },
          update: { value: operation.value },
          create: {
            key: operation.key,
            value: operation.value,
            category: "ecommerce",
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving SEO settings:", error);
    return NextResponse.json({ error: "Failed to save SEO settings" }, { status: 500 });
  }
}

export const GET = handleGet;
export const POST = handlePost;