import {
  BarChart3,
  Bell,
  Building,
  CheckSquare,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  MapPin,
  Package,
  Settings as SettingsIcon,
  Activity,
  Shield,
  Store,
  UserCheck,
  Users,
} from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "settings",
  displayName: "Settings",
  description: "Administrative configuration screens.",
  version: "1.0.0",
  priority: 120,
  navigation: [
    {
      name: "Settings",
      href: "/settings",
      icon: SettingsIcon,
      module: "settings",
      order: 120,
      children: [
        { name: "User Management", href: "/settings/users", icon: Users, module: "users", order: 10 },
        { name: "Role Management", href: "/settings/roles", icon: Shield, module: "roles", order: 20 },
        { name: "Notifications", href: "/settings/notifications", icon: Bell, module: "notifications", order: 30 },
        { name: "Notification Templates", href: "/settings/notification-templates", icon: FileText, module: "notification_templates", order: 40 },
        { name: "Task Templates", href: "/settings/task-templates", icon: CheckSquare, module: "task_templates", order: 50 },
        { name: "Lead Sources", href: "/settings/lead-sources", icon: UserCheck, module: "lead_sources", order: 60 },
        { name: "Product Settings", href: "/settings/products", icon: Package, module: "product-settings", order: 70 },
        { name: "Ecommerce Settings", href: "/ecommerce/settings", icon: Store, module: "ecommerce-settings", order: 75 },
        { name: "Currency Settings", href: "/settings/currency", icon: DollarSign, module: "currency-settings", order: 80 },
        { name: "Business Settings", href: "/settings/business", icon: Building, module: "business-settings", order: 90 },
        { name: "Google Maps", href: "/settings/google-maps", icon: MapPin, module: "google-maps", order: 100 },
        { name: "Credit Monitoring", href: "/settings/credit-monitoring", icon: CreditCard, module: "credit-monitoring", order: 110 },
        { name: "AI Settings", href: "/settings/ai", icon: BarChart3, module: "ai-settings", order: 120 },
        { name: "Backup & Restore", href: "/settings/backup", icon: Database, module: "backup-settings", order: 130 },
        { name: "Modules", href: "/settings/modules", icon: Package, module: "modules", order: 135 },
        { 
          name: "System Settings", 
          href: "/settings/system", 
          icon: SettingsIcon, 
          module: "system-settings", 
          order: 140,
          children: [
            { name: "Audit Trail", href: "/settings/system/audit-trail", icon: Activity, module: "audit-trail", order: 150 },
            { name: "Cron Jobs & Reminders", href: "/settings/system/cron", icon: Clock, module: "cron-settings", order: 151 },
          ]
        },
      ],
    },
  ],
});
