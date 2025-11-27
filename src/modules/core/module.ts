import { LayoutDashboard } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "core",
  displayName: "Core",
  description: "Landing dashboards and global overview experiences.",
  version: "1.0.0",
  priority: 10,
  navigation: [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      module: "dashboard",
    },
  ],
});
