"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface ConditionalAdminComponentsProps {
  children: React.ReactNode;
}

export function ConditionalAdminComponents({ children }: ConditionalAdminComponentsProps) {
  const pathname = usePathname();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Check if we're on shop domain/port
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
      const isAdminDomain = hostname.includes('sms.') || hostname.includes('admin.');
      const adminPorts = new Set(['3001', '3003']);
      const isAdminPort = adminPorts.has(port);
      const isShop = pathname.startsWith('/shop') || 
                     pathname === '/' && (port === '3000' || (!isAdminDomain && !isAdminPort));
      
      // Only render admin components if NOT on shop routes
      setShouldRender(!isShop);
    } else {
      // Server-side: default to false, will be set correctly on client
      setShouldRender(false);
    }
  }, [pathname]);

  // Don't render admin components on shop pages
  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}
