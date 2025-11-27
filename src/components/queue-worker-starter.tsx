"use client";

import { useEffect } from "react";

export function QueueWorkerStarter() {
  useEffect(() => {
    // Initialize queue workers on client side
    // Workers are actually initialized server-side when imported
    // This component just ensures the API endpoint is called to verify workers
    const initWorkers = async () => {
      try {
        await fetch('/api/queue/workers/init', { method: 'POST' });
        console.log('✅ Queue workers initialized');
      } catch (error) {
        console.error('⚠️ Queue workers initialization check failed (this is OK if Redis is not configured):', error);
      }
    };

    initWorkers();
  }, []);

  return null;
}

