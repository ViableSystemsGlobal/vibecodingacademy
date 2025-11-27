"use client";

import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { EcommerceLayout } from "@/components/ecommerce/layout";
import { CustomerAuthProvider } from "@/contexts/customer-auth-context";
import { useBranding } from "@/contexts/branding-context";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  readTime: string;
  publishedAt: string;
  category: string;
}

const FEATURED_POST: BlogPost = {
  id: "featured",
  slug: "transform-your-poolside-experience",
  title: "Transform Your Poolside Experience with These Summer Essentials",
  excerpt:
    "Upgrade your outdoor oasis with our curated selection of must-have pool accessories, energy-efficient pumps, and smart lighting to create a relaxing retreat.",
  coverImage:
    "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80",
  readTime: "6 min read",
  publishedAt: "2024-05-16",
  category: "Inspiration",
};

const POSTS: BlogPost[] = [
  {
    id: "1",
    slug: "choosing-the-right-pool-pump",
    title: "Choosing the Right Pool Pump: A Buyer’s Guide",
    excerpt:
      "Understanding variable speed vs. single-speed pumps, energy savings, and sizing considerations for your pool.",
    coverImage:
      "https://images.unsplash.com/photo-1505768043011-665fa00b7b81?auto=format&fit=crop&w=1200&q=80",
    readTime: "4 min read",
    publishedAt: "2024-04-29",
    category: "Guides",
  },
  {
    id: "2",
    slug: "water-chemistry-101",
    title: "Water Chemistry 101: Keeping Your Pool Crystal Clear",
    excerpt:
      "Find the perfect balance for pH, alkalinity, and sanitizer levels with our easy-to-follow maintenance schedule.",
    coverImage:
      "https://images.unsplash.com/photo-1507581406343-30005781c5cf?auto=format&fit=crop&w=1200&q=80",
    readTime: "5 min read",
    publishedAt: "2024-04-10",
    category: "Maintenance",
  },
  {
    id: "3",
    slug: "poolside-entertaining",
    title: "Poolside Entertaining: Hosting the Ultimate Weekend Gathering",
    excerpt:
      "From floating loungers to ambient lighting, explore party-ready gear that keeps guests comfortable long after sunset.",
    coverImage:
      "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80",
    readTime: "7 min read",
    publishedAt: "2024-03-27",
    category: "Lifestyle",
  },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BlogContent() {
  const { branding } = useBranding();

  return (
      <EcommerceLayout>
      <div className="bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl text-center mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#23185c]/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-[#23185c]">
              The {branding.companyName || "POOLSHOP"} Journal
                </span>
            <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">
              Dive into Pool Care Tips, Product Guides & Outdoor Inspiration
                </h1>
            <p className="mt-4 text-lg text-gray-600">
              Fresh ideas and practical advice to help you keep your pool sparkling, your backyard inviting, and every swim memorable.
                </p>
              </div>

          {/* Featured Post */}
          <section className="mt-12">
            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              <Link
                href={`/blog/${FEATURED_POST.slug}`}
                className="group overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-80 w-full">
                    <Image
                    src={FEATURED_POST.coverImage ?? "/placeholder.jpg"}
                    alt={FEATURED_POST.title}
                      fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    />
                </div>
                <div className="space-y-4 px-8 py-10">
                  <div className="inline-flex items-center gap-3 text-sm text-[#23185c]">
                    <span className="rounded-full bg-[#23185c]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      {FEATURED_POST.category}
                    </span>
                    <span className="flex items-center gap-2 text-gray-500">
                      <Calendar className="h-4 w-4" />
                      {formatDate(FEATURED_POST.publishedAt)}
                    </span>
                    <span className="flex items-center gap-2 text-gray-500">
                      <Clock className="h-4 w-4" />
                      {FEATURED_POST.readTime}
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 group-hover:text-[#23185c]">
                    {FEATURED_POST.title}
                  </h2>
                  <p className="text-gray-600 text-base">{FEATURED_POST.excerpt}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#23185c] group-hover:gap-3">
                    Keep Reading
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                    </Link>

              <div className="rounded-3xl bg-[#23185c] text-white p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Subscribe for Poolside Insights</h3>
                  <p className="text-slate-100/80 text-sm mb-6">
                    Be first to know about new guides, exclusive promos, and seasonal maintenance checklists curated by our pool experts.
                  </p>
                    </div>
                <form className="space-y-3">
                      <input
                        type="email"
                    placeholder="Email address"
                    className="w-full rounded-full border border-white/30 bg-white/10 px-4 py-3 text-sm placeholder:text-white/70 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/70"
                      />
                      <button
                        type="submit"
                    className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#23185c] transition hover:bg-slate-100"
                      >
                    Join the Newsletter
                      </button>
                    </form>
              </div>
            </div>
          </section>

          {/* Posts Grid */}
              <section className="mt-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Latest Articles</h2>
                  <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-[#23185c] hover:text-[#23185c]"
                  >
                Shop Products Mentioned
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {POSTS.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative h-56 w-full">
                        <Image
                      src={post.coverImage ?? "/placeholder.jpg"}
                          alt={post.title}
                          fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                        />
                  </div>
                  <div className="flex flex-1 flex-col px-6 py-8 space-y-4">
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="rounded-full bg-[#23185c]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#23185c]">
                          {post.category}
                        </span>
                      <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                        {formatDate(post.publishedAt)}
                          </span>
                      <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {post.readTime}
                          </span>
                        </div>
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[#23185c]">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-600 flex-1">{post.excerpt}</p>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#23185c] group-hover:gap-3">
                      Read More
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                          </Link>
                  ))}
            </div>
          </section>
        </div>
        </div>
      </EcommerceLayout>
  );
}

export default function BlogPage() {
  return (
    <CustomerAuthProvider>
      <BlogContent />
    </CustomerAuthProvider>
  );
}

