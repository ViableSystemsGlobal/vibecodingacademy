import { CreditCard, FileDown, FileText, Package, ShoppingCart } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "sales",
  displayName: "Sales Operations",
  description: "Quotation, order, invoicing, and returns pipeline.",
  version: "1.0.0",
  priority: 40,
  navigation: [
    {
      name: "Sales",
      href: "/sales",
      icon: ShoppingCart,
      module: "sales",
      order: 40,
      children: [
        { name: "Orders", href: "/orders", icon: ShoppingCart, module: "orders", order: 10 },
        { name: "Quotations", href: "/quotations", icon: FileText, module: "quotations", order: 20 },
        { name: "Invoices", href: "/invoices", icon: FileText, module: "invoices", order: 30 },
        { name: "Credit Notes", href: "/credit-notes", icon: FileDown, module: "credit-notes", order: 40 },
        { name: "Payments", href: "/payments", icon: CreditCard, module: "payments", order: 50 },
        { name: "Returns", href: "/returns", icon: Package, module: "returns", order: 60 },
      ],
    },
  ],
});
