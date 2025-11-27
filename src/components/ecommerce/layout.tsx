"use client";

import { useEffect, useState } from "react";
import { EcommerceNavigation } from "./navigation";
import { EcommerceFooter } from "./footer";
import { CartFlyoutProvider } from "@/contexts/cart-flyout-context";
import { FloatingCartButton } from "./floating-cart-button";
import { CartFlyout } from "./cart-flyout";
import { EcommerceKwameChat } from "./kwame-chat";
import { NewsletterPopup } from "./newsletter-popup";
import { StorefrontSectionsProvider } from "@/contexts/storefront-sections-context";
import { SeoScripts } from "./seo-scripts";

type SeoResponse = {
  meta: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
  social: {
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    twitterHandle: string;
  };
  tracking: {
    metaPixel: {
      pixelId: string;
      enabled: boolean;
    };
    googleAnalytics: {
      measurementId: string;
      enabled: boolean;
    };
  };
};

export function EcommerceLayout({ children }: { children: React.ReactNode }) {
  const [seoData, setSeoData] = useState<SeoResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSeoSettings() {
      try {
        const response = await fetch("/api/public/storefront/seo", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data: SeoResponse = await response.json();
        if (cancelled) return;

        setSeoData(data);
      } catch (error) {
        console.error("Failed to load storefront SEO settings:", error);
      }
    }

    loadSeoSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CartFlyoutProvider>
      <StorefrontSectionsProvider>
        <div className="flex min-h-screen flex-col bg-white">
      <EcommerceNavigation />
        <main className="flex-1">{children}</main>
      <EcommerceFooter />
        <FloatingCartButton />
        <CartFlyout />
          <EcommerceKwameChat />
          <NewsletterPopup />
          {seoData && (
            <SeoScripts
              metaPixelId={seoData.tracking?.metaPixel?.pixelId}
              metaPixelEnabled={seoData.tracking?.metaPixel?.enabled}
              gaMeasurementId={seoData.tracking?.googleAnalytics?.measurementId}
              gaEnabled={seoData.tracking?.googleAnalytics?.enabled}
            />
          )}
    </div>
      </StorefrontSectionsProvider>
    </CartFlyoutProvider>
  );
}
