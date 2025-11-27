import { Suspense } from "react";
import type { Metadata } from "next";
import EcommerceCustomersClient from "./pageClient";

export const metadata: Metadata = {
  title: "Ecommerce Customers | Sales Management System",
  description: "Manage ecommerce customers, orders, and customer data",
};

export default function EcommerceCustomersPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading customers...</div>}>
      <EcommerceCustomersClient />
    </Suspense>
  );
}


