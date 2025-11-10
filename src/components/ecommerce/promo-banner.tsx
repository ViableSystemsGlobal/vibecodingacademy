import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PromoBannerProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  gradient?: string;
}

export function EcommercePromoBanner({
  eyebrow = "Limited Time Offer",
  title = "Turn Your Backyard into a Paradise",
  description = "Pool floats, lights, speakers, and more—bundle and save with our curated resort-ready kits. Perfect for weekend gatherings and after-hours swims.",
  ctaText = "Shop Backyard Kits",
  ctaHref = "/shop?category=accessories",
  gradient = "from-indigo-600 via-purple-500 to-pink-500",
}: PromoBannerProps) {
  return (
    <div className="container mx-auto px-4">
      <div
        className={`flex flex-col overflow-hidden rounded-3xl bg-gradient-to-r ${gradient} p-8 text-white shadow-lg md:flex-row md:items-center md:justify-between`}
      >
        <div>
          {eyebrow ? (
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {eyebrow}
            </span>
          ) : null}
          <h3 className="mt-4 text-3xl font-bold leading-tight">{title}</h3>
          <p className="mt-3 max-w-xl text-sm text-white/80">{description}</p>
        </div>
        {ctaHref ? (
          <Link
            href={ctaHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-600 shadow transition hover:bg-indigo-50 md:mt-0"
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
