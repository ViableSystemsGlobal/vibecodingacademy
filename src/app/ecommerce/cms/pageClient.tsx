"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/contexts/toast-context";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Star,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_STOREFRONT_CONTENT } from "@/lib/storefront-content";
import { useTheme } from "@/contexts/theme-context";

interface StorefrontSection {
  id?: string;
  key: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  gradient?: string | null;
  media?: unknown;
  content?: unknown;
  sortOrder?: number;
  isActive?: boolean;
}

interface SectionFormState {
  id?: string;
  key: string;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  gradient: string;
  media: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
}

const SECTION_TEMPLATES: Array<{
  key: string;
  label: string;
  description: string;
  defaultGradient: string;
}> = [
  {
    key: "homepage_promo",
    label: "Homepage Promo Banner",
    description: "Appears near the bottom of the homepage to promote special offers or campaigns.",
    defaultGradient: "from-blue-600 via-sky-500 to-cyan-400",
  },
  {
    key: "shop_promo",
    label: "Shop Page Promo Card",
    description: "Promotional banner displayed at the bottom of the shop page, before the footer.",
    defaultGradient: "from-sky-500 via-blue-600 to-indigo-700",
  },
  {
    key: "homepage_special_deal",
    label: "Today's Special Deal",
    description: "The promotional banner next to Best Deals on the homepage.",
    defaultGradient: "from-emerald-600 via-emerald-500 to-emerald-700",
  },
  {
    key: "product_reco_promo",
    label: "Product Detail Promo",
    description: "Displayed beneath the recommended products on every product detail page.",
    defaultGradient: "from-indigo-600 via-purple-500 to-pink-500",
  },
];

const HIDDEN_SECTION_KEYS = new Set<string>(["homepage_hero", "homepage_promo", "product_reco_promo", "homepage_special_deal", "shop_promo", "contact_banner", "footer_content"]);

const DEFAULT_SECTION_STATE = (template: { key: string; label: string; defaultGradient: string }): SectionFormState => ({
  id: undefined,
  key: template.key,
  label: template.label,
  title: "",
  subtitle: "",
  description: "",
  ctaText: "",
  ctaLink: "",
  gradient: template.defaultGradient,
  media: "",
  content: "",
  sortOrder: 0,
  isActive: true,
});

interface TestimonialFormState {
  id?: string;
  name: string;
  role: string;
  rating: number;
  quote: string;
  avatarColor: string;
  avatarImage: string;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
}

const DEFAULT_TESTIMONIAL_STATE = (): TestimonialFormState => ({
  id: undefined,
  name: "",
  role: "",
  rating: 5,
  quote: "",
  avatarColor: "#2563eb",
  avatarImage: "",
  isFeatured: false,
  isActive: true,
  sortOrder: 0,
});

interface CategoryTileFormState {
  id?: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  image: string;
  accentColor: string;
  isActive: boolean;
  sortOrder: number;
}

const DEFAULT_CATEGORY_TILE_STATE = (): CategoryTileFormState => ({
  id: undefined,
  title: "",
  tagline: "",
  description: "",
  href: "/shop",
  image: "",
  accentColor: "#2563eb",
  isActive: true,
  sortOrder: 0,
});

const CATEGORY_FIELD_DEFAULTS = DEFAULT_CATEGORY_TILE_STATE();

const normalizeCategoryTile = (
  tile: Partial<CategoryTileFormState> | null | undefined,
  indexFallback = 0
): CategoryTileFormState => {
  const base = DEFAULT_CATEGORY_TILE_STATE();
  if (!tile) {
    return {
      ...base,
      sortOrder: indexFallback,
    };
  }
  return {
    ...base,
    ...tile,
    id: tile.id ?? base.id,
    title: typeof tile.title === "string" ? tile.title : base.title,
    tagline: typeof tile.tagline === "string" ? tile.tagline : base.tagline,
    description: typeof tile.description === "string" ? tile.description : base.description,
    href: typeof tile.href === "string" && tile.href.trim() ? tile.href : base.href,
    image: typeof tile.image === "string" ? tile.image : base.image,
    accentColor: typeof tile.accentColor === "string" ? tile.accentColor : base.accentColor,
    isActive: tile.isActive ?? base.isActive,
    sortOrder:
      typeof tile.sortOrder === "number" && Number.isFinite(tile.sortOrder)
        ? tile.sortOrder
        : indexFallback,
  };
};

interface HeroSlideFormState {
  id?: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  image: string;
  accentColor: string;
  sortOrder: number;
  isActive: boolean;
}

