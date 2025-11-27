import { Building, Handshake, MapPin, MessageSquare, Users } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "drm",
  displayName: "Distribution Management",
  description: "Distributor pipeline, routing, and engagement workflows.",
  version: "1.0.0",
  priority: 30,
  navigation: [
    {
      name: "Distribution",
      href: null,
      icon: Handshake,
      module: "drm",
      order: 30,
      children: [
        { name: "Distributor Leads", href: "/drm/distributor-leads", icon: Users, module: "distributor-leads", order: 10 },
        { name: "Distributors", href: "/drm/distributors", icon: Building, module: "distributors", order: 20 },
        { name: "Routes & Mapping", href: "/drm/routes-mapping", icon: MapPin, module: "routes-mapping", order: 30 },
        { name: "Engagement", href: "/drm/engagement", icon: MessageSquare, module: "engagement", order: 40 },
      ],
    },
  ],
});
