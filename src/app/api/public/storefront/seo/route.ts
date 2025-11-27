"use server";

import { NextResponse } from "next/server";
import { getStorefrontSeoSettings } from "@/lib/storefront-seo";

export async function GET() {
  try {
    const seo = await getStorefrontSeoSettings();

    return NextResponse.json({
      meta: {
        title: seo.metaTitle,
        description: seo.metaDescription,
        keywords: seo.metaKeywords,
        canonicalUrl: seo.canonicalUrl,
      },
      social: {
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage,
        twitterHandle: seo.twitterHandle,
      },
      tracking: {
        metaPixel: {
          pixelId: seo.pixelId,
          enabled: seo.pixelEnabled && Boolean(seo.pixelId),
        },
        googleAnalytics: {
          measurementId: seo.gaMeasurementId,
          enabled: seo.gaEnabled && Boolean(seo.gaMeasurementId),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching public SEO settings:", error);
    return NextResponse.json(
      {
        meta: {
          title: "",
          description: "",
          keywords: "",
          canonicalUrl: "",
        },
        social: {
          ogTitle: "",
          ogDescription: "",
          ogImage: "",
          twitterHandle: "",
        },
        tracking: {
          metaPixel: {
            pixelId: "",
            enabled: false,
          },
          googleAnalytics: {
            measurementId: "",
            enabled: false,
          },
        },
      },
      { status: 500 }
    );
  }
}

