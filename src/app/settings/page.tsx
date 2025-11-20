"use client";

import { useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent } from "@/components/ui/card";
import {
  Settings,
  Package,
  Users,
  Building,
  Shield,
  Globe,
  CreditCard,
  FileText,
  FlaskRound,
  Star,
  ChevronRight,
  Search,
  Bell,
  HelpCircle,
  Grid3X3,
  Plus,
  CheckSquare,
  Tag,
  ClipboardList,
  Activity,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();

  const productSettings = [
    {
      id: "categories",
      title: "Categories",
      description: "Manage product categories, subcategories, and organization structure.",
      icon: Package,
      href: "/settings/products/categories"
    },
    {
      id: "price-lists",
      title: "Price Lists",
      description: "Configure pricing strategies, currency settings, and channel-specific pricing.",
      icon: CreditCard,
      href: "/settings/products/price-lists"
    },
    {
      id: "units",
      title: "Units of Measure",
      description: "Define measurement units, conversion factors, and packaging standards.",
      icon: Package,
      href: "/settings/products/units"
    },
    {
      id: "attributes",
      title: "Product Attributes",
      description: "Customize product specifications, variants, and attribute templates.",
      icon: FileText,
      href: "/settings/products/attributes"
    }
  ];

  const businessSettings = [
    {
      id: "company",
      title: "Company Information",
      description: "Business details, legal entity, tax information, and company profile.",
      icon: Building,
      href: "/settings/business/company"
    },
    {
      id: "team",
      title: "Team & Security",
      description: "User management, roles, permissions, and account security settings.",
      icon: Users,
      href: "/settings/business/team"
    },
    {
      id: "appearance",
      title: "Appearance & Branding",
      description: "Theme colors, logo, and visual customization options.",
      icon: Globe,
      href: "/settings/appearance"
    },
    {
      id: "compliance",
      title: "Compliance & Documents",
      description: "Legal compliance, document templates, and regulatory settings.",
      icon: Shield,
      href: "/settings/business/compliance"
    }
  ];

  const taskSettings = [
    {
      id: "task-categories",
      title: "Task Categories",
      description: "Create and manage categories to organize your tasks effectively.",
      icon: Tag,
      href: "/settings/task-categories"
    },
    {
      id: "task-templates",
      title: "Task Templates",
      description: "Create reusable task templates with checklists and predefined settings.",
      icon: ClipboardList,
      href: "/settings/task-templates"
    }
  ];

  const systemSettings = [
    {
      id: "modules",
      title: "Modules",
      description: "Enable or disable system modules to customize functionality.",
      icon: Package,
      href: "/settings/modules"
    },
    {
      id: "audit-log",
      title: "Audit Trail",
      description: "Review detailed activity history and system changes.",
      icon: Activity,
      href: "/settings/system/audit-trail",
    },
    {
      id: "branding",
      title: "Branding",
      description: "Company logo, favicon, and visual identity settings.",
      icon: Star,
      href: "/settings/system/branding"
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Email, SMS, and push notification preferences and templates.",
      icon: Bell,
      href: "/settings/system/notifications"
    },
    {
      id: "integrations",
      title: "Integrations",
      description: "Third-party services, APIs, and external system connections.",
      icon: FlaskRound,
      href: "/settings/system/integrations"
    },
    {
      id: "backup",
      title: "Backup & Recovery",
      description: "Data backup schedules, recovery options, and export settings.",
      icon: ShieldCheck,
      href: "/settings/backup"
    },
    {
      id: "advanced",
      title: "Advanced Settings",
      description: "System configuration, performance tuning, and developer options.",
      icon: Settings,
      href: "/settings/system/advanced"
    }
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your account, business, and system preferences</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <HelpCircle className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Bell className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Settings className="h-5 w-5" />
            </button>
            <button className="p-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Product Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Package className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Product Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productSettings.map((setting) => (
              <Card key={setting.id} className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                        <setting.icon className={`h-5 w-5 text-${theme.primary}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium text-gray-900 group-hover:text-${theme.primaryText} transition-colors`}>
                          {setting.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-400 group-hover:text-${theme.primary} transition-colors`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Business Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Building className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Business Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {businessSettings.map((setting) => (
              <Card key={setting.id} className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                        <setting.icon className={`h-5 w-5 text-${theme.primary}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium text-gray-900 group-hover:text-${theme.primaryText} transition-colors`}>
                          {setting.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-400 group-hover:text-${theme.primary} transition-colors`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Task Management Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <CheckSquare className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Task Management</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taskSettings.map((setting) => (
              <Card key={setting.id} className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                        <setting.icon className={`h-5 w-5 text-${theme.primary}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium text-gray-900 group-hover:text-${theme.primaryText} transition-colors`}>
                          {setting.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-400 group-hover:text-${theme.primary} transition-colors`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* System Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Settings className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">System Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemSettings.map((setting) => (
              <Card key={setting.id} className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                        <setting.icon className={`h-5 w-5 text-${theme.primary}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium text-gray-900 group-hover:text-${theme.primaryText} transition-colors`}>
                          {setting.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-400 group-hover:text-${theme.primary} transition-colors`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Star className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Package className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Import Products</h3>
                    <p className="text-sm text-gray-600">Bulk import from CSV/Excel</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Invite Team</h3>
                    <p className="text-sm text-gray-600">Add team members</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Shield className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Security Check</h3>
                    <p className="text-sm text-gray-600">Review security settings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
