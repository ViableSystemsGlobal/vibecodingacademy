"use client";

import { useEffect } from "react";

export function QueueWorkerStarter() {
  useEffect(() => {
    // Skip during build/SSR
    if (typeof window === 'undefined') {
      return;
    }

    // Initialize queue workers on client side
    // Workers are actually initialized server-side when imported
    // This component just ensures the API endpoint is called to verify workers
    const initWorkers = async () => {
      try {
        await fetch('/api/queue/workers/init', { method: 'POST' });
        console.log('✅ Queue workers initialized');
      } catch (error) {
        // Silently fail - this is OK if Redis is not configured
        console.debug('Queue workers initialization check failed (this is OK if Redis is not configured)');
      }
    };

    // Delay initialization slightly to avoid blocking page load
    const timeout = setTimeout(initWorkers, 1000);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}

