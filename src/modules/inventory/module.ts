import {
  BarChart3,
  Building,
  CheckSquare,
  FileText,
  Package,
  Printer,
  Users,
  Warehouse,
} from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "inventory",
  displayName: "Inventory",
  description: "Product catalogs, stock control, suppliers, and warehouses.",
  version: "1.0.0",
  priority: 50,
  navigation: [
    {
      name: "Inventory",
      href: "/inventory",
      icon: Warehouse,
      module: "inventory",
      order: 50,
      children: [
        { name: "All Products", href: "/products", icon: Package, module: "products", order: 10 },
        { name: "Product Labels", href: "/products/labels", icon: Printer, module: "products", order: 20 },
        { name: "Price Lists", href: "/price-lists", icon: FileText, module: "price-lists", order: 30 },
        { name: "Stock Overview", href: "/inventory/stock", icon: BarChart3, module: "inventory", order: 40 },
        { name: "Stock Movements", href: "/inventory/stock-movements", icon: BarChart3, module: "inventory", order: 50 },
        { name: "Physical Count", href: "/inventory/stocktake", icon: CheckSquare, module: "inventory", order: 60 },
        { name: "Warehouses", href: "/warehouses", icon: Building, module: "warehouses", order: 70 },
        { name: "Suppliers", href: "/inventory/suppliers", icon: Users, module: "inventory", order: 80 },
        { name: "Backorders", href: "/backorders", icon: Package, module: "backorders", order: 90 },
      ],
    },
  ],
});
