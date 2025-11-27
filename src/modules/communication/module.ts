import { BarChart3, FileText, History, Mail, MessageSquare, Smartphone } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "communication",
  displayName: "Communication",
  description: "Messaging channels, templates, and engagement analytics.",
  version: "1.0.0",
  priority: 70,
  navigation: [
    {
      name: "Communication",
      href: "/communication",
      icon: MessageSquare,
      module: "communication",
      order: 70,
      children: [
        { name: "SMS Messages", href: "/communication/sms", icon: Smartphone, module: "sms", order: 10 },
        { name: "SMS History", href: "/communication/sms-history", icon: History, module: "sms-history", order: 20 },
        { name: "Email Messages", href: "/communication/email", icon: Mail, module: "email", order: 30 },
        { name: "Email History", href: "/communication/email-history", icon: History, module: "email-history", order: 40 },
        { name: "Templates", href: "/templates", icon: FileText, module: "templates", order: 50 },
        { name: "Logs", href: "/communication-logs", icon: BarChart3, module: "communication-logs", order: 60 },
      ],
    },
  ],
});
