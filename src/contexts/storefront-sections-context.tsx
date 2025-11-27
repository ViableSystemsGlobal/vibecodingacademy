"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface StorefrontSection {
  id: string;
  key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  gradient: string | null;
  media: unknown;
  content: unknown;
  sortOrder: number;
  isActive: boolean;
}

interface StorefrontSectionsContextValue {
  sections: StorefrontSection[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  getSection: (key: string) => StorefrontSection | undefined;
}

const StorefrontSectionsContext = createContext<StorefrontSectionsContextValue | undefined>(undefined);

async function fetchStorefrontSections(): Promise<StorefrontSection[]> {
  try {
    const response = await fetch("/api/public/storefront/sections", {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || "Failed to load storefront sections");
    }

    const payload = (await response.json()) as { sections?: StorefrontSection[] };
    return payload.sections ?? [];
  } catch (error) {
    console.error("Error fetching storefront sections:", error);
    throw error instanceof Error ? error : new Error("Failed to load storefront sections");
  }
}

export function StorefrontSectionsProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = useState<StorefrontSection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await fetchStorefrontSections();
      setSections(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load storefront content";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSections();
  }, [loadSections]);

  const value = useMemo<StorefrontSectionsContextValue>(() => {
    return {
      sections,
      loading,
      error,
      refresh: loadSections,
      getSection: (key: string) => sections.find((section) => section.key === key),
    };
  }, [sections, loading, error, loadSections]);

  return (
    <StorefrontSectionsContext.Provider value={value}>{children}</StorefrontSectionsContext.Provider>
  );
}

export function useStorefrontSections() {
  const context = useContext(StorefrontSectionsContext);
  if (!context) {
    throw new Error("useStorefrontSections must be used within a StorefrontSectionsProvider");
  }
  return context;
}
