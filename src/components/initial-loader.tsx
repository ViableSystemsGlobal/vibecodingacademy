'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useTheme } from '@/contexts/theme-context';

export function InitialLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const { status } = useSession();
  const { getThemeColor } = useTheme();

  // Fetch company settings for logo
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        // Try to get logo from branding API first (public endpoint)
        const brandingResponse = await fetch('/api/public/branding');
        if (brandingResponse.ok) {
          const brandingData = await brandingResponse.json();
          // Use companyLogo if available, otherwise fall back to favicon
          if (brandingData.companyLogo) {
            setCompanyLogo(brandingData.companyLogo);
          } else if (brandingData.favicon) {
            setCompanyLogo(brandingData.favicon);
          }
          if (brandingData.companyName) {
            setCompanyName(brandingData.companyName);
          }
        } else {
          // Fallback to company settings API
          const response = await fetch('/api/settings/company');
          if (response.ok) {
            const data = await response.json();
            if (data.favicon) {
              setCompanyLogo(data.favicon);
            }
            if (data.companyName) {
              setCompanyName(data.companyName);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch company settings:', error);
      }
    };

    fetchCompanySettings();
  }, []);

  // Hide loader when session is loaded
  useEffect(() => {
    if (status !== 'loading') {
      // Start fade out animation
      setIsLoading(false);
      
      // Remove from DOM after fade animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 500); // Match the CSS transition duration

      return () => clearTimeout(timer);
    }
  }, [status]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center transition-opacity duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ pointerEvents: isLoading ? 'auto' : 'none' }}
    >
      {/* Logo */}
      {companyLogo && (
        <div className="mb-12 flex items-center justify-center">
          <div className="relative w-80 h-40">
            <Image
              src={companyLogo}
              alt={companyName || 'Company Logo'}
              fill
              className="object-contain"
              priority
              onLoad={(e) => {
                // Logo loaded successfully
                e.currentTarget.style.opacity = '1';
              }}
              style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
            />
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-80 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full animate-progress"
          style={{ backgroundColor: getThemeColor() }}
        ></div>
      </div>
    </div>
  );
}

