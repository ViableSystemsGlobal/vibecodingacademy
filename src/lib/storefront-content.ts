import type { Prisma } from "@prisma/client";

export type StorefrontContentKey =
  | "home_promo_banner"
  | "home_hero"
  | "product_promo_banner"
  | "testimonials"
  | "home_categories";

export interface StorefrontContentRecord {
  key: StorefrontContentKey;
  data: Prisma.JsonValue;
  updatedAt?: Date | null;
}

export interface PromoBannerContent {
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  gradient?: string;
  isActive?: boolean;
}

export interface HeroContent {
  slides: Array<{
    id: string;
    eyebrow?: string;
    heading: string;
    subheading?: string;
    description?: string;
    ctaText?: string;
    ctaLink?: string;
    image?: string | null;
    accentColor?: string | null;
  }>;
}

export interface HomepageCategoryTile {
  id: string;
  title: string;
  tagline?: string;
  description?: string;
  href: string;
  image?: string | null;
  accentColor?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export type StorefrontContentMap = Record<StorefrontContentKey, Prisma.JsonValue>;

export const DEFAULT_STOREFRONT_CONTENT: StorefrontContentMap = {
  home_promo_banner: {
    eyebrow: "Limited Time Offer",
    title: "Turn Your Backyard into a Paradise",
    description:
      "Pool floats, lights, speakers, and more—bundle and save with our curated resort-ready kits. Perfect for weekend gatherings and after-hours swims.",
    ctaText: "Shop Backyard Kits",
    ctaHref: "/shop?category=accessories",
    gradient: "from-indigo-600 via-purple-500 to-pink-500",
    isActive: true,
  },
  home_hero: {
    slides: [
      {
        id: "default-hero-1",
        eyebrow: "Summer Essentials",
        heading: "Everything You Need for a Sparkling Pool",
        description: "Shop pumps, filters, chemicals, and accessories curated by professionals.",
        ctaText: "Shop All Products",
        ctaLink: "/shop",
        image: null,
        accentColor: "#23185c",
      },
    ],
  },
  product_promo_banner: {
    eyebrow: "Poolside Upgrade",
    title: "Bundle & Save on Spa Accessories",
    description:
      "Complete your relaxation setup with curated accessories. Members enjoy an extra 10% off when buying two or more.",
    ctaText: "Explore Accessories",
    ctaHref: "/shop?category=accessories",
    gradient: "from-sky-500 via-cyan-500 to-emerald-500",
    isActive: true,
  },
  testimonials: [
    {
      id: "testimonial-1",
      name: "Nana A.",
      role: "Homeowner • Accra",
      rating: 5,
      quote:
        "The digital test kit and delivery service mean we always have what we need, on time.",
      avatarColor: "bg-blue-600",
      avatarImage: null,
      isFeatured: true,
      isActive: true,
      sortOrder: 0,
    },
    {
      id: "testimonial-2",
      name: "Kojo T.",
      role: "Commercial Manager • Tema",
      rating: 5,
      quote:
        "The ecommerce storefront syncs perfectly with the admin backend. Tracking orders, payments, and customer requests has never been this smooth.",
      avatarColor: "bg-emerald-600",
      avatarImage: null,
      isFeatured: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "testimonial-3",
      name: "Ama B.",
      role: "Facility Manager • Kumasi",
      rating: 4,
      quote:
        "We rely on bundled recommendations for seasonal prep. The curated guides and support team keep our pool guest-ready year-round.",
      avatarColor: "bg-amber-500",
      avatarImage: null,
      isFeatured: false,
      isActive: true,
      sortOrder: 2,
    },
  ],
  home_categories: [
    {
      id: "cat-1",
      title: "Pool Maintenance",
      tagline: "Keep it crystal clear",
      description: "Chemicals, testing kits, and automation to simplify maintenance.",
      href: "/shop?category=maintenance",
      image: null,
      accentColor: "#2563eb",
      isActive: true,
      sortOrder: 0,
    },
    {
      id: "cat-2",
      title: "Equipment & Pumps",
      tagline: "Power your pool",
      description: "High-performance pumps, filters, and heaters for any installation.",
      href: "/shop?category=equipment",
      image: null,
      accentColor: "#9333ea",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "cat-3",
      title: "Luxe Accessories",
      tagline: "Style meets comfort",
      description: "Sun loungers, floats, lighting, and audio for unforgettable pool days.",
      href: "/shop?category=accessories",
      image: null,
      accentColor: "#f97316",
      isActive: true,
      sortOrder: 2,
    },
    {
      id: "cat-4",
      title: "Spa & Wellness",
      tagline: "Elevate relaxation",
      description: "Jacuzzi care kits, aromatherapy, and spa-friendly upgrades.",
      href: "/shop?category=spa",
      image: null,
      accentColor: "#0ea5e9",
      isActive: true,
      sortOrder: 3,
    },
  ],
};

export function getDefaultContent(keys?: StorefrontContentKey[]): StorefrontContentMap {
  if (!keys || keys.length === 0) {
    return { ...DEFAULT_STOREFRONT_CONTENT };
  }

  return keys.reduce<StorefrontContentMap>((acc, key) => {
    if (DEFAULT_STOREFRONT_CONTENT[key]) {
      acc[key] = DEFAULT_STOREFRONT_CONTENT[key];
    }
    return acc;
  }, {} as StorefrontContentMap);
}

export function mergeWithDefaults(
  records: Array<{ key: string; data: Prisma.JsonValue; updatedAt?: Date | null }>,
  keys?: StorefrontContentKey[]
): StorefrontContentMap {
  const defaults = getDefaultContent(keys);
  const result: StorefrontContentMap = { ...defaults };

  records.forEach((record) => {
    const key = record.key as StorefrontContentKey;
    if (keys && !keys.includes(key)) {
      return;
    }
    result[key] = record.data ?? defaults[key];
  });

  return result;
}

export function parseKeysParam(param: string | null): StorefrontContentKey[] | undefined {
  if (!param) return undefined;
  const keys = param
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as StorefrontContentKey[];
  return keys.length > 0 ? keys : undefined;
}
