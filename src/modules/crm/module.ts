import { BarChart3, Building, UserCheck, Users } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "crm",
  displayName: "Customer Relationship Management",
  description: "Lead, opportunity, account, and contact management tooling.",
  version: "1.0.0",
  priority: 20,
  navigation: [
    {
      name: "CRM",
      href: "/crm",
      icon: Users,
      module: "crm",
      order: 20,
      children: [
        { name: "Leads", href: "/crm/leads", icon: UserCheck, module: "leads", order: 10 },
        { name: "Opportunities", href: "/crm/opportunities", icon: BarChart3, module: "opportunities", order: 20 },
        { name: "Accounts", href: "/crm/accounts", icon: Building, module: "accounts", order: 30 },
        { name: "Contacts", href: "/crm/contacts", icon: Users, module: "contacts", order: 40 },
      ],
    },
  ],
});
