import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/contexts/theme-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { ToastProvider } from "@/contexts/toast-context";
import { LoadingProvider } from "@/contexts/loading-context";
import { CompanyProvider } from "@/contexts/company-context";
import { WishlistProvider as WishlistContextProvider } from "@/contexts/wishlist-context";
import { ToastContainer } from "@/components/toast-container";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { TaskNotificationStarter } from "@/components/task-notification-starter";
import { QueueWorkerStarter } from "@/components/queue-worker-starter";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { AppLayout } from "@/components/layout/app-layout";
import { InitialLoader } from "@/components/initial-loader";
import { ConditionalAdminComponents } from "@/components/conditional-admin-components";
import { CompareProvider as CompareContextProvider } from "@/contexts/compare-context";
import { getStorefrontSeoSettings } from "@/lib/storefront-seo";
import { prisma } from "@/lib/prisma";

const DEFAULT_TITLE = "Sales Management System";
const DEFAULT_DESCRIPTION =
  "A practical, single-tenant system for sales and distribution management";
const DEFAULT_APP_NAME = "The POOLSHOP";
const DEFAULT_THEME_COLOR = "#0f172a";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getStorefrontSeoSettings().catch(() => null);

  // Always fetch company name from settings - this should always be available
  let companyName: string | null = null;
  try {
    const companyNameSetting = await prisma.systemSettings.findUnique({
      where: { key: "company_name" },
    });
    if (companyNameSetting?.value) {
      companyName = companyNameSetting.value;
    }
  } catch (error) {
    console.error("Error fetching company name in metadata:", error);
  }

  // Use SEO title if available, otherwise use company name
  // For homepage, always use company name if available - never show "Sales Management System"
  // The company name should always be available from the database
  const title = seo?.metaTitle?.trim() || (companyName ? `${companyName} | Home` : DEFAULT_APP_NAME);
  const description = seo?.metaDescription?.trim() || DEFAULT_DESCRIPTION;
  const keywordList =
    seo?.metaKeywords
      ?.split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean) ?? [];

  const ogTitle = seo?.ogTitle?.trim() || title;
  const ogDescription = seo?.ogDescription?.trim() || description;
  const ogImageRaw = seo?.ogImage?.trim();
  const canonicalUrl = seo?.canonicalUrl?.trim();
  const twitterHandle = seo?.twitterHandle?.trim();

  // Get company logo as fallback for OG image
  let companyLogo: string | null = null;
  try {
    const companyLogoSetting = await prisma.systemSettings.findUnique({
      where: { key: "company_logo" },
    });
    if (companyLogoSetting?.value) {
      companyLogo = companyLogoSetting.value;
    }
  } catch (error) {
    console.error("Error fetching company logo for OG image:", error);
  }

  // Determine base URL - prioritize canonical URL, then environment variables
  const getBaseUrl = () => {
    if (canonicalUrl) {
      try {
        const url = new URL(canonicalUrl);
        return `${url.protocol}//${url.host}`;
      } catch {
        // Invalid URL, continue to fallbacks
      }
    }
    
    // Try environment variables
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.NEXTAUTH_URL) {
      return process.env.NEXTAUTH_URL;
    }
    
    // Fallback for production - use store domain for shop
    if (process.env.NODE_ENV === 'production') {
      // Check if we're in shop mode
      if (process.env.NEXT_PUBLIC_APP_MODE === 'shop') {
        return 'https://store.thepoolshop.africa';
      }
      // Default to store domain for better social sharing
      return 'https://store.thepoolshop.africa';
    }
    
    return 'http://localhost:3000';
  };

  const baseUrl = getBaseUrl();

  // Convert relative OG image URL to absolute URL for social sharing
  // Use OG image if set, otherwise fallback to company logo
  const imageToUse = ogImageRaw || companyLogo;
  let ogImage: string | undefined;
  if (imageToUse) {
    if (imageToUse.startsWith('http://') || imageToUse.startsWith('https://')) {
      // Already absolute
      ogImage = imageToUse;
    } else {
      // Convert relative to absolute
      ogImage = `${baseUrl}${imageToUse.startsWith('/') ? imageToUse : `/${imageToUse}`}`;
    }
  }

  return {
    title,
    description,
    keywords: keywordList.length > 0 ? keywordList : undefined,
    applicationName: DEFAULT_APP_NAME,
    manifest: "/manifest.webmanifest",
    alternates: {
      canonical: canonicalUrl || undefined,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonicalUrl || baseUrl,
      siteName: companyName || DEFAULT_APP_NAME,
      type: "website",
      locale: "en_US",
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: ogTitle,
            },
          ]
        : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      site: twitterHandle || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/icons/pwa-192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: DEFAULT_APP_NAME,
    },
  };
}

export function generateViewport(): Viewport {
  return {
    themeColor: DEFAULT_THEME_COLOR,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
        return (
          <html lang="en">
            <body className="antialiased" suppressHydrationWarning={true}>
              <HydrationBoundary>
                <BrandingProvider>
                  <ThemeProvider>
                    <LoadingProvider>
                      <ToastProvider>
                        <CompanyProvider>
                          <AuthSessionProvider>
                            <CompareContextProvider>
                              <WishlistContextProvider>
                            <InitialLoader />
                            <ConditionalAdminComponents>
                            <TaskNotificationStarter />
                            <QueueWorkerStarter />
                            </ConditionalAdminComponents>
                            <DynamicFavicon />
                            <AppLayout>
                              {children}
                            </AppLayout>
                            <ToastContainer />
                              </WishlistContextProvider>
                            </CompareContextProvider>
                          </AuthSessionProvider>
                        </CompanyProvider>
                      </ToastProvider>
                    </LoadingProvider>
                  </ThemeProvider>
                </BrandingProvider>
              </HydrationBoundary>
            </body>
          </html>
        );
}