const generateHeroSlideId = () =>
  `hero-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;

const DEFAULT_HERO_SLIDE_STATE = (): HeroSlideFormState => ({
  id: generateHeroSlideId(),
  eyebrow: "",
  heading: "",
  subheading: "",
  description: "",
  ctaText: "",
  ctaLink: "/shop",
  image: "",
  accentColor: "#23185c",
  sortOrder: 0,
  isActive: true,
});

const HERO_FIELD_DEFAULTS = DEFAULT_HERO_SLIDE_STATE();

const normalizeHeroSlide = (
  slide: Partial<HeroSlideFormState> | null | undefined,
  indexFallback = 0
): HeroSlideFormState => {
  const base = DEFAULT_HERO_SLIDE_STATE();
  if (!slide) {
    return {
      ...base,
      id: generateHeroSlideId(),
      sortOrder: indexFallback,
    };
  }

  return {
    ...base,
    ...slide,
    id:
      typeof slide.id === "string" && slide.id.trim()
        ? slide.id
        : `${generateHeroSlideId()}-${indexFallback}`,
    eyebrow: typeof slide.eyebrow === "string" ? slide.eyebrow : base.eyebrow,
    heading: typeof slide.heading === "string" ? slide.heading : base.heading,
    subheading: typeof slide.subheading === "string" ? slide.subheading : base.subheading,
    description: typeof slide.description === "string" ? slide.description : base.description,
    ctaText: typeof slide.ctaText === "string" ? slide.ctaText : base.ctaText,
    ctaLink: typeof slide.ctaLink === "string" && slide.ctaLink.trim() ? slide.ctaLink : base.ctaLink,
    image: typeof slide.image === "string" ? slide.image : base.image,
    accentColor: typeof slide.accentColor === "string" ? slide.accentColor : base.accentColor,
    sortOrder:
      typeof slide.sortOrder === "number" && Number.isFinite(slide.sortOrder)
        ? slide.sortOrder
        : indexFallback,
    isActive: slide.isActive ?? base.isActive,
  };
};

interface PromoBannerFormState {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  gradient: string;
  isActive: boolean;
}

const DEFAULT_PROMO_BANNER_STATE = (): PromoBannerFormState => ({
  eyebrow: "Limited Time Offer",
  title: "Turn Your Backyard into a Paradise",
  description:
    "Pool floats, lights, speakers, and more—bundle and save with our curated resort-ready kits. Perfect for weekend gatherings and after-hours swims.",
  ctaText: "Shop Backyard Kits",
  ctaHref: "/shop?category=accessories",
  gradient: "from-indigo-600 via-purple-500 to-pink-500",
  isActive: true,
});

const PROMO_FIELD_DEFAULTS = DEFAULT_PROMO_BANNER_STATE();

const normalizePromoBanner = (
  banner: Partial<PromoBannerFormState> | null | undefined
): PromoBannerFormState => {
  const base = DEFAULT_PROMO_BANNER_STATE();
  if (!banner) {
    return { ...base };
  }

  return {
    ...base,
    ...banner,
    eyebrow: typeof banner.eyebrow === "string" ? banner.eyebrow : base.eyebrow,
    title: typeof banner.title === "string" ? banner.title : base.title,
    description: typeof banner.description === "string" ? banner.description : base.description,
    ctaText: typeof banner.ctaText === "string" ? banner.ctaText : base.ctaText,
    ctaHref:
      typeof banner.ctaHref === "string" && banner.ctaHref.trim() ? banner.ctaHref : base.ctaHref,
    gradient: typeof banner.gradient === "string" ? banner.gradient : base.gradient,
    isActive: banner.isActive ?? base.isActive,
  };
};

interface ProductPromoFormState {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  gradient: string;
  isActive: boolean;
}

const DEFAULT_PRODUCT_PROMO_STATE = (): ProductPromoFormState => ({
  eyebrow: "Poolside Upgrade",
  title: "Bundle & Save on Spa Accessories",
  description:
    "Complete your relaxation setup with curated accessories. Members enjoy an extra 10% off when buying two or more.",
  ctaText: "Explore Accessories",
  ctaHref: "/shop?category=accessories",
  gradient: "from-sky-500 via-cyan-500 to-emerald-500",
  isActive: true,
});

const PRODUCT_PROMO_FIELD_DEFAULTS = DEFAULT_PRODUCT_PROMO_STATE();

const normalizeProductPromo = (
  banner: Partial<ProductPromoFormState> | null | undefined
): ProductPromoFormState => {
  const base = DEFAULT_PRODUCT_PROMO_STATE();
  if (!banner) {
    return { ...base };
  }

  return {
    ...base,
    ...banner,
    eyebrow: typeof banner.eyebrow === "string" ? banner.eyebrow : base.eyebrow,
    title: typeof banner.title === "string" ? banner.title : base.title,
    description: typeof banner.description === "string" ? banner.description : base.description,
    ctaText: typeof banner.ctaText === "string" ? banner.ctaText : base.ctaText,
    ctaHref:
      typeof banner.ctaHref === "string" && banner.ctaHref.trim() ? banner.ctaHref : base.ctaHref,
    gradient: typeof banner.gradient === "string" ? banner.gradient : base.gradient,
    isActive: banner.isActive ?? base.isActive,
  };
};

interface ContactBannerFormState {
  phone1: string;
  phone1Hours: string;
  phone2: string;
  phone2Hours: string;
  isActive: boolean;
}

const DEFAULT_CONTACT_BANNER_STATE = (): ContactBannerFormState => ({
  phone1: "+233 59 691 1818",
  phone1Hours: "8am - 5pm",
  phone2: "+233 56 111 2777",
  phone2Hours: "5pm till 8am",
  isActive: true,
});

const normalizeContactBanner = (
  banner: Partial<ContactBannerFormState> | null | undefined
): ContactBannerFormState => {
  const base = DEFAULT_CONTACT_BANNER_STATE();
  if (!banner) {
    return { ...base };
  }

  return {
    ...base,
    ...banner,
    phone1: typeof banner.phone1 === "string" ? banner.phone1 : base.phone1,
    phone1Hours: typeof banner.phone1Hours === "string" ? banner.phone1Hours : base.phone1Hours,
    phone2: typeof banner.phone2 === "string" ? banner.phone2 : base.phone2,
    phone2Hours: typeof banner.phone2Hours === "string" ? banner.phone2Hours : base.phone2Hours,
    isActive: banner.isActive ?? base.isActive,
  };
};

interface FooterContentFormState {
  description: string;
  address: string;
  phone: string;
  email: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  privacyPolicyLink: string;
  termsLink: string;
  isActive: boolean;
}

const DEFAULT_FOOTER_CONTENT_STATE = (): FooterContentFormState => ({
  description: "Your one-stop shop for premium pool products, accessories, and expert solutions",
  address: "123 Pool Street\nAccra, Ghana",
  phone: "+233 123 456 789",
  email: "info@thepoolshop.africa",
  facebookUrl: "https://facebook.com",
  twitterUrl: "https://twitter.com",
  instagramUrl: "https://instagram.com",
  linkedinUrl: "https://linkedin.com",
  privacyPolicyLink: "/shop/privacy",
  termsLink: "/shop/terms",
  isActive: true,
});

const normalizeFooterContent = (
  content: Partial<FooterContentFormState> | null | undefined
): FooterContentFormState => {
  const base = DEFAULT_FOOTER_CONTENT_STATE();
  if (!content) {
    return { ...base };
  }

  return {
    ...base,
    ...content,
    description: typeof content.description === "string" ? content.description : base.description,
    address: typeof content.address === "string" ? content.address : base.address,
    phone: typeof content.phone === "string" ? content.phone : base.phone,
    email: typeof content.email === "string" ? content.email : base.email,
    facebookUrl: typeof content.facebookUrl === "string" ? content.facebookUrl : base.facebookUrl,
    twitterUrl: typeof content.twitterUrl === "string" ? content.twitterUrl : base.twitterUrl,
    instagramUrl: typeof content.instagramUrl === "string" ? content.instagramUrl : base.instagramUrl,
    linkedinUrl: typeof content.linkedinUrl === "string" ? content.linkedinUrl : base.linkedinUrl,
    privacyPolicyLink: typeof content.privacyPolicyLink === "string" ? content.privacyPolicyLink : base.privacyPolicyLink,
    termsLink: typeof content.termsLink === "string" ? content.termsLink : base.termsLink,
    isActive: content.isActive ?? base.isActive,
  };
};

function serializeJson(value: unknown): string {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.warn("Failed to serialize JSON", error);
    return "";
  }
}

function parseJsonInput(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error("Invalid JSON format");
  }
}

export default function EcommerceCmsClient() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { getThemeColor } = useTheme();
  const themeColor = getThemeColor() || "#2563eb";
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [sections, setSections] = useState<Record<string, SectionFormState>>({});
  const [initialSections, setInitialSections] = useState<Record<string, SectionFormState>>({});
  const [customKeyDraft, setCustomKeyDraft] = useState("");
  const [customLabelDraft, setCustomLabelDraft] = useState("");
  const [testimonials, setTestimonials] = useState<TestimonialFormState[]>([]);
  const [initialTestimonials, setInitialTestimonials] = useState<TestimonialFormState[]>([]);
  const [savingTestimonials, setSavingTestimonials] = useState(false);
  const [uploadingTestimonialIndex, setUploadingTestimonialIndex] = useState<number | null>(null);
  const [heroSlides, setHeroSlides] = useState<HeroSlideFormState[]>(
    (() => {
      const defaults =
        ((DEFAULT_STOREFRONT_CONTENT.home_hero as { slides: HeroSlideFormState[] }).slides ?? []) ||
        [];
      return defaults.map((slide, index) => normalizeHeroSlide(slide, index));
    })()
  );
  const [initialHeroSlides, setInitialHeroSlides] = useState<HeroSlideFormState[]>(
    JSON.parse(JSON.stringify(heroSlides))
  );
  const [savingHeroSlides, setSavingHeroSlides] = useState(false);
  const [uploadingHeroIndex, setUploadingHeroIndex] = useState<number | null>(null);
  const [promoBanner, setPromoBanner] = useState<PromoBannerFormState>(
    normalizePromoBanner(
      (DEFAULT_STOREFRONT_CONTENT.home_promo_banner as PromoBannerFormState) ||
        DEFAULT_PROMO_BANNER_STATE()
    )
  );
  const [initialPromoBanner, setInitialPromoBanner] = useState<PromoBannerFormState>(
    JSON.parse(JSON.stringify(promoBanner))
  );
  const [savingPromoBanner, setSavingPromoBanner] = useState(false);
  const [productPromo, setProductPromo] = useState<ProductPromoFormState>(
    normalizeProductPromo(
      (DEFAULT_STOREFRONT_CONTENT.product_promo_banner as ProductPromoFormState) ||
        DEFAULT_PRODUCT_PROMO_STATE()
    )
  );
  const [initialProductPromo, setInitialProductPromo] = useState<ProductPromoFormState>(
    JSON.parse(JSON.stringify(productPromo))
  );
  const [savingProductPromo, setSavingProductPromo] = useState(false);
  const [categoryTiles, setCategoryTiles] = useState<CategoryTileFormState[]>(
    (() => {
      const defaults =
        (DEFAULT_STOREFRONT_CONTENT.home_categories as CategoryTileFormState[]) || [];
      return defaults
        .filter((tile) => tile?.isActive !== false)
        .map((tile, index) => normalizeCategoryTile(tile, index));
    })()
  );
  const [initialCategoryTiles, setInitialCategoryTiles] = useState<CategoryTileFormState[]>(
    JSON.parse(JSON.stringify(categoryTiles))
  );
  const [savingCategoryTiles, setSavingCategoryTiles] = useState(false);
  const [uploadingCategoryIndex, setUploadingCategoryIndex] = useState<number | null>(null);
  const [uploadingSectionKey, setUploadingSectionKey] = useState<string | null>(null);
  const [contactBanner, setContactBanner] = useState<ContactBannerFormState>(DEFAULT_CONTACT_BANNER_STATE());
  const [initialContactBanner, setInitialContactBanner] = useState<ContactBannerFormState>(JSON.parse(JSON.stringify(contactBanner)));
  const [savingContactBanner, setSavingContactBanner] = useState(false);
  const [footerContent, setFooterContent] = useState<FooterContentFormState>(DEFAULT_FOOTER_CONTENT_STATE());
  const [initialFooterContent, setInitialFooterContent] = useState<FooterContentFormState>(JSON.parse(JSON.stringify(footerContent)));
  const [savingFooterContent, setSavingFooterContent] = useState(false);

  const orderedKeys = useMemo(() => {
    return Object.values(sections)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .map((section) => section.key);
  }, [sections]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const [sectionsResponse, testimonialsResponse, contentResponse, contactBannerResponse, footerContentResponse] = await Promise.all([
        fetch("/api/settings/storefront/sections", {
          credentials: "include",
        }),
        fetch("/api/settings/storefront/testimonials", {
          credentials: "include",
        }),
        fetch(
          "/api/settings/storefront/content?keys=home_categories,home_hero,home_promo_banner,product_promo_banner",
          {
            credentials: "include",
          }
        ),
        fetch("/api/public/storefront/sections/contact_banner"),
        fetch("/api/public/storefront/sections/footer_content"),
      ]);

      if (!sectionsResponse.ok) {
        const payload = await sectionsResponse.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load storefront sections");
      }

      const sectionsPayload = (await sectionsResponse.json()) as {
        sections: StorefrontSection[];
      };
      const existingSections = sectionsPayload.sections ?? [];

      const baseSections = SECTION_TEMPLATES.map((template) => {
        const match = existingSections.find((section) => section.key === template.key);
        return toFormState(template, match);
      });

      const additionalSections = existingSections
        .filter(
          (section) =>
            !SECTION_TEMPLATES.some((template) => template.key === section.key) &&
            !HIDDEN_SECTION_KEYS.has(section.key ?? "")
        )
        .map((section) =>
          toFormState(
            {
              key: section.key,
              label: humanizeKey(section.key),
              description: "Custom storefront section",
              defaultGradient: "from-slate-900 via-slate-700 to-slate-500",
            },
            section
          )
        );

      const mappedSections: Record<string, SectionFormState> = {};
      [...baseSections, ...additionalSections].forEach((section) => {
        mappedSections[section.key] = section;
      });

      setSections(mappedSections);
      setInitialSections(JSON.parse(JSON.stringify(mappedSections)));

      if (testimonialsResponse.ok) {
        const testimonialsPayload = (await testimonialsResponse.json()) as {
          testimonials?: Array<{
            id: string;
            name: string;
            role?: string | null;
            rating?: number;
            quote: string;
            avatarColor?: string | null;
            avatarImage?: string | null;
            isFeatured?: boolean;
            isActive?: boolean;
            sortOrder?: number;
          }>;
        };

        const incomingTestimonials =
          testimonialsPayload.testimonials?.map((testimonial) => toTestimonialForm(testimonial)) ??
          [];
        const normalizedTestimonials = reindexTestimonials(incomingTestimonials);

        setTestimonials(normalizedTestimonials);
        setInitialTestimonials(JSON.parse(JSON.stringify(normalizedTestimonials)));
      } else {
        const payload = await testimonialsResponse.json().catch(() => ({}));
        const testimonialsFallback =
          (payload?.testimonials as TestimonialFormState[]) ?? [];
        const normalizedFallback = reindexTestimonials(
          testimonialsFallback.map((testimonial) => toTestimonialForm(testimonial))
        );
        setTestimonials(normalizedFallback);
        setInitialTestimonials(JSON.parse(JSON.stringify(normalizedFallback)));
      }

      if (contentResponse.ok) {
        const contentPayload = (await contentResponse.json()) as {
          content?: {
            home_categories?: CategoryTileFormState[];
            home_hero?: { slides?: HeroSlideFormState[] };
            home_promo_banner?: PromoBannerFormState;
            product_promo_banner?: ProductPromoFormState;
          };
        };

        const promoBannerData = contentPayload?.content?.home_promo_banner;
        const normalizedPromo = normalizePromoBanner(promoBannerData);
        setPromoBanner(normalizedPromo);
        setInitialPromoBanner(JSON.parse(JSON.stringify(normalizedPromo)));

        const productPromoData = contentPayload?.content?.product_promo_banner;
        const normalizedProductPromo = normalizeProductPromo(productPromoData);
        setProductPromo(normalizedProductPromo);
        setInitialProductPromo(JSON.parse(JSON.stringify(normalizedProductPromo)));

        const heroSlidesData =
          contentPayload?.content?.home_hero?.slides ??
          (DEFAULT_STOREFRONT_CONTENT.home_hero as { slides: HeroSlideFormState[] }).slides ??
          [];
        const normalizedHeroSlides = reindexHeroSlides(
          heroSlidesData.map((slide, index) => normalizeHeroSlide(slide, index))
        );
        setHeroSlides(normalizedHeroSlides);
        setInitialHeroSlides(JSON.parse(JSON.stringify(normalizedHeroSlides)));

        const tiles =
          (contentPayload?.content?.home_categories as CategoryTileFormState[]) ||
          ((DEFAULT_STOREFRONT_CONTENT.home_categories as CategoryTileFormState[]) || []);
        const normalizedTiles = reindexCategoryTiles(
          tiles
            .filter((tile) => tile?.isActive !== false)
            .map((tile, index) => normalizeCategoryTile(tile, index))
        );
        setCategoryTiles(normalizedTiles);
        setInitialCategoryTiles(JSON.parse(JSON.stringify(normalizedTiles)));
      } else {
        const fallbackPromo = normalizePromoBanner(
          DEFAULT_STOREFRONT_CONTENT.home_promo_banner as PromoBannerFormState
        );
        setPromoBanner(fallbackPromo);
        setInitialPromoBanner(JSON.parse(JSON.stringify(fallbackPromo)));

        const fallbackProductPromo = normalizeProductPromo(
          DEFAULT_STOREFRONT_CONTENT.product_promo_banner as ProductPromoFormState
        );
        setProductPromo(fallbackProductPromo);
        setInitialProductPromo(JSON.parse(JSON.stringify(fallbackProductPromo)));

        const defaultSlides =
          (DEFAULT_STOREFRONT_CONTENT.home_hero as { slides: HeroSlideFormState[] }).slides ?? [];
        const normalizedHeroSlides = reindexHeroSlides(
          defaultSlides.map((slide, index) => normalizeHeroSlide(slide, index))
        );
        setHeroSlides(normalizedHeroSlides);
        setInitialHeroSlides(JSON.parse(JSON.stringify(normalizedHeroSlides)));

        const fallback =
          ((DEFAULT_STOREFRONT_CONTENT.home_categories as CategoryTileFormState[]) || []).map(
            (tile, index) => normalizeCategoryTile(tile, index)
          );
        const normalizedFallback = reindexCategoryTiles(
          fallback.filter((tile) => tile.isActive !== false)
        );
        setCategoryTiles(normalizedFallback);
        setInitialCategoryTiles(JSON.parse(JSON.stringify(normalizedFallback)));
      }

      // Load contact banner
      if (contactBannerResponse.ok) {
        const contactBannerData = await contactBannerResponse.json();
        if (contactBannerData?.section?.content) {
          const parsed = typeof contactBannerData.section.content === 'string' 
            ? JSON.parse(contactBannerData.section.content) 
            : contactBannerData.section.content;
          const normalized = normalizeContactBanner(parsed);
          setContactBanner(normalized);
          setInitialContactBanner(JSON.parse(JSON.stringify(normalized)));
        }
      }

      // Load footer content
      if (footerContentResponse.ok) {
        const footerContentData = await footerContentResponse.json();
        if (footerContentData?.section?.content) {
          const parsed = typeof footerContentData.section.content === 'string'
            ? JSON.parse(footerContentData.section.content)
            : footerContentData.section.content;
          const normalized = normalizeFooterContent(parsed);
          setFooterContent(normalized);
          setInitialFooterContent(JSON.parse(JSON.stringify(normalized)));
        }
      }
    } catch (error) {
      console.error("Error loading storefront content:", error);
      toastError(
        "Failed to load storefront content",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const hasUnsavedChanges = useMemo(() => {
    const sectionDirty = Object.keys(sections).some((key) =>
      isSectionDirty(initialSections[key], sections[key])
    );
    const testimonialDirty = testimonialsDirty(initialTestimonials, testimonials);
    const heroDirty = heroSlidesDirty(initialHeroSlides, heroSlides);
    const promoDirty = isPromoBannerDirty(initialPromoBanner, promoBanner);
    const productPromoDirty = isProductPromoDirty(initialProductPromo, productPromo);
    const categoryDirty = categoryTilesDirty(initialCategoryTiles, categoryTiles);
    return (
      sectionDirty ||
      testimonialDirty ||
      heroDirty ||
      promoDirty ||
      productPromoDirty ||
      categoryDirty
    );
  }, [
    initialSections,
    sections,
    initialTestimonials,
    testimonials,
    initialHeroSlides,
    heroSlides,
    initialPromoBanner,
    promoBanner,
    initialProductPromo,
    productPromo,
    initialCategoryTiles,
    categoryTiles,
  ]);

  const handleSectionChange = <Field extends keyof Omit<SectionFormState, "key" | "label">>(
    key: string,
    field: Field,
    value: SectionFormState[Field]
  ) => {
    setSections((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleResetSection = (key: string) => {
    const initial = initialSections[key];
    if (!initial) return;
    setSections((prev) => ({
      ...prev,
      [key]: JSON.parse(JSON.stringify(initial)),
    }));
  };

  const handleTestimonialChange = <
    Field extends keyof Omit<TestimonialFormState, "id" | "sortOrder">
  >(
    index: number,
    field: Field,
    value: TestimonialFormState[Field]
  ) => {
    setTestimonials((prev) => {
      const next = [...prev];
      const updated: TestimonialFormState = {
        ...next[index],
        [field]:
          field === "rating"
            ? Math.min(5, Math.max(1, Number(value ?? 0))) || 5
            : value ?? "",
      } as TestimonialFormState;
      next[index] = updated;
      return reindexTestimonials(next);
    });
  };

  const handleToggleFeatured = (index: number, value: boolean) => {
    setTestimonials((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isFeatured: value,
      };
      return reindexTestimonials(next);
    });
  };

  const handleToggleTestimonialActive = (index: number, value: boolean) => {
    setTestimonials((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isActive: value,
      };
      return reindexTestimonials(next);
    });
  };

  const handleUploadTestimonialAvatar = async (index: number, file: File) => {
    setUploadingTestimonialIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "testimonials");

      const response = await fetch("/api/upload/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to upload avatar");
      }

      const payload = await response.json();
      handleTestimonialChange(index, "avatarImage", payload.url as string);
      toastSuccess("Avatar uploaded", "Testimonial avatar image updated.");
    } catch (error) {
      console.error("Error uploading testimonial avatar:", error);
      toastError(
        "Upload failed",
        error instanceof Error ? error.message : "Unable to upload avatar image"
      );
    } finally {
      setUploadingTestimonialIndex(null);
    }
  };

  const handleRemoveTestimonialAvatar = (index: number) => {
    handleTestimonialChange(index, "avatarImage", "");
  };

  const handleAddTestimonial = () => {
    setTestimonials((prev) => {
      const next = [...prev, DEFAULT_TESTIMONIAL_STATE()];
      return reindexTestimonials(next);
    });
  };

  const handleHeroSlideChange = <
    Field extends keyof Omit<HeroSlideFormState, "id" | "sortOrder">
  >(
    index: number,
    field: Field,
    value: HeroSlideFormState[Field]
  ) => {
    setHeroSlides((prev) => {
      const next = [...prev];
      const normalizedValue = (
        value == null
          ? HERO_FIELD_DEFAULTS[field]
          : typeof value === "string"
          ? value
          : value
      ) as HeroSlideFormState[Field];
      next[index] = {
        ...next[index],
        [field]: normalizedValue,
      } as HeroSlideFormState;
      return reindexHeroSlides(next);
    });
  };

  const handleToggleHeroActive = (index: number, value: boolean) => {
    setHeroSlides((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isActive: value,
      };
      return reindexHeroSlides(next);
    });
  };

  const handleAddHeroSlide = () => {
    setHeroSlides((prev) => {
      const next = [...prev, DEFAULT_HERO_SLIDE_STATE()];
      return reindexHeroSlides(next);
    });
  };

  const handleRemoveHeroSlide = (index: number) => {
    setHeroSlides((prev) => {
      if (prev.length === 1) {
        toastWarning("Keep at least one slide", "Add another slide before deleting this one.");
        return prev;
      }
      const next = prev.filter((_, idx) => idx !== index);
      return reindexHeroSlides(next);
    });
  };

  const handleMoveHeroSlide = (index: number, direction: "up" | "down") => {
    setHeroSlides((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return reindexHeroSlides(next);
    });
  };

  const handleUploadHeroImage = async (index: number, file: File) => {
    setUploadingHeroIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "storefront");

      const response = await fetch("/api/upload/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to upload image");
      }

      const payload = await response.json();
      handleHeroSlideChange(index, "image", payload.url as string);
      toastSuccess("Image uploaded", "Hero slide image updated.");
    } catch (error) {
      console.error("Error uploading hero image:", error);
      toastError(
        "Upload failed",
        error instanceof Error ? error.message : "Unable to upload image"
      );
    } finally {
      setUploadingHeroIndex(null);
    }
  };

  const handleClearHeroImage = (index: number) => {
    handleHeroSlideChange(index, "image", "");
  };

  const handleResetHeroSlides = () => {
    setHeroSlides(JSON.parse(JSON.stringify(initialHeroSlides)));
  };

  const handleSaveHeroSlides = async () => {
    if (
      heroSlides.filter((slide) => slide.isActive && slide.heading.trim().length > 0).length === 0
    ) {
      toastWarning(
        "Add hero content",
        "Add at least one hero slide with a heading before saving."
      );
      return;
    }

    setSavingHeroSlides(true);
    try {
      const normalizedSlides = reindexHeroSlides(heroSlides).map(
        ({
          id,
          eyebrow,
          heading,
          subheading,
          description,
          ctaText,
          ctaLink,
          image,
          accentColor,
          sortOrder,
          isActive,
        }) => ({
          id: (id && id.toString()) || generateHeroSlideId(),
          eyebrow: eyebrow ?? "",
          heading: heading ?? "",
          subheading: subheading ?? "",
          description: description ?? "",
          ctaText: ctaText ?? "",
          ctaLink: ctaLink ?? "",
          image: image ?? "",
          accentColor: accentColor ?? "",
          sortOrder,
          isActive: Boolean(isActive),
        })
      );

      const payload = {
        sections: [
          {
            key: "home_hero" as const,
            data: {
              slides: JSON.parse(JSON.stringify(normalizedSlides)),
            },
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("Failed to save hero slides:", response.status, data);
        throw new Error(
          (data && (data.message as string)) ||
            (data && (data.error as string)) ||
            `Failed to save hero slides (status ${response.status})`
        );
      }

      await loadContent();
      toastSuccess("Hero saved", "Homepage hero updated successfully.");
    } catch (error) {
      console.error("Error saving hero slides:", error);
      toastError("Failed to save hero", error instanceof Error ? error.message : undefined);
    } finally {
      setSavingHeroSlides(false);
    }
  };

  const handlePromoBannerChange = <Field extends keyof PromoBannerFormState>(
    field: Field,
    value: PromoBannerFormState[Field]
  ) => {
    setPromoBanner((prev) => ({
      ...prev,
      [field]:
        value == null
          ? PROMO_FIELD_DEFAULTS[field]
          : typeof value === "string"
          ? value
          : value,
    }));
  };

  const handleTogglePromoActive = (value: boolean) => {
    setPromoBanner((prev) => ({
      ...prev,
      isActive: value,
    }));
  };

  const handleResetPromoBanner = () => {
    setPromoBanner(JSON.parse(JSON.stringify(initialPromoBanner)));
  };

  const handleSavePromoBanner = async () => {
    const normalized: PromoBannerFormState = {
      eyebrow: (promoBanner.eyebrow ?? "").trim(),
      title: (promoBanner.title ?? "").trim(),
      description: (promoBanner.description ?? "").trim(),
      ctaText: (promoBanner.ctaText ?? "").trim(),
      ctaHref: (promoBanner.ctaHref ?? "").trim(),
      gradient: (promoBanner.gradient ?? "").trim() || PROMO_FIELD_DEFAULTS.gradient,
      isActive: Boolean(promoBanner.isActive),
    };

    if (!normalized.title) {
      toastWarning("Title required", "Add a headline for the promo banner before saving.");
      return;
    }

    setSavingPromoBanner(true);
    try {
      const payload = {
        sections: [
          {
            key: "home_promo_banner" as const,
            data: JSON.parse(JSON.stringify(normalized)),
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("Failed to save promo banner:", response.status, data);
        throw new Error(
          (data && (data.message as string)) ||
            (data && (data.error as string)) ||
            `Failed to save promo banner (status ${response.status})`
        );
      }

      await loadContent();
      toastSuccess("Promo saved", "Homepage promo banner updated successfully.");
    } catch (error) {
      console.error("Error saving promo banner:", error);
      toastError(
        "Failed to save promo banner",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setSavingPromoBanner(false);
    }
  };

  const handleRemoveTestimonial = (index: number) => {
    setTestimonials((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return reindexTestimonials(next);
    });
  };

  const handleMoveTestimonial = (index: number, direction: "up" | "down") => {
    setTestimonials((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return reindexTestimonials(next);
    });
  };

  const handleSaveSection = async (key: string) => {
    const section = sections[key];
    if (!section) return;

    setSavingKey(key);
    try {
      let media: unknown = null;
      let content: unknown = null;

      try {
        media = parseJsonInput(section.media);
      } catch (error) {
        throw new Error(`Media JSON is invalid: ${(error as Error).message}`);
      }

      try {
        content = parseJsonInput(section.content);
      } catch (error) {
        throw new Error(`Content JSON is invalid: ${(error as Error).message}`);
      }

      const payload = {
        sections: [
          {
            id: section.id,
            key: section.key,
            title: section.title || null,
            subtitle: section.subtitle || null,
            description: section.description || null,
            ctaText: section.ctaText || null,
            ctaLink: section.ctaLink || null,
            gradient: section.gradient || null,
            media,
            content,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to save section");
      }

      const result = (await response.json()) as { sections?: StorefrontSection[] };
      const saved = result.sections?.[0];

      const updatedSection = saved
        ? toFormState(
            {
              key: saved.key,
              label: sections[key].label,
              description: "",
              defaultGradient: sections[key].gradient,
            },
            saved
          )
        : sections[key];

      setSections((prev) => ({
        ...prev,
        [key]: updatedSection,
      }));
      setInitialSections((prev) => ({
        ...prev,
        [key]: JSON.parse(JSON.stringify(updatedSection)),
      }));

      toastSuccess("Content saved", `${sections[key].label} updated successfully.`);
    } catch (error) {
      console.error("Error saving storefront section:", error);
      toastError(
        "Failed to save section",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveTestimonials = async () => {
    setSavingTestimonials(true);
    try {
      const payload = {
        testimonials: reindexTestimonials(testimonials).map((item, index) => ({
          id: item.id,
          name: item.name,
          role: item.role || null,
          rating: Math.min(5, Math.max(1, Number(item.rating ?? 5))) || 5,
          quote: item.quote,
          avatarColor: item.avatarColor || null,
          avatarImage: item.avatarImage || null,
          isFeatured: item.isFeatured,
          isActive: item.isActive,
          sortOrder: index,
        })),
      };

      const response = await fetch("/api/settings/storefront/testimonials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save testimonials");
      }

      await loadContent();
      toastSuccess("Testimonials saved", "Customer testimonials updated successfully.");
    } catch (error) {
      console.error("Error saving testimonials:", error);
      toastError(
        "Failed to save testimonials",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setSavingTestimonials(false);
    }
  };

  const handleProductPromoChange = <Field extends keyof ProductPromoFormState>(
    field: Field,
    value: ProductPromoFormState[Field]
  ) => {
    setProductPromo((prev) => ({
      ...prev,
      [field]:
        value == null
          ? PRODUCT_PROMO_FIELD_DEFAULTS[field]
          : typeof value === "string"
          ? value
          : value,
    }));
  };

  const handleToggleProductPromoActive = (value: boolean) => {
    setProductPromo((prev) => ({
      ...prev,
      isActive: value,
    }));
  };

  const handleResetProductPromo = () => {
    setProductPromo(JSON.parse(JSON.stringify(initialProductPromo)));
  };

  const handleSaveProductPromo = async () => {
    const normalized: ProductPromoFormState = {
      eyebrow: (productPromo.eyebrow ?? "").trim(),
      title: (productPromo.title ?? "").trim(),
      description: (productPromo.description ?? "").trim(),
      ctaText: (productPromo.ctaText ?? "").trim(),
      ctaHref: (productPromo.ctaHref ?? "").trim(),
      gradient: (productPromo.gradient ?? "").trim() || PRODUCT_PROMO_FIELD_DEFAULTS.gradient,
      isActive: Boolean(productPromo.isActive),
    };

    if (!normalized.title) {
      toastWarning("Title required", "Add a headline for the product promo banner before saving.");
      return;
    }

    setSavingProductPromo(true);
    try {
      const payload = {
        sections: [
          {
            key: "product_promo_banner" as const,
            data: JSON.parse(JSON.stringify(normalized)),
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("Failed to save product promo banner:", response.status, data);
        throw new Error(
          (data && (data.message as string)) ||
            (data && (data.error as string)) ||
            `Failed to save product promo banner (status ${response.status})`
        );
      }

      await loadContent();
      toastSuccess("Product promo saved", "Product detail promo banner updated successfully.");
    } catch (error) {
      console.error("Error saving product promo banner:", error);
      toastError(
        "Failed to save product promo",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setSavingProductPromo(false);
    }
  };

  // Contact Banner handlers
  const handleContactBannerChange = <Field extends keyof ContactBannerFormState>(
    field: Field,
    value: ContactBannerFormState[Field]
  ) => {
    setContactBanner((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggleContactBannerActive = (value: boolean) => {
    setContactBanner((prev) => ({
      ...prev,
      isActive: value,
    }));
  };

  const handleResetContactBanner = () => {
    setContactBanner(JSON.parse(JSON.stringify(initialContactBanner)));
  };

  const handleSaveContactBanner = async () => {
    setSavingContactBanner(true);
    try {
      const payload = {
        sections: [
          {
            key: "contact_banner",
            title: "Contact Banner",
            content: contactBanner,
            isActive: contactBanner.isActive,
            sortOrder: 0,
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save contact banner (status ${response.status})`);
      }

      await loadContent();
      toastSuccess("Contact banner saved", "Contact banner updated successfully.");
    } catch (error) {
      console.error("Error saving contact banner:", error);
      toastError("Failed to save contact banner", error instanceof Error ? error.message : undefined);
    } finally {
      setSavingContactBanner(false);
    }
  };

  // Footer Content handlers
  const handleFooterContentChange = <Field extends keyof FooterContentFormState>(
    field: Field,
    value: FooterContentFormState[Field]
  ) => {
    setFooterContent((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggleFooterContentActive = (value: boolean) => {
    setFooterContent((prev) => ({
      ...prev,
      isActive: value,
    }));
  };

  const handleResetFooterContent = () => {
    setFooterContent(JSON.parse(JSON.stringify(initialFooterContent)));
  };

  const handleSaveFooterContent = async () => {
    setSavingFooterContent(true);
    try {
      const payload = {
        sections: [
          {
            key: "footer_content",
            title: "Footer Content",
            content: footerContent,
            isActive: footerContent.isActive,
            sortOrder: 0,
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save footer content (status ${response.status})`);
      }

      await loadContent();
      toastSuccess("Footer content saved", "Footer content updated successfully.");
    } catch (error) {
      console.error("Error saving footer content:", error);
      toastError("Failed to save footer content", error instanceof Error ? error.message : undefined);
    } finally {
      setSavingFooterContent(false);
    }
  };

  const handleCategoryTileChange = <
    Field extends keyof Omit<CategoryTileFormState, "id" | "sortOrder">
  >(
    index: number,
    field: Field,
    value: CategoryTileFormState[Field]
  ) => {
    setCategoryTiles((prev) => {
      const next = [...prev];
      const normalizedValue = (
        value == null
          ? CATEGORY_FIELD_DEFAULTS[field]
          : typeof value === "string"
          ? value
          : value
      ) as CategoryTileFormState[Field];
      next[index] = {
        ...next[index],
        [field]: normalizedValue,
      } as CategoryTileFormState;
      return reindexCategoryTiles(next);
    });
  };

  const handleToggleCategoryActive = (index: number, value: boolean) => {
    setCategoryTiles((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isActive: value,
      };
      return reindexCategoryTiles(next);
    });
  };

  const handleAddCategoryTile = () => {
    setCategoryTiles((prev) => {
      const next = [...prev, DEFAULT_CATEGORY_TILE_STATE()];
      return reindexCategoryTiles(next);
    });
  };

  const handleRemoveCategoryTile = (index: number) => {
    setCategoryTiles((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return reindexCategoryTiles(next);
    });
  };

  const handleMoveCategoryTile = (index: number, direction: "up" | "down") => {
    setCategoryTiles((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return reindexCategoryTiles(next);
    });
  };

  const handleUploadCategoryImage = async (index: number, file: File) => {
    setUploadingCategoryIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "storefront");

      const response = await fetch("/api/upload/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to upload image");
      }

      const payload = await response.json();
      handleCategoryTileChange(index, "image", payload.url);
      toastSuccess("Image uploaded", "Category tile image updated.");
    } catch (error) {
      console.error("Error uploading category image:", error);
      toastError(
        "Upload failed",
        error instanceof Error ? error.message : "Unable to upload image"
      );
    } finally {
      setUploadingCategoryIndex(null);
    }
  };

  const handleClearCategoryImage = (index: number) => {
    handleCategoryTileChange(index, "image", "");
  };

  const handleSaveCategoryTiles = async () => {
    setSavingCategoryTiles(true);
    try {
      const normalizedTiles = reindexCategoryTiles(categoryTiles).map(
        ({
          title,
          tagline,
          description,
          href,
          image,
          accentColor,
          isActive,
          sortOrder,
        }) => ({
          title: title ?? "",
          tagline: tagline ?? "",
          description: description ?? "",
          href: href ?? "",
          image: image ?? "",
          accentColor: accentColor ?? "",
          isActive: Boolean(isActive),
          sortOrder,
        })
      );

      const jsonSafeTiles = JSON.parse(JSON.stringify(normalizedTiles)) as CategoryTileFormState[];

      const payload = {
        sections: [
          {
            key: "home_categories",
            data: jsonSafeTiles,
          },
        ],
      };

      const response = await fetch("/api/settings/storefront/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("Failed to save categories:", response.status, data);
        throw new Error(
          (data && (data.message as string)) ||
            (data && (data.error as string)) ||
            `Failed to save categories (status ${response.status})`
        );
      }

      await loadContent();
      toastSuccess("Categories saved", "Homepage categories updated successfully.");
    } catch (error) {
      console.error("Error saving category tiles:", error);
      toastError(
        "Failed to save categories",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setSavingCategoryTiles(false);
    }
  };

  const handleAddCustomSection = () => {
    const key = customKeyDraft.trim();
    const label = customLabelDraft.trim() || humanizeKey(key);

    if (!key) {
      toastWarning("Key required", "Please provide a unique key for the section.");
      return;
    }

    if (sections[key]) {
      toastWarning("Duplicate key", "A section with this key already exists.");
      return;
    }

    const template = {
      key,
      label,
      description: "Custom storefront section",
      defaultGradient: "from-slate-900 via-slate-700 to-slate-500",
    };

    const newSection = DEFAULT_SECTION_STATE(template);
    setSections((prev) => ({
      ...prev,
      [key]: newSection,
    }));
    setInitialSections((prev) => ({
      ...prev,
      [key]: JSON.parse(JSON.stringify(newSection)),
    }));
    setCustomKeyDraft("");
    setCustomLabelDraft("");
    toastSuccess("Section added", "Customize the new section and save your changes.");
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Storefront CMS</h1>
          <p className="text-gray-600">
            Manage the content blocks that appear across the public storefront experience.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              <Sparkles className="mr-1 h-3 w-3" /> Unsaved changes
            </Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Custom Section</CardTitle>
          <CardDescription>
            Need a new CMS block? Define a unique key and label, then customize it below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="custom-section-key">Section Key</Label>
            <Input
              id="custom-section-key"
              placeholder="e.g. homepage_testimonial"
              value={customKeyDraft}
              onChange={(event) => setCustomKeyDraft(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="custom-section-label">Display Label</Label>
            <Input
              id="custom-section-label"
              placeholder="Section label"
              value={customLabelDraft}
              onChange={(event) => setCustomLabelDraft(event.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full md:w-auto" onClick={handleAddCustomSection}>
              <Plus className="mr-2 h-4 w-4" /> Add Section
            </Button>
          </div>
        </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Product Detail Promo Banner
                <Badge variant="outline" className="font-mono text-xs">
                  product_promo_banner
                </Badge>
              </CardTitle>
              <CardDescription>
                Shown on each product page below recommended items. Use this to promote bundles or services.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="product-promo-active" className="text-sm text-gray-600">
                  Visible on storefront
                </Label>
                <Switch
                  id="product-promo-active"
                  checked={productPromo.isActive}
                  onCheckedChange={handleToggleProductPromoActive}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetProductPromo}
                disabled={!isProductPromoDirty(initialProductPromo, productPromo)}
                className="text-gray-600 hover:text-gray-900"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveProductPromo}
                disabled={savingProductPromo}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingProductPromo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Save Product Promo
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="product-promo-eyebrow">Eyebrow (Optional)</Label>
              <Input
                id="product-promo-eyebrow"
                value={productPromo.eyebrow}
                onChange={(event) => handleProductPromoChange("eyebrow", event.target.value)}
                placeholder="Poolside Upgrade"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="product-promo-title">Title</Label>
              <Input
                id="product-promo-title"
                value={productPromo.title}
                onChange={(event) => handleProductPromoChange("title", event.target.value)}
                placeholder="Bundle & Save on Spa Accessories"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="product-promo-description">Description</Label>
              <Textarea
                id="product-promo-description"
                value={productPromo.description}
                onChange={(event) => handleProductPromoChange("description", event.target.value)}
                placeholder="Short supporting copy for the product promo banner."
                className="mt-1 min-h-[120px]"
              />
            </div>
            <div>
              <Label htmlFor="product-promo-cta-text">CTA Text</Label>
              <Input
                id="product-promo-cta-text"
                value={productPromo.ctaText}
                onChange={(event) => handleProductPromoChange("ctaText", event.target.value)}
                placeholder="Explore Accessories"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="product-promo-cta-href">CTA Link</Label>
              <Input
                id="product-promo-cta-href"
                value={productPromo.ctaHref}
                onChange={(event) => handleProductPromoChange("ctaHref", event.target.value)}
                placeholder="/shop?category=accessories"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="product-promo-gradient">Gradient / Background Classes</Label>
              <Input
                id="product-promo-gradient"
                value={productPromo.gradient}
                onChange={(event) => handleProductPromoChange("gradient", event.target.value)}
                placeholder="from-sky-500 via-cyan-500 to-emerald-500"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-gray-500">
                Accepts hex colors or Tailwind classes for the gradient background.
              </p>
            </div>
          </CardContent>
        </Card>

      <div className="space-y-6">
        {orderedKeys.map((key) => {
          const section = sections[key];
          const initial = initialSections[key];
          const isDirty = isSectionDirty(initial, section);
          if (!section) return null;

          return (
            <Card key={key} className={cn("border border-gray-200", isDirty && "border-amber-300")}> 
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {section.label}
                    <Badge variant="outline" className="font-mono text-xs">
                      {section.key}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {SECTION_TEMPLATES.find((template) => template.key === key)?.description ||
                      "Custom storefront content section"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${key}-active`} className="text-sm text-gray-600">
                      Visible on storefront
                    </Label>
                    <Switch
                      id={`${key}-active`}
                      checked={section.isActive}
                      onCheckedChange={(checked) => handleSectionChange(key, "isActive", checked)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${key}-order`} className="text-sm text-gray-600">
                      Sort order
                    </Label>
                    <Input
                      id={`${key}-order`}
                      type="number"
                      value={section.sortOrder}
                      onChange={(event) =>
                        handleSectionChange(key, "sortOrder", parseInt(event.target.value, 10) || 0)
                      }
                      className="h-9 w-24"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`${key}-title`}>Title</Label>
                    <Input
                      id={`${key}-title`}
                      value={section.title}
                      onChange={(event) => handleSectionChange(key, "title", event.target.value)}
                      placeholder="Headline text"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${key}-subtitle`}>Subtitle</Label>
                    <Input
                      id={`${key}-subtitle`}
                      value={section.subtitle}
                      onChange={(event) => handleSectionChange(key, "subtitle", event.target.value)}
                      placeholder="Supporting text"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`${key}-description`}>Description</Label>
                  <Textarea
                    id={`${key}-description`}
                    value={section.description}
                    onChange={(event) => handleSectionChange(key, "description", event.target.value)}
                    placeholder="Longer descriptive copy displayed to shoppers"
                    className="mt-1 min-h-[120px]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`${key}-cta-text`}>CTA Text</Label>
                    <Input
                      id={`${key}-cta-text`}
                      value={section.ctaText}
                      onChange={(event) => handleSectionChange(key, "ctaText", event.target.value)}
                      placeholder="e.g. Shop Now"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${key}-cta-link`}>CTA Link</Label>
                    <Input
                      id={`${key}-cta-link`}
                      value={section.ctaLink}
                      onChange={(event) => handleSectionChange(key, "ctaLink", event.target.value)}
                      placeholder="e.g. /shop/deals"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`${key}-gradient`}>Gradient / Background Classes</Label>
                  <Input
                    id={`${key}-gradient`}
                    value={section.gradient}
                    onChange={(event) => handleSectionChange(key, "gradient", event.target.value)}
                    placeholder="from-indigo-600 via-purple-500 to-pink-500"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Accepts Tailwind gradient classes (e.g., from-sky-500 via-blue-600 to-indigo-700)
                  </p>
                </div>

                {/* Simple image upload for shop_promo, homepage_promo, and homepage_special_deal */}
                {(key === "shop_promo" || key === "homepage_promo" || key === "homepage_special_deal") && (
                  <div>
                    <Label>Background Image (Optional)</Label>
                    <input
                      id={`${key}-image-input`}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setUploadingSectionKey(key);
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            formData.append("type", "banner");
                            
                            const response = await fetch("/api/upload/branding", {
                              method: "POST",
                              body: formData,
                              credentials: "include",
                            });

                            if (response.ok) {
                              const data = await response.json();
                              const mediaJson = JSON.stringify({ imageUrl: data.url });
                              handleSectionChange(key, "media", mediaJson);
                              toastSuccess("Image uploaded", "Background image updated successfully.");
                            } else {
                              throw new Error("Failed to upload image");
                            }
                          } catch (error) {
                            toastError("Upload failed", error instanceof Error ? error.message : "Unable to upload image");
                          } finally {
                            setUploadingSectionKey(null);
                          }
                        }
                        event.target.value = "";
                      }}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById(`${key}-image-input`)?.click()}
                        disabled={uploadingSectionKey === key}
                      >
                        {uploadingSectionKey === key ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                          </>
                        ) : (
                          <>
                            <ImageIcon className="mr-2 h-4 w-4" /> Upload Image
                          </>
                        )}
                      </Button>
                      {(() => {
                        try {
                          const media = JSON.parse(section.media || "{}");
                          if (media?.imageUrl) {
                            return (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleSectionChange(key, "media", "{}")}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                                </Button>
                                <div className="h-24 w-32 overflow-hidden rounded-lg border border-gray-200">
                                  <img
                                    src={media.imageUrl}
                                    alt="Section preview"
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </>
                            );
                          }
                        } catch {
                          // Invalid JSON, ignore
                        }
                        return null;
                      })()}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Upload a background image for this promotional section (optional).
                    </p>
                  </div>
                )}

                {/* Hide JSON fields for shop_promo, homepage_promo, and homepage_special_deal */}
                {key !== "shop_promo" && key !== "homepage_promo" && key !== "homepage_special_deal" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${key}-media`}>Media JSON (optional)</Label>
                      <Textarea
                        id={`${key}-media`}
                        value={section.media}
                        onChange={(event) => handleSectionChange(key, "media", event.target.value)}
                        placeholder='{"imageUrl": "https://..."}'
                        className="mt-1 min-h-[120px] font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${key}-content`}>Content JSON (optional)</Label>
                      <Textarea
                        id={`${key}-content`}
                        value={section.content}
                        onChange={(event) => handleSectionChange(key, "content", event.target.value)}
                        placeholder='{"highlights": ["chlorine free", "energy efficient"]}'
                        className="mt-1 min-h-[120px] font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => handleSaveSection(key)}
                    disabled={savingKey === key}
                  >
                    {savingKey === key ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900"
                    onClick={() => handleResetSection(key)}
                    disabled={!isDirty}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  {isDirty ? (
                    <span className="inline-flex items-center text-xs text-amber-600">
                      <AlertTriangle className="mr-1 h-3 w-3" /> Unsaved changes
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Homepage Hero
                <Badge variant="outline" className="font-mono text-xs">
                  home_hero
                </Badge>
              </CardTitle>
              <CardDescription>
                Control the large hero slider at the top of the storefront homepage.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddHeroSlide}
                style={{ borderColor: themeColor, color: themeColor }}
                className="hover:bg-opacity-10"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Slide
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetHeroSlides}
                disabled={!heroSlidesDirty(initialHeroSlides, heroSlides)}
                className="text-gray-600 hover:text-gray-900"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveHeroSlides}
                disabled={savingHeroSlides}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingHeroSlides ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Save Hero
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroSlides.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
                No hero slides yet. Add slides to greet shoppers on the storefront homepage.
              </div>
            ) : (
              heroSlides.map((slide, index) => (
                <div key={slide.id ?? `hero-${index}`} className="rounded-xl border border-gray-200 p-4">
                  <input
                    id={`hero-image-input-${index}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadHeroImage(index, file);
                      }
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Eyebrow (Optional)</Label>
                        <Input
                          value={slide.eyebrow ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "eyebrow", event.target.value)
                          }
                          placeholder="Summer Essentials"
                        />
                      </div>
                      <div>
                        <Label>Heading</Label>
                        <Input
                          value={slide.heading ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "heading", event.target.value)
                          }
                          placeholder="Everything you need for a sparkling pool"
                        />
                        <p className="mt-1 text-xs text-gray-500">Shown prominently in large text.</p>
                      </div>
                      <div>
                        <Label>Subheading (Optional)</Label>
                        <Input
                          value={slide.subheading ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "subheading", event.target.value)
                          }
                          placeholder="Keep your pool show-ready all season"
                        />
                      </div>
                      <div>
                        <Label>CTA Text</Label>
                        <Input
                          value={slide.ctaText ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "ctaText", event.target.value)
                          }
                          placeholder="Shop Now"
                        />
                      </div>
                      <div>
                        <Label>CTA Link</Label>
                        <Input
                          value={slide.ctaLink ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "ctaLink", event.target.value)
                          }
                          placeholder="/shop"
                        />
                      </div>
                      <div>
                        <Label>Accent Color</Label>
                        <Input
                          value={slide.accentColor ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "accentColor", event.target.value)
                          }
                          placeholder="#23185c"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Accepts hex colors or Tailwind classes.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          value={slide.description ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "description", event.target.value)
                          }
                          rows={3}
                          placeholder="A short supporting message for this hero slide."
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Hero Image</Label>
                        <Input
                          value={slide.image ?? ""}
                          onChange={(event) =>
                            handleHeroSlideChange(index, "image", event.target.value)
                          }
                          placeholder="https://..."
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Upload an image or paste a URL (recommended 1600×900 or larger).
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              document.getElementById(`hero-image-input-${index}`)?.click()
                            }
                            disabled={uploadingHeroIndex === index}
                          >
                            {uploadingHeroIndex === index ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                              </>
                            ) : (
                              <>
                                <ImageIcon className="mr-2 h-4 w-4" /> Upload Image
                              </>
                            )}
                          </Button>
                          {slide.image ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleClearHeroImage(index)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </Button>
                          ) : null}
                        </div>
                        {slide.image ? (
                          <div className="mt-3 h-48 overflow-hidden rounded-lg border border-gray-200">
                            <img
                              src={slide.image}
                              alt={`${slide.heading || "Hero"} preview`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`hero-active-${index}`}
                          checked={slide.isActive}
                          onCheckedChange={(checked) => handleToggleHeroActive(index, checked)}
                        />
                        <Label htmlFor={`hero-active-${index}`} className="text-sm text-gray-700">
                          Visible in slider
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveHeroSlide(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" /> Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveHeroSlide(index, "down")}
                        disabled={index === heroSlides.length - 1}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" /> Down
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveHeroSlide(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Homepage Promo Banner
                <Badge variant="outline" className="font-mono text-xs">
                  home_promo_banner
                </Badge>
              </CardTitle>
              <CardDescription>
                Customize the promotional banner near the bottom of the storefront homepage.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="promo-active" className="text-sm text-gray-600">
                  Visible on storefront
                </Label>
                <Switch
                  id="promo-active"
                  checked={promoBanner.isActive}
                  onCheckedChange={handleTogglePromoActive}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetPromoBanner}
                disabled={!isPromoBannerDirty(initialPromoBanner, promoBanner)}
                className="text-gray-600 hover:text-gray-900"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSavePromoBanner}
                disabled={savingPromoBanner}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingPromoBanner ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Save Promo
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="promo-eyebrow">Eyebrow (Optional)</Label>
              <Input
                id="promo-eyebrow"
                value={promoBanner.eyebrow}
                onChange={(event) => handlePromoBannerChange("eyebrow", event.target.value)}
                placeholder="Limited Time Offer"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="promo-title">Title</Label>
              <Input
                id="promo-title"
                value={promoBanner.title}
                onChange={(event) => handlePromoBannerChange("title", event.target.value)}
                placeholder="Turn Your Backyard into a Paradise"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="promo-description">Description</Label>
              <Textarea
                id="promo-description"
                value={promoBanner.description}
                onChange={(event) => handlePromoBannerChange("description", event.target.value)}
                placeholder="Short supporting copy for the promo banner."
                className="mt-1 min-h-[120px]"
              />
            </div>
            <div>
              <Label htmlFor="promo-cta-text">CTA Text</Label>
              <Input
                id="promo-cta-text"
                value={promoBanner.ctaText}
                onChange={(event) => handlePromoBannerChange("ctaText", event.target.value)}
                placeholder="Shop Backyard Kits"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="promo-cta-href">CTA Link</Label>
              <Input
                id="promo-cta-href"
                value={promoBanner.ctaHref}
                onChange={(event) => handlePromoBannerChange("ctaHref", event.target.value)}
                placeholder="/shop?category=accessories"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="promo-gradient">Gradient / Background Classes</Label>
              <Input
                id="promo-gradient"
                value={promoBanner.gradient}
                onChange={(event) => handlePromoBannerChange("gradient", event.target.value)}
                placeholder="from-indigo-600 via-purple-500 to-pink-500"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-gray-500">
                Accepts hex colors or Tailwind classes for the gradient background.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Homepage Categories
                <Badge variant="outline" className="font-mono text-xs">
                  home_categories
                </Badge>
              </CardTitle>
              <CardDescription>
                Curate the featured categories displayed on the storefront homepage.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCategoryTile}
                style={{ borderColor: themeColor, color: themeColor }}
                className="hover:bg-opacity-10"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Category Tile
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCategoryTiles}
                disabled={savingCategoryTiles}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingCategoryTiles ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Save Categories
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryTiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
                No category tiles yet. Add tiles to highlight key areas of the storefront.
              </div>
            ) : (
              categoryTiles.map((tile, index) => (
                <div key={tile.id ?? `cat-${index}`} className="rounded-xl border border-gray-200 p-4">
                  <input
                    id={`category-image-input-${index}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadCategoryImage(index, file);
                      }
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={tile.title ?? ""}
                          onChange={(event) =>
                            handleCategoryTileChange(index, "title", event.target.value)
                          }
                          placeholder="Pool Maintenance"
                        />
                      </div>
                      <div>
                        <Label>Tagline</Label>
                        <Input
                          value={tile.tagline ?? ""}
                          onChange={(event) =>
                            handleCategoryTileChange(index, "tagline", event.target.value)
                          }
                          placeholder="Keep it crystal clear"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          value={tile.description ?? ""}
                          onChange={(event) =>
                            handleCategoryTileChange(index, "description", event.target.value)
                          }
                          rows={3}
                          placeholder="Short supporting copy for this tile."
                        />
                      </div>
                      <div>
                        <Label>Link</Label>
                        <Input
                          value={tile.href ?? ""}
                          onChange={(event) =>
                            handleCategoryTileChange(index, "href", event.target.value)
                          }
                          placeholder="/shop?category=maintenance"
                        />
                      </div>
                      <div>
                        <Label>Image URL (optional)</Label>
                        <Input
                          value={tile.image ?? ""}
                          onChange={(event) =>
                            handleCategoryTileChange(index, "image", event.target.value)
                          }
                          placeholder="https://..."
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Upload an image or paste a URL (recommended 600×400 or larger).
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              document.getElementById(`category-image-input-${index}`)?.click()
                            }
                            disabled={uploadingCategoryIndex === index}
                          >
                            {uploadingCategoryIndex === index ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                              </>
                            ) : (
                              <>
                                <ImageIcon className="mr-2 h-4 w-4" /> Upload Image
                              </>
                            )}
                          </Button>
                          {tile.image ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleClearCategoryImage(index)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </Button>
                          ) : null}
                        </div>
                        {tile.image ? (
                          <div className="mt-3 h-32 overflow-hidden rounded-lg border border-gray-200">
                            <img
                              src={tile.image}
                              alt={`${tile.title || "Category"} preview`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <Label>Accent Color / Gradient</Label>
                        <Input
                          value={tile.accentColor ?? ""}
                          onChange={(event) =>
                            handleCategoryTileChange(index, "accentColor", event.target.value)
                          }
                          placeholder="#2563eb or bg-blue-600"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Accepts hex colors or Tailwind classes (e.g. <code>bg-indigo-600</code>).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`category-active-${index}`}
                          checked={tile.isActive}
                          onCheckedChange={(checked) => handleToggleCategoryActive(index, checked)}
                        />
                        <Label
                          htmlFor={`category-active-${index}`}
                          className="text-sm text-gray-700"
                        >
                          Display on storefront
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveCategoryTile(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" /> Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveCategoryTile(index, "down")}
                        disabled={index === categoryTiles.length - 1}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" /> Down
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveCategoryTile(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Customer Testimonials
                <Badge variant="outline" className="font-mono text-xs">
                  testimonials
                </Badge>
              </CardTitle>
              <CardDescription>
                Curate the customer stories that appear across the storefront experience.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTestimonial}
                style={{ borderColor: themeColor, color: themeColor }}
                className="hover:bg-opacity-10"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Testimonial
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveTestimonials}
                disabled={savingTestimonials}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingTestimonials ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Save Testimonials
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {testimonials.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
                No testimonials yet. Add your first customer story to build trust on product pages.
              </div>
            ) : (
              testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.id ?? `testimonial-${index}`}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <input
                    id={`testimonial-avatar-input-${index}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadTestimonialAvatar(index, file);
                      }
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={testimonial.name}
                          onChange={(event) =>
                            handleTestimonialChange(index, "name", event.target.value)
                          }
                          placeholder="Customer name"
                        />
                      </div>
                      <div>
                        <Label>Role / Company</Label>
                        <Input
                          value={testimonial.role}
                          onChange={(event) =>
                            handleTestimonialChange(index, "role", event.target.value)
                          }
                          placeholder="Homeowner • Accra"
                        />
                      </div>
                      <div>
                        <Label>Rating</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={testimonial.rating}
                          onChange={(event) =>
                            handleTestimonialChange(index, "rating", Number(event.target.value))
                          }
                        />
                        <div className="mt-2 flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={`${testimonial.id ?? index}-star-${star}`}
                              className={cn(
                                "h-4 w-4",
                                star <= testimonial.rating ? "fill-current" : "text-gray-300"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Avatar Color</Label>
                        <Input
                          value={testimonial.avatarColor}
                          onChange={(event) =>
                            handleTestimonialChange(index, "avatarColor", event.target.value)
                          }
                          placeholder="#2563eb or bg-blue-600"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Supports hex colors or Tailwind classes (e.g. <code>bg-emerald-500</code>).
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Quote</Label>
                        <Textarea
                          value={testimonial.quote}
                          onChange={(event) =>
                            handleTestimonialChange(index, "quote", event.target.value)
                          }
                          placeholder="Share the customer's experience in their own words."
                          rows={3}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Avatar Image (optional)</Label>
                        <Input
                          value={testimonial.avatarImage ?? ""}
                          onChange={(event) =>
                            handleTestimonialChange(index, "avatarImage", event.target.value)
                          }
                          placeholder="https://..."
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Upload a square image or paste a URL (recommended 200×200 or larger).
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              document
                                .getElementById(`testimonial-avatar-input-${index}`)
                                ?.click()
                            }
                            disabled={uploadingTestimonialIndex === index}
                          >
                            {uploadingTestimonialIndex === index ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                              </>
                            ) : (
                              <>
                                <ImageIcon className="mr-2 h-4 w-4" /> Upload Image
                              </>
                            )}
                          </Button>
                          {testimonial.avatarImage ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleRemoveTestimonialAvatar(index)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </Button>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                            {testimonial.avatarImage ? (
                              <img
                                src={testimonial.avatarImage}
                                alt={`${testimonial.name || "Testimonial"} avatar`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-white",
                                  testimonial.avatarColor?.startsWith("#")
                                    ? ""
                                    : testimonial.avatarColor || "bg-blue-600"
                                )}
                                style={
                                  testimonial.avatarColor?.startsWith("#")
                                    ? { backgroundColor: testimonial.avatarColor }
                                    : undefined
                                }
                              >
                                {testimonial.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("") || "A"}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            This preview matches how the testimonial appears on product pages.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`testimonial-featured-${index}`}
                          checked={testimonial.isFeatured}
                          onCheckedChange={(checked) => handleToggleFeatured(index, checked)}
                        />
                        <Label
                          htmlFor={`testimonial-featured-${index}`}
                          className="text-sm text-gray-700"
                        >
                          Highlight this testimonial
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`testimonial-active-${index}`}
                          checked={testimonial.isActive}
                          onCheckedChange={(checked) => handleToggleTestimonialActive(index, checked)}
                        />
                        <Label
                          htmlFor={`testimonial-active-${index}`}
                          className="text-sm text-gray-700"
                        >
                          Show on storefront
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveTestimonial(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" /> Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveTestimonial(index, "down")}
                        disabled={index === testimonials.length - 1}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" /> Down
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveTestimonial(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Contact Banner */}
        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Contact Banner
                <Badge variant="outline" className="font-mono text-xs">contact_banner</Badge>
              </CardTitle>
              <CardDescription>
                Phone numbers displayed in the top information bar of the navigation.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="contact-banner-active" className="text-sm text-gray-600">
                  Visible on storefront
                </Label>
                <Switch
                  id="contact-banner-active"
                  checked={contactBanner.isActive}
                  onCheckedChange={handleToggleContactBannerActive}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetContactBanner}
                disabled={JSON.stringify(contactBanner) === JSON.stringify(initialContactBanner)}
                className="text-gray-600 hover:text-gray-900"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveContactBanner}
                disabled={savingContactBanner}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingContactBanner ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Save Contact Banner
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Phone 1</Label>
              <Input
                value={contactBanner.phone1}
                onChange={(event) => handleContactBannerChange("phone1", event.target.value)}
                placeholder="+233 59 691 1818"
              />
            </div>
            <div>
              <Label>Phone 1 Hours</Label>
              <Input
                value={contactBanner.phone1Hours}
                onChange={(event) => handleContactBannerChange("phone1Hours", event.target.value)}
                placeholder="8am - 5pm"
              />
            </div>
            <div>
              <Label>Phone 2</Label>
              <Input
                value={contactBanner.phone2}
                onChange={(event) => handleContactBannerChange("phone2", event.target.value)}
                placeholder="+233 56 111 2777"
              />
            </div>
            <div>
              <Label>Phone 2 Hours</Label>
              <Input
                value={contactBanner.phone2Hours}
                onChange={(event) => handleContactBannerChange("phone2Hours", event.target.value)}
                placeholder="5pm till 8am"
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer Content */}
        <Card className="border border-gray-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Footer Content
                <Badge variant="outline" className="font-mono text-xs">footer_content</Badge>
              </CardTitle>
              <CardDescription>
                Footer information including address, contact details, and social media links.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="footer-content-active" className="text-sm text-gray-600">
                  Visible on storefront
                </Label>
                <Switch
                  id="footer-content-active"
                  checked={footerContent.isActive}
                  onCheckedChange={handleToggleFooterContentActive}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFooterContent}
                disabled={JSON.stringify(footerContent) === JSON.stringify(initialFooterContent)}
                className="text-gray-600 hover:text-gray-900"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveFooterContent}
                disabled={savingFooterContent}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                className="text-white hover:opacity-90"
              >
                {savingFooterContent ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Save Footer Content
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={footerContent.description}
                onChange={(event) => handleFooterContentChange("description", event.target.value)}
                placeholder="Your one-stop shop for premium pool products..."
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Textarea
                value={footerContent.address}
                onChange={(event) => handleFooterContentChange("address", event.target.value)}
                placeholder="123 Pool Street&#10;Accra, Ghana"
                rows={2}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={footerContent.phone}
                onChange={(event) => handleFooterContentChange("phone", event.target.value)}
                placeholder="+233 123 456 789"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={footerContent.email}
                onChange={(event) => handleFooterContentChange("email", event.target.value)}
                placeholder="info@thepoolshop.africa"
              />
            </div>
            <div>
              <Label>Facebook URL</Label>
              <Input
                value={footerContent.facebookUrl}
                onChange={(event) => handleFooterContentChange("facebookUrl", event.target.value)}
                placeholder="https://facebook.com"
              />
            </div>
            <div>
              <Label>Twitter URL</Label>
              <Input
                value={footerContent.twitterUrl}
                onChange={(event) => handleFooterContentChange("twitterUrl", event.target.value)}
                placeholder="https://twitter.com"
              />
            </div>
            <div>
              <Label>Instagram URL</Label>
              <Input
                value={footerContent.instagramUrl}
                onChange={(event) => handleFooterContentChange("instagramUrl", event.target.value)}
                placeholder="https://instagram.com"
              />
            </div>
            <div>
              <Label>LinkedIn URL</Label>
              <Input
                value={footerContent.linkedinUrl}
                onChange={(event) => handleFooterContentChange("linkedinUrl", event.target.value)}
                placeholder="https://linkedin.com"
              />
            </div>
            <div>
              <Label>Privacy Policy Link</Label>
              <Input
                value={footerContent.privacyPolicyLink}
                onChange={(event) => handleFooterContentChange("privacyPolicyLink", event.target.value)}
                placeholder="/shop/privacy"
              />
            </div>
            <div>
              <Label>Terms of Service Link</Label>
              <Input
                value={footerContent.termsLink}
                onChange={(event) => handleFooterContentChange("termsLink", event.target.value)}
                placeholder="/shop/terms"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function toFormState(
  template: { key: string; label: string; defaultGradient: string },
  section?: StorefrontSection
): SectionFormState {
  return {
    id: section?.id,
    key: template.key,
    label: template.label,
    title: section?.title ?? "",
    subtitle: section?.subtitle ?? "",
    description: section?.description ?? "",
    ctaText: section?.ctaText ?? "",
    ctaLink: section?.ctaLink ?? "",
    gradient: section?.gradient ?? template.defaultGradient,
    media: serializeJson(section?.media),
    content: serializeJson(section?.content),
    sortOrder: section?.sortOrder ?? 0,
    isActive: section?.isActive ?? true,
  };
}

function toTestimonialForm(testimonial?: {
  id?: string;
  name?: string | null;
  role?: string | null;
  rating?: number | null;
  quote?: string | null;
  avatarColor?: string | null;
  avatarImage?: string | null;
  isFeatured?: boolean | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
}): TestimonialFormState {
  const rating =
    typeof testimonial?.rating === "number" && testimonial.rating >= 1 && testimonial.rating <= 5
      ? Math.round(testimonial.rating)
      : 5;

  return {
    id: testimonial?.id,
    name: testimonial?.name ?? "",
    role: testimonial?.role ?? "",
    rating,
    quote: testimonial?.quote ?? "",
    avatarColor: testimonial?.avatarColor ?? "#2563eb",
    avatarImage: testimonial?.avatarImage ?? "",
    isFeatured: testimonial?.isFeatured ?? false,
    isActive: testimonial?.isActive ?? true,
    sortOrder:
      typeof testimonial?.sortOrder === "number" && Number.isFinite(testimonial.sortOrder)
        ? Math.trunc(testimonial.sortOrder)
        : 0,
  };
}

function isTestimonialDirty(initial: TestimonialFormState, current: TestimonialFormState) {
  return (
    initial.name !== current.name ||
    initial.role !== current.role ||
    initial.rating !== current.rating ||
    initial.quote !== current.quote ||
    initial.avatarColor !== current.avatarColor ||
    initial.avatarImage !== current.avatarImage ||
    initial.isFeatured !== current.isFeatured ||
    initial.isActive !== current.isActive ||
    initial.sortOrder !== current.sortOrder
  );
}

function testimonialsDirty(
  initial: TestimonialFormState[],
  current: TestimonialFormState[]
): boolean {
  if (initial.length !== current.length) {
    return true;
  }
  return initial.some((value, index) => isTestimonialDirty(value, current[index]));
}

function reindexTestimonials(list: TestimonialFormState[]): TestimonialFormState[] {
  return list.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function isPromoBannerDirty(
  initial: PromoBannerFormState,
  current: PromoBannerFormState
): boolean {
  return (
    initial.eyebrow !== current.eyebrow ||
    initial.title !== current.title ||
    initial.description !== current.description ||
    initial.ctaText !== current.ctaText ||
    initial.ctaHref !== current.ctaHref ||
    initial.gradient !== current.gradient ||
    initial.isActive !== current.isActive
  );
}

function isProductPromoDirty(
  initial: ProductPromoFormState,
  current: ProductPromoFormState
): boolean {
  return (
    initial.eyebrow !== current.eyebrow ||
    initial.title !== current.title ||
    initial.description !== current.description ||
    initial.ctaText !== current.ctaText ||
    initial.ctaHref !== current.ctaHref ||
    initial.gradient !== current.gradient ||
    initial.isActive !== current.isActive
  );
}

function isCategoryTileDirty(
  initial: CategoryTileFormState,
  current: CategoryTileFormState
): boolean {
  return (
    initial.title !== current.title ||
    initial.tagline !== current.tagline ||
    initial.description !== current.description ||
    initial.href !== current.href ||
    initial.image !== current.image ||
    initial.accentColor !== current.accentColor ||
    initial.isActive !== current.isActive ||
    initial.sortOrder !== current.sortOrder
  );
}

function categoryTilesDirty(
  initial: CategoryTileFormState[],
  current: CategoryTileFormState[]
): boolean {
  if (initial.length !== current.length) {
    return true;
  }
  return initial.some((value, index) => isCategoryTileDirty(value, current[index]));
}

function isHeroSlideDirty(initial: HeroSlideFormState, current: HeroSlideFormState): boolean {
  return (
    initial.eyebrow !== current.eyebrow ||
    initial.heading !== current.heading ||
    initial.subheading !== current.subheading ||
    initial.description !== current.description ||
    initial.ctaText !== current.ctaText ||
    initial.ctaLink !== current.ctaLink ||
    initial.image !== current.image ||
    initial.accentColor !== current.accentColor ||
    initial.sortOrder !== current.sortOrder ||
    initial.isActive !== current.isActive
  );
}

function heroSlidesDirty(
  initial: HeroSlideFormState[],
  current: HeroSlideFormState[]
): boolean {
  if (initial.length !== current.length) {
    return true;
  }
  return initial.some((value, index) => isHeroSlideDirty(value, current[index]));
}

function reindexHeroSlides(list: HeroSlideFormState[]): HeroSlideFormState[] {
  return list.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function reindexCategoryTiles(list: CategoryTileFormState[]): CategoryTileFormState[] {
  return list.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)\w/g, (match) => match.toUpperCase());
}

function isSectionDirty(initial?: SectionFormState, current?: SectionFormState) {
  if (!initial || !current) return false;
  return (
    initial.title !== current.title ||
    initial.subtitle !== current.subtitle ||
    initial.description !== current.description ||
    initial.ctaText !== current.ctaText ||
    initial.ctaLink !== current.ctaLink ||
    initial.gradient !== current.gradient ||
    initial.media !== current.media ||
    initial.content !== current.content ||
    initial.sortOrder !== current.sortOrder ||
    initial.isActive !== current.isActive
  );
}
