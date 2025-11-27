import { BarChart3 } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "reports",
  displayName: "Reports",
  description: "Operational and financial reporting surfaces.",
  version: "1.0.0",
  priority: 100,
  navigation: [
    {
      name: "Reports",
      href: "/reports",
      icon: BarChart3,
      module: "reports",
      order: 100,
    },
  ],
});
