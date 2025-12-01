"use client";

import { useLoading } from '@/contexts/loading-context';
import { useCallback } from 'react';

/**
 * Custom hook that wraps API calls with automatic loading bar management
 * Usage: const apiCall = useApiCall();
 *        const data = await apiCall(fetch('/api/leads', { method: 'POST', ... }));
 */
export function useApiCall() {
  const { startLoading, stopLoading } = useLoading();

  const apiCall = useCallback(async <T = any>(
    fetchPromise: Promise<Response>,
    options?: {
      showLoading?: boolean; // Default: true
      minLoadingTime?: number; // Minimum time to show loading (ms) - prevents flicker
    }
  ): Promise<T> => {
    const { showLoading = true, minLoadingTime = 300 } = options || {};
    
    if (showLoading) {
      startLoading();
    }

    const startTime = Date.now();

    try {
      const response = await fetchPromise;
      
      // Ensure minimum loading time to prevent flicker
      const elapsed = Date.now() - startTime;
      if (elapsed < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
      }

      if (showLoading) {
        stopLoading();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (showLoading) {
        stopLoading();
      }
      throw error;
    }
  }, [startLoading, stopLoading]);

  return apiCall;
}

/**
 * Utility function to wrap async operations with loading bar
 * This can be used in components that don't use hooks
 * 
 * Usage:
 * import { withLoading } from '@/hooks/use-api-call';
 * import { useLoading } from '@/contexts/loading-context';
 * 
 * const { startLoading, stopLoading } = useLoading();
 * await withLoading(startLoading, stopLoading, async () => {
 *   const response = await fetch('/api/leads', { ... });
 *   return response.json();
 * });
 */
export async function withLoading<T>(
  startLoading: () => void,
  stopLoading: () => void,
  operation: () => Promise<T>,
  minLoadingTime: number = 300
): Promise<T> {
  startLoading();
  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    // Ensure minimum loading time to prevent flicker
    const elapsed = Date.now() - startTime;
    if (elapsed < minLoadingTime) {
      await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
    }
    
    return result;
  } finally {
    stopLoading();
  }
}

