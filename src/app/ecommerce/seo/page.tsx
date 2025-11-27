import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import EcommerceSeoPageClient from "./pageClient";

export const metadata: Metadata = {
  title: "Ecommerce SEO | Sales Management System",
  description: "Configure SEO settings, meta tags, and search engine optimization",
};

export default function EcommerceSeoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <EcommerceSeoPageClient />
    </Suspense>
  );
}

