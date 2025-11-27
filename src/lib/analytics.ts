"use client";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}

interface AnalyticsProduct {
  id: string;
  name: string;
  price: number;
  currency?: string;
  quantity?: number;
  category?: string | null;
  sku?: string | null;
}

interface AnalyticsCartPayload {
  items: AnalyticsProduct[];
  value?: number;
  currency?: string;
  transactionId?: string;
  listId?: string;
  listName?: string;
}

const DEFAULT_CURRENCY = "GHS";

function mapItemsForGa(items: AnalyticsProduct[]) {
  return items.map((item) => ({
    item_id: item.id,
    item_name: item.name,
    price: item.price ?? 0,
    quantity: item.quantity ?? 1,
    item_category: item.category ?? undefined,
    item_variant: item.sku ?? undefined,
  }));
}

function mapItemsForPixel(items: AnalyticsProduct[]) {
  return items.map((item) => ({
    id: item.id,
    quantity: item.quantity ?? 1,
    item_price: item.price ?? 0,
  }));
}

function computeValue(items: AnalyticsProduct[], fallbackValue?: number) {
  if (typeof fallbackValue === "number" && !Number.isNaN(fallbackValue)) {
    return fallbackValue;
  }

  return items.reduce((total, item) => {
    const quantity = item.quantity ?? 1;
    return total + (item.price ?? 0) * quantity;
  }, 0);
}

function getCurrency(items: AnalyticsProduct[], fallbackCurrency?: string) {
  return (
    fallbackCurrency ||
    items.find((item) => item.currency)?.currency ||
    DEFAULT_CURRENCY
  );
}

function pushDataLayer(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    ecommerce: payload,
  });
}

function normalizeItems(items: AnalyticsProduct[], fallbackCurrency?: string) {
  return items.map((item) => ({
    ...item,
    quantity: item.quantity ?? 1,
    currency: item.currency || fallbackCurrency || DEFAULT_CURRENCY,
  }));
}

export function trackAddToCart(product: AnalyticsProduct) {
  if (typeof window === "undefined") return;

  const normalized: AnalyticsProduct = {
    ...product,
    quantity: product.quantity ?? 1,
    currency: product.currency || DEFAULT_CURRENCY,
  };
  const value = computeValue([normalized]);
  const currency = getCurrency([normalized]);

  // Google Analytics (gtag)
  window.gtag?.("event", "add_to_cart", {
    currency,
    value,
    items: mapItemsForGa([normalized]),
  });

  // Google Tag Manager dataLayer
  pushDataLayer("add_to_cart", {
    currency,
    value,
    items: mapItemsForGa([normalized]),
  });

  // Meta Pixel
  window.fbq?.("track", "AddToCart", {
    currency,
    value,
    content_ids: [normalized.id],
    content_name: normalized.name,
    content_type: "product",
    contents: mapItemsForPixel([normalized]),
  });
}

export function trackBeginCheckout(payload: AnalyticsCartPayload) {
  if (typeof window === "undefined") return;

  const items = normalizeItems(payload.items, payload.currency);
  const value = computeValue(items, payload.value);
  const currency = getCurrency(items, payload.currency);
  const totalQuantity = items.reduce((total, item) => total + (item.quantity ?? 1), 0);

  window.gtag?.("event", "begin_checkout", {
    currency,
    value,
    items: mapItemsForGa(items),
  });

  pushDataLayer("begin_checkout", {
    currency,
    value,
    items: mapItemsForGa(items),
  });

  window.fbq?.("track", "InitiateCheckout", {
    currency,
    value,
    num_items: totalQuantity,
    contents: mapItemsForPixel(items),
    content_type: "product",
  });
}

export function trackPurchase(payload: AnalyticsCartPayload) {
  if (typeof window === "undefined" || !payload.transactionId) return;

  const items = normalizeItems(payload.items, payload.currency);
  const value = computeValue(items, payload.value);
  const currency = getCurrency(items, payload.currency);

  window.gtag?.("event", "purchase", {
    transaction_id: payload.transactionId,
    currency,
    value,
    items: mapItemsForGa(items),
  });

  pushDataLayer("purchase", {
    transaction_id: payload.transactionId,
    currency,
    value,
    items: mapItemsForGa(items),
  });

  window.fbq?.("track", "Purchase", {
    currency,
    value,
    contents: mapItemsForPixel(items),
    content_type: "product",
  });
}

export function trackViewItem(product: AnalyticsProduct) {
  if (typeof window === "undefined") return;

  const normalized = normalizeItems([product])[0];
  const value = computeValue([normalized]);
  const currency = getCurrency([normalized]);

  window.gtag?.("event", "view_item", {
    currency,
    value,
    items: mapItemsForGa([normalized]),
  });

  pushDataLayer("view_item", {
    currency,
    value,
    items: mapItemsForGa([normalized]),
  });

  window.fbq?.("track", "ViewContent", {
    currency,
    value,
    content_ids: [normalized.id],
    content_name: normalized.name,
    content_type: "product",
    contents: mapItemsForPixel([normalized]),
  });
}

export function trackViewItemList(payload: AnalyticsCartPayload) {
  if (typeof window === "undefined" || payload.items.length === 0) return;

  const items = normalizeItems(payload.items, payload.currency);
  const value = computeValue(items, payload.value);
  const currency = getCurrency(items, payload.currency);
  const gaItems = mapItemsForGa(
    items.map((item) => ({
      ...item,
      category: item.category ?? payload.listName ?? undefined,
    }))
  ).map((item, index) => ({
    ...item,
    item_list_id: payload.listId ?? payload.listName ?? undefined,
    item_list_name: payload.listName ?? undefined,
    index,
  }));

  window.gtag?.("event", "view_item_list", {
    currency,
    value,
    items: gaItems,
  });

  pushDataLayer("view_item_list", {
    item_list_id: payload.listId ?? payload.listName ?? undefined,
    item_list_name: payload.listName ?? undefined,
    currency,
    value,
    items: gaItems,
  });
}

