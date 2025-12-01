"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface BrandingSettings {
  companyName: string;
  companyLogo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  description: string;
  chatButtonImage?: string;
  heroVideo?: string;
  chatPopupImage?: string;
  chatPopupMessage?: string;
  newsletterPopupImage?: string;
  newsletterPopupHeadline?: string;
  newsletterPopupDescription?: string;
  newsletterPopupSuccessMessage?: string;
  footerLogo?: string;
}

interface BrandingContextType {
  branding: BrandingSettings;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  getThemeColor: () => string;
  getThemeClasses: () => {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    primaryBg: string;
    primaryHover: string;
    primaryText: string;
    primaryBorder: string;
  };
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

// Default branding settings
const defaultBranding: BrandingSettings = {
  companyName: 'AdPools Group',
  companyLogo: '',
  favicon: '/uploads/branding/favicon_1760896671527.jpg',
  primaryColor: '#dc2626', // Red as default
  secondaryColor: '#b91c1c', // Dark red as default
  description: 'A practical, single-tenant system for sales and distribution management',
  chatButtonImage: '',
  chatPopupImage: '',
  chatPopupMessage: "👋 Hi {firstName}! I'm Kwame, your pool care assistant. I can help you find products, explain features, or check on existing orders. What would you like to know?",
  newsletterPopupImage: '',
  newsletterPopupHeadline: 'Get 5% off your first order',
  newsletterPopupDescription: 'Join our newsletter for pool care tips, new arrivals, and exclusive deals.',
  newsletterPopupSuccessMessage: "You're on the list! Check your inbox for poolside inspiration soon.",
  footerLogo: '',
};

// Convert hex color to Tailwind classes
function hexToTailwindClasses(hexColor: string) {
  // Map common hex colors to Tailwind classes
  const colorMap: { [key: string]: string } = {
    '#dc2626': 'red-600',
    '#b91c1c': 'red-700',
    '#8B5CF6': 'purple-600',
    '#7C3AED': 'purple-700',
    '#2563eb': 'blue-600',
    '#1d4ed8': 'blue-700',
    '#16a34a': 'green-600',
    '#15803d': 'green-700',
    '#ea580c': 'orange-600',
    '#c2410c': 'orange-700',
    '#4f46e5': 'indigo-600',
    '#4338ca': 'indigo-700',
    '#db2777': 'pink-600',
    '#be185d': 'pink-700',
    '#0d9488': 'teal-600',
    '#0f766e': 'teal-700',
  };

  // If it's a mapped color, use Tailwind classes
  if (colorMap[hexColor]) {
    const primaryClass = colorMap[hexColor];
    const primaryLight = primaryClass.replace('-600', '-500').replace('-700', '-600');
    const primaryDark = primaryClass.replace('-600', '-700').replace('-500', '-700');
    const primaryBg = primaryClass.replace('-600', '-50').replace('-700', '-50');
    const primaryHover = primaryClass.replace('-600', '-100').replace('-700', '-100');
    const primaryText = primaryClass.replace('-600', '-700').replace('-500', '-700');
    const primaryBorder = primaryClass.replace('-700', '-600').replace('-500', '-600');

    return {
      primary: primaryClass,
      primaryLight,
      primaryDark,
      primaryBg,
      primaryHover,
      primaryText,
      primaryBorder,
    };
  }

  // For custom colors, return hex values that will be used with inline styles
  // We'll generate approximate Tailwind-like variants
  const primaryClass = hexColor;
  return {
    primary: primaryClass,
    primaryLight: adjustHexBrightness(hexColor, 10),
    primaryDark: adjustHexBrightness(hexColor, -10),
    primaryBg: hexToRgba(hexColor, 0.1),
    primaryHover: hexToRgba(hexColor, 0.2),
    primaryText: hexColor,
    primaryBorder: hexColor,
  };
}

// Helper to adjust hex brightness
function adjustHexBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = (num >> 16);
  const G = ((num >> 8) & 0x00FF);
  const B = (num & 0x0000FF);
  return `rgba(${R}, ${G}, ${B}, ${alpha})`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const response = await fetch('/api/public/branding');
      if (response.ok) {
        const data = await response.json();
        setBranding({
          ...defaultBranding,
          ...data,
        });
        
        // Update document title only if company name exists and title is not already set by a page
        if (typeof document !== 'undefined' && data.companyName) {
          // Only set title if it's still the default or contains "AdPools Group"
          const currentTitle = document.title;
          if (!currentTitle || currentTitle === 'AdPools Group' || currentTitle.includes('AdPools Group')) {
            document.title = data.companyName;
          }
        }
        
        // Update favicon
        if (typeof document !== 'undefined' && data.favicon) {
          const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (favicon) {
            favicon.href = data.favicon;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch branding settings:', error);
      // Keep default branding on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const getThemeColor = () => {
    return branding.primaryColor;
  };

  const getThemeClasses = () => {
    return hexToTailwindClasses(branding.primaryColor);
  };

  return (
    <BrandingContext.Provider 
      value={{ 
        branding, 
        loading, 
        refreshBranding: fetchBranding,
        getThemeColor,
        getThemeClasses
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
