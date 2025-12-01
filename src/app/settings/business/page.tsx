"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/contexts/theme-context";
import { 
  ArrowLeft,
  Building, 
  Users, 
  Globe, 
  Shield,
  ChevronRight,
  Search,
  Bell,
  HelpCircle,
  Grid3X3,
  Plus,
  Settings
} from "lucide-react";
import Link from "next/link";

export default function BusinessSettingsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();

  const businessSettings = [
    {
      id: "company",
      title: "Company Information",
      description: "Business details, legal entity, tax information, and company profile.",
      icon: Building,
      href: "/settings/business/company",
      status: "active",
      lastUpdated: "2 days ago"
    },
    {
      id: "team",
      title: "Team & Security",
      description: "User management, roles, permissions, and account security settings.",
      icon: Users,
      href: "/settings/business/team",
      status: "active",
      lastUpdated: "1 week ago"
    },
    {
      id: "appearance",
      title: "Appearance & Branding",
      description: "Theme colors, logo, and visual customization options.",
      icon: Globe,
      href: "/settings/appearance",
      status: "active",
      lastUpdated: "3 hours ago"
    },
    {
      id: "compliance",
      title: "Compliance & Documents",
      description: "Legal compliance, document templates, and regulatory settings.",
      icon: Shield,
      href: "/settings/business/compliance",
      status: "pending",
      lastUpdated: "Never"
    }
  ];

  const filteredSettings = businessSettings.filter(setting =>
    setting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    setting.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Business Settings</h1>
              <p className="text-sm sm:text-base text-gray-600">Manage your company information, team, and business preferences</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-auto"
              />
            </div>
            <div className="flex items-center gap-1 sm:gap-0">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Grid3X3 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button 
                className="p-2 text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: getThemeColor() }}
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Team Members</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">12</div>
              <p className="text-xs text-gray-500">
                +2 this month
              </p>
            </CardContent>
          </Card>
          
          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Roles</CardTitle>
              <Shield className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">5</div>
              <p className="text-xs text-gray-500">
                Admin, Manager, Sales, etc.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Company Profile</CardTitle>
              <Building className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">85%</div>
              <p className="text-xs text-gray-500">
                Profile completion
              </p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Security Score</CardTitle>
              <Shield className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">A+</div>
              <p className="text-xs text-gray-500">
                Excellent security
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Business Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Building className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Business Configuration</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {filteredSettings.map((setting) => (
              <Link key={setting.id} href={setting.href}>
                <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                          <setting.icon className={`h-5 w-5 text-${theme.primary}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className={`font-medium text-gray-900 group-hover:text-${theme.primaryText} transition-colors`}>
                              {setting.title}
                            </h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              setting.status === 'active' 
                                ? `bg-${theme.primaryBg} text-${theme.primaryText}` 
                                : 'bg-gray-50 text-gray-500'
                            }`}>
                              {setting.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {setting.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Last updated: {setting.lastUpdated}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 text-gray-400 group-hover:text-${theme.primary} transition-colors`} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Settings className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                    <Users className={`h-5 w-5 text-${theme.primary}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Invite Team Member</h3>
                    <p className="text-sm text-gray-600">Add new users to your team</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                    <Building className={`h-5 w-5 text-${theme.primary}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Update Company Info</h3>
                    <p className="text-sm text-gray-600">Edit business details</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg group-hover:bg-${theme.primaryHover} transition-colors`}>
                    <Shield className={`h-5 w-5 text-${theme.primary}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Security Audit</h3>
                    <p className="text-sm text-gray-600">Review security settings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Bell className={`h-5 w-5 text-${theme.primary}`} />
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <Users className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">John Doe joined the team</p>
                    <p className="text-xs text-gray-500">2 hours ago • Sales Manager role</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <Building className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Company profile updated</p>
                    <p className="text-xs text-gray-500">1 day ago • Tax information added</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <Globe className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Theme color changed to Blue</p>
                    <p className="text-xs text-gray-500">3 days ago • Appearance settings</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
