import { Suspense } from "react";
import type { Metadata } from "next";
import AbandonedCartsClient from "./pageClient";

export const metadata: Metadata = {
  title: "Abandoned Carts | Ecommerce | Sales Management System",
  description: "View and manage abandoned shopping carts",
};

export default function AbandonedCartsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading abandoned carts...</div>}>
      <AbandonedCartsClient />
    </Suspense>
  );
}

