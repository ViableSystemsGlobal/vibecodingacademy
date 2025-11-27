import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecommerce Settings | Sales Management System",
  description: "Configure ecommerce store settings, payment methods, and customer preferences",
};

export default function EcommerceSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

