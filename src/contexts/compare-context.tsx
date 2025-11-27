"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useCustomerAuth } from "@/contexts/customer-auth-context";

interface CompareItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string | null;
  sku?: string | null;
  categoryName?: string | null;
  inStock?: boolean;
  stockQuantity?: number;
  addedAt: string;
}

interface CompareContextValue {
  items: CompareItem[];
  count: number;
  isLoading: boolean;
  addItem: (
    item: Omit<CompareItem, "addedAt">
  ) => { added: boolean; reason?: "duplicate" | "limit" };
  removeItem: (id: string) => void;
  clear: () => void;
  isInCompare: (id: string) => boolean;
  maxItems: number;
}

const CompareContext = createContext<CompareContextValue | undefined>(undefined);

const STORAGE_KEY = "poolshop-compare-v1";
const DEFAULT_PROFILE = "guest";
const MAX_COMPARE_ITEMS = 4;

type CompareStorage = Record<string, CompareItem[]>;

function safeParseStorage(value: string | null): CompareStorage {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getProfileKey(email?: string | null) {
  if (!email) return DEFAULT_PROFILE;
  return email.trim().toLowerCase() || DEFAULT_PROFILE;
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const { customer } = useCustomerAuth();
  const profileKey = getProfileKey(customer?.email);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storage = safeParseStorage(localStorage.getItem(STORAGE_KEY));
    setItems(storage[profileKey] ?? []);
    setIsLoading(false);
  }, [profileKey]);

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;
    const storage = safeParseStorage(localStorage.getItem(STORAGE_KEY));
    storage[profileKey] = items;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch (error) {
      console.warn("Failed to persist comparison list:", error);
    }
  }, [items, profileKey, isLoading]);

  const addItem: CompareContextValue["addItem"] = (item) => {
    let result: { added: boolean; reason?: "duplicate" | "limit" } = {
      added: false,
    };

    setItems((previous) => {
      if (previous.some((existing) => existing.id === item.id)) {
        result = { added: false, reason: "duplicate" };
        return previous;
      }

      if (previous.length >= MAX_COMPARE_ITEMS) {
        result = { added: false, reason: "limit" };
        return previous;
      }

      result = { added: true };
      return [
        ...previous,
        {
          ...item,
          addedAt: new Date().toISOString(),
        },
      ];
    });

    return result;
  };

  const removeItem = (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  const clear = () => {
    setItems([]);
  };

  const value = useMemo<CompareContextValue>(
    () => ({
      items,
      count: items.length,
      isLoading,
      addItem,
      removeItem,
      clear,
      isInCompare: (id: string) => items.some((item) => item.id === id),
      maxItems: MAX_COMPARE_ITEMS,
    }),
    [items, isLoading]
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
}

