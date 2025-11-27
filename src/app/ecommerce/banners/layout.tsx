import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecommerce Banners | Sales Management System",
  description: "Manage promotional banners for your ecommerce homepage",
};

export default function EcommerceBannersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

