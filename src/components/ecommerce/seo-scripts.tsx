"use client";

import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: any[]) => void;
  }
}

interface SeoScriptsProps {
  metaPixelId?: string;
  metaPixelEnabled?: boolean;
  gaMeasurementId?: string;
  gaEnabled?: boolean;
}

export function SeoScripts({
  metaPixelId,
  metaPixelEnabled,
  gaMeasurementId,
  gaEnabled,
}: SeoScriptsProps) {
  // Meta Pixel
  useEffect(() => {
    if (!metaPixelEnabled || !metaPixelId || typeof window === "undefined") return;

    if (window.fbq) {
      window.fbq("init", metaPixelId);
      window.fbq("track", "PageView");
    }
  }, [metaPixelId, metaPixelEnabled]);

  // Google Analytics
  useEffect(() => {
    if (!gaEnabled || !gaMeasurementId || typeof window === "undefined") return;

    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", gaMeasurementId, { send_page_view: true });
  }, [gaMeasurementId, gaEnabled]);

  return (
    <>
      {/* Meta Pixel */}
      {metaPixelEnabled && metaPixelId && (
        <Script
          id="facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}

      {/* Google Analytics */}
      {gaEnabled && gaMeasurementId && (
        <>
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          />
          <Script
            id="google-analytics-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}', { send_page_view: true });
              `,
            }}
          />
        </>
      )}
    </>
  );
}

