import {
  BarChart3,
  Globe,
  Image,
  Megaphone,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Users,
  ShoppingBag,
} from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "ecommerce",
  displayName: "Ecommerce",
  description: "Digital storefront management, merchandising, and marketing.",
  version: "1.0.0",
  priority: 60,
  navigation: [
    {
      name: "Ecommerce",
      href: null,
      icon: Store,
      module: "ecommerce",
      order: 60,
      children: [
        { name: "Orders", href: "/ecommerce/orders", icon: ShoppingCart, module: "ecommerce-orders", order: 20 },
        { name: "Abandoned Carts", href: "/ecommerce/abandoned-carts", icon: ShoppingBag, module: "ecommerce-abandoned-carts", order: 25 },
        { name: "Customers", href: "/ecommerce/customers", icon: Users, module: "ecommerce-customers", order: 30 },
        { name: "Categories", href: "/ecommerce/categories", icon: Tag, module: "ecommerce-categories", order: 40 },
        { name: "Best Deals", href: "/ecommerce/best-deals", icon: Tag, module: "ecommerce-best-deals", order: 45 },
        { name: "Banners", href: "/ecommerce/banners", icon: Image, module: "ecommerce-marketing", order: 50 },
        { name: "CMS", href: "/ecommerce/cms", icon: Sparkles, module: "ecommerce-cms", order: 60 },
        { name: "Analytics", href: "/ecommerce/analytics", icon: BarChart3, module: "ecommerce", order: 70 },
        { name: "SEO", href: "/ecommerce/seo", icon: Globe, module: "ecommerce-settings", order: 80 },
        { name: "Marketing", href: "/ecommerce/marketing", icon: Megaphone, module: "ecommerce-marketing", order: 90 },
      ],
    },
  ],
});
