import { CreditCard, UserCheck, Users } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "agents",
  displayName: "Agents & Incentives",
  description: "Field agents, commissions, and incentive management.",
  version: "1.0.0",
  priority: 80,
  navigation: [
    {
      name: "Agents",
      href: "/agents",
      icon: UserCheck,
      module: "agents",
      order: 80,
      children: [
        { name: "Agents", href: "/agents", icon: Users, module: "agents", order: 10 },
        { name: "Commissions", href: "/commissions", icon: CreditCard, module: "commissions", order: 20 },
      ],
    },
  ],
});
