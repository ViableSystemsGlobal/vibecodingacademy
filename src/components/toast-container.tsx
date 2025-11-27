"use client";

import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/contexts/toast-context';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  const pathname = usePathname();
  const [position, setPosition] = useState<'top-right' | 'bottom-center'>('top-right');

  useEffect(() => {
    const determinePosition = () => {
      if (typeof window === 'undefined') {
        return 'top-right';
      }

      const host = window.location.hostname;
      const port = window.location.port;
      const adminPorts = new Set(['3001', '3003']);
      const isAdminHost = host.includes('sms.') || host.includes('admin.') || adminPorts.has(port);
      const isEcommerceRoute = pathname?.startsWith('/shop') || pathname === '/';

      if (!isAdminHost && isEcommerceRoute) {
        return 'bottom-right';
      }

      return 'top-right';
    };

    setPosition(determinePosition());
  }, [pathname]);

  return <Toaster toasts={toasts} onDismiss={removeToast} position={position} />;
}
