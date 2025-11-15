"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { 
  Package, 
  Search,
  RefreshCw,
  Power,
  PowerOff,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Grid3X3,
  List,
  Settings,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Module {
  id?: string;
  slug: string;
  name: string;
  alias?: string;
  description?: string;
  version: string;
  priority: number;
  category?: string;
  isEnabled: boolean;
  isSystem: boolean;
  monthlyPrice?: number;
  yearlyPrice?: number;
  packageName?: string;
  image?: string;
  featureFlags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function ModulesPage() {
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const themeColor = getThemeColor();

  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [togglingModules, setTogglingModules] = useState<Set<string>>(new Set());

  // Fetch modules
  const fetchModules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/modules");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to fetch modules (${response.status})`);
      }
      const data = await response.json();
      setModules(data.modules || []);
    } catch (error: any) {
      console.error("Error fetching modules:", error);
      showError("Error", error.message || "Failed to load modules");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  // Toggle module enable/disable
  const toggleModule = async (module: Module) => {
    if (module.isSystem) {
      showError("Error", "System modules cannot be disabled");
      return;
    }

    if (togglingModules.has(module.slug)) {
      return; // Already toggling
    }

    try {
      setTogglingModules((prev) => new Set(prev).add(module.slug));

      const endpoint = module.isEnabled
        ? `/api/modules/${module.slug}/disable`
        : `/api/modules/${module.slug}/enable`;

      const response = await fetch(endpoint, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to toggle module");
      }

      const data = await response.json();
      
      // Update local state
      setModules((prev) =>
        prev.map((m) =>
          m.slug === module.slug
            ? { ...m, isEnabled: data.module.isEnabled }
            : m
        )
      );

      success(
        module.isEnabled ? "Module Disabled" : "Module Enabled",
        `${module.name || module.slug || "Module"} has been ${module.isEnabled ? "disabled" : "enabled"}`
      );
    } catch (error: any) {
      console.error("Error toggling module:", error);
      showError("Error", error.message || "Failed to toggle module");
    } finally {
      setTogglingModules((prev) => {
        const next = new Set(prev);
        next.delete(module.slug);
        return next;
      });
    }
  };

  // Sync modules from code
  const syncModules = async () => {
    try {
      const response = await fetch("/api/modules", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to sync modules");
      }

      const data = await response.json();
      success("Modules Synced", data.message);
      fetchModules(); // Refresh list
    } catch (error: any) {
      console.error("Error syncing modules:", error);
      showError("Error", error.message || "Failed to sync modules");
    }
  };

  // Get unique categories
  const categories = ["All", ...new Set(modules.map((m) => m.category).filter(Boolean))];

  // Filter modules
  const filteredModules = modules.filter((module) => {
    // Add null/undefined checks to prevent errors
    const moduleName = module?.name || "";
    const moduleSlug = module?.slug || "";
    const moduleDescription = module?.description || "";
    
    const matchesSearch =
      moduleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      moduleSlug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      moduleDescription.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "All" || module?.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedModules = filteredModules.reduce((acc, module) => {
    const category = module.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Settings
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Module Management</h1>
          <p className="text-gray-600">
            Enable or disable modules to customize your system functionality
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={syncModules}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Modules
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Modules</p>
                <p className="text-2xl font-bold">{modules.length}</p>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Enabled</p>
                <p className="text-2xl font-bold text-green-600">
                  {modules.filter((m) => m.isEnabled).length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Disabled</p>
                <p className="text-2xl font-bold text-red-600">
                  {modules.filter((m) => !m.isEnabled).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">System Modules</p>
                <p className="text-2xl font-bold text-blue-600">
                  {modules.filter((m) => m.isSystem).length}
                </p>
              </div>
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search modules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modules List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600">Loading modules...</p>
          </CardContent>
        </Card>
      ) : filteredModules.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Package className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600">No modules found</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        // Grid View
        <div className="space-y-6">
          {Object.entries(groupedModules).map(([category, categoryModules]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryModules.map((module) => (
                  <Card key={module.slug} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{module.name || module.slug || "Unnamed Module"}</CardTitle>
                          <CardDescription className="mt-1">
                            {module.description || `Module: ${module.slug || "unknown"}`}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {module.isSystem && (
                            <Badge variant="outline" className="text-xs">
                              System
                            </Badge>
                          )}
                          <Switch
                            checked={module.isEnabled}
                            onCheckedChange={() => toggleModule(module)}
                            disabled={module.isSystem || togglingModules.has(module.slug)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Version:</span>
                          <span className="font-mono">{module.version}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Priority:</span>
                          <span>{module.priority}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Status:</span>
                          <Badge
                            variant={module.isEnabled ? "default" : "secondary"}
                            className={
                              module.isEnabled
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {module.isEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Module
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredModules.map((module) => (
                    <tr key={module.slug} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900">{module.name || module.slug || "Unnamed Module"}</div>
                            {module.isSystem && (
                              <Badge variant="outline" className="text-xs">
                                System
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{module.slug}</div>
                          {module.description && (
                            <div className="text-sm text-gray-400 mt-1">
                              {module.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {module.category || "Uncategorized"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                        {module.version}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {module.priority}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={module.isEnabled ? "default" : "secondary"}
                          className={
                            module.isEnabled
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {module.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Switch
                          checked={module.isEnabled}
                          onCheckedChange={() => toggleModule(module)}
                          disabled={module.isSystem || togglingModules.has(module.slug)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

