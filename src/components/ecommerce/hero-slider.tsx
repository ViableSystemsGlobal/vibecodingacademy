"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type HeroSlide = {
  id: string;
  eyebrow?: string | null;
  heading: string;
  subheading?: string | null;
  description?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  image?: string | null;
  accentColor?: string | null;
};

type HeroSliderProps = {
  slides?: HeroSlide[];
  autoPlayInterval?: number;
};

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: "fallback-1",
    eyebrow: "Smart Deals",
    heading: "Spend Less!",
    subheading: "Too Hot To Miss",
    description: "Shop unbeatable prices on everyday essentials.",
    ctaText: "Shop Now",
    ctaLink: "/shop",
    image: null,
    accentColor: "#ff463c",
  },
  {
    id: "fallback-2",
    eyebrow: "Premium Brands",
    heading: "Stock Up & Save",
    subheading: "Fresh picks every week",
    description: "Explore top household brands with special discounts.",
    ctaText: "Browse Deals",
    ctaLink: "/shop?category=all",
    image: null,
    accentColor: "#2a6df4",
  },
];

export function HeroSlider({
  slides,
  autoPlayInterval = 6000,
}: HeroSliderProps) {
  const heroSlides = useMemo(() => {
    if (slides && slides.length > 0) {
      return slides.map((slide, index) => ({
        ...slide,
        accentColor: slide.accentColor || ["#ff463c", "#2a6df4", "#59359a"][
          index % 3
        ],
      }));
    }
    return FALLBACK_SLIDES;
  }, [slides]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroSlides.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [heroSlides.length, autoPlayInterval]);

  if (!heroSlides || heroSlides.length === 0) {
    return null;
  }

  const currentSlide = heroSlides[activeIndex];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#eef2ff] via-white to-[#f4f7ff] p-6 shadow-sm lg:p-10">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6 pl-2 md:pl-4 lg:pl-8">
          {currentSlide.eyebrow && (
            <span
              className="inline-flex items-center rounded-full bg-white px-4 py-1 text-sm font-semibold uppercase tracking-wide text-[#2a2a2a] shadow-sm"
              style={{ color: currentSlide.accentColor || undefined }}
            >
              {currentSlide.eyebrow}
            </span>
          )}

          <div className="space-y-4 text-balance">
            <h1 className="text-4xl font-black text-[#121212] sm:text-5xl lg:text-6xl">
              {currentSlide.heading}
            </h1>
            {currentSlide.subheading ? (
              <p
                className="text-2xl font-semibold"
                style={{ color: currentSlide.accentColor || "#ff463c" }}
              >
                {currentSlide.subheading}
              </p>
            ) : null}
            {currentSlide.description ? (
              <p className="max-w-xl text-lg text-gray-600">
                {currentSlide.description}
              </p>
            ) : null}
          </div>

          {currentSlide.ctaText && currentSlide.ctaLink ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={currentSlide.ctaLink}
                className="inline-flex items-center rounded-full bg-[#1a1a1a] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#000]"
              >
                {currentSlide.ctaText}
              </Link>
              <Link
                href="/shop?category=all"
                className="inline-flex items-center rounded-full bg-white px-6 py-3 text-base font-semibold text-[#1a1a1a] shadow-inner transition hover:bg-gray-100"
              >
                Explore Categories
              </Link>
            </div>
          ) : null}
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div className="relative h-[320px] w-full overflow-hidden rounded-3xl sm:h-[360px]">
            {currentSlide.image ? (
              <Image
                src={currentSlide.image}
                alt={currentSlide.heading}
                fill
                className="object-contain"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-white/40 via-white/20 to-transparent" />
            )}
          </div>
        </div>
      </div>

      {heroSlides.length > 1 ? (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                index === activeIndex
                  ? "w-8 bg-[#1a1a1a]"
                  : "w-2 bg-[#bcbcbc] hover:w-4 hover:bg-[#8c8c8c]"
              )}
              aria-label={`Go to hero slide ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

