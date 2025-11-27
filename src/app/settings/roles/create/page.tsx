"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  Plus,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Save,
  X
} from "lucide-react";

interface Ability {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

interface Module {
  resource: string;
  label: string;
  icon: string;
  abilities: Ability[];
  expanded: boolean;
}

const RESOURCE_ICONS: Record<string, string> = {
  dashboard: "📊",
  projects: "🏗️",
  tasks: "✅",
  incidents: "🚨",
  inventory: "📦",
  products: "🧱",
  warehouses: "🏬",
  sales: "💼",
  invoices: "🧾",
  payments: "💰",
  leads: "📞",
  accounts: "👥",
  opportunities: "🎯",
  quotations: "📝",
  communication: "✉️",
  notifications: "🔔",
  settings: "⚙️",
  roles: "🛡️",
  users: "👤",
  ecommerce: "🛒",
  reports: "📈",
};

const formatLabel = (resource: string) => {
  return resource
    .split(/[-_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getIconForResource = (resource: string) => {
  return RESOURCE_ICONS[resource] || "🧩";
};

export default function CreateRolePage() {
  const { success, error: showError } = useToast();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const router = useRouter();
  
  const [modules, setModules] = useState<Module[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [abilitiesError, setAbilitiesError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadAbilities = async () => {
      try {
        setIsLoadingModules(true);
        setAbilitiesError(null);
        const response = await fetch("/api/abilities/public");
        if (!response.ok) {
          throw new Error("Failed to load abilities");
        }
        const data = await response.json();
        const abilityList: Ability[] = data.abilities || [];

        const grouped = abilityList.reduce<Record<string, Module>>(
          (acc, ability) => {
            const resourceKey = ability.resource || "general";
            if (!acc[resourceKey]) {
              acc[resourceKey] = {
                resource: resourceKey,
                label: formatLabel(resourceKey),
                icon: getIconForResource(resourceKey),
                abilities: [],
                expanded: resourceKey === "projects" || resourceKey === "dashboard",
              };
            }
            acc[resourceKey].abilities.push(ability);
            return acc;
          },
          {}
        );

        const sortedModules = Object.values(grouped).sort((a, b) =>
          a.label.localeCompare(b.label)
        );

        if (!sortedModules.some((module) => module.expanded) && sortedModules[0]) {
          sortedModules[0].expanded = true;
        }

        setModules(sortedModules);
      } catch (error) {
        console.error("Failed to load abilities:", error);
        setAbilitiesError(
          error instanceof Error ? error.message : "Failed to load abilities"
        );
      } finally {
        setIsLoadingModules(false);
      }
    };

    loadAbilities();
  }, []);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      showError('Role name is required');
      return;
    }

    if (selectedAbilities.length === 0) {
      showError('Select at least one permission for this role');
      return;
    }

    setIsCreating(true);
    
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDescription,
          abilities: selectedAbilities,
        }),
      });

      if (response.ok) {
        success('Role created successfully');
        router.push('/settings/roles');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to create role');
      }
    } catch (error) {
      console.error('Error creating role:', error);
      showError('Failed to create role');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleModule = (moduleName: string) => {
    setModules(prev => prev.map(m => 
      m.resource === moduleName ? { ...m, expanded: !m.expanded } : m
    ));
  };

  const toggleAbility = (abilityId: string) => {
    setSelectedAbilities(prev => 
      prev.includes(abilityId) 
        ? prev.filter(id => id !== abilityId)
        : [...prev, abilityId]
    );
  };

  const totalAbilities = modules.reduce((sum, module) => sum + module.abilities.length, 0);
  const selectedCount = selectedAbilities.length;
  const uniqueModulesSelected = modules.filter((module) =>
    module.abilities.some((ability) => selectedAbilities.includes(ability.id))
  ).length;

  const handleSelectAll = () => {
    const allIds = modules.flatMap((module) => module.abilities.map((ability) => ability.id));
    setSelectedAbilities(allIds);
  };

  const handleClearAll = () => {
    setSelectedAbilities([]);
  };

  const renderModuleSection = (module: Module) => {
    const filteredAbilities = module.abilities.filter((ability) =>
      ability.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ability.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (searchTerm && filteredAbilities.length === 0) {
      return null;
    }

    const abilitiesToRender = searchTerm ? filteredAbilities : module.abilities;
    const allSelected =
      abilitiesToRender.length > 0 &&
      abilitiesToRender.every((ability) => selectedAbilities.includes(ability.id));

    return (
      <div key={module.resource} className="rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">{module.icon}</span>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{module.label}</h3>
              <p className="text-xs text-gray-500">
                {abilitiesToRender.length} permission{abilitiesToRender.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleModule(module.resource)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              {module.expanded ? "Collapse" : "Expand"}
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  const idsToRemove = new Set(abilitiesToRender.map((ability) => ability.id));
                  setSelectedAbilities((prev) => prev.filter((id) => !idsToRemove.has(id)));
                } else {
                  setSelectedAbilities((prev) => {
                    const newIds = abilitiesToRender
                      .map((ability) => ability.id)
                      .filter((id) => !prev.includes(id));
                    return [...prev, ...newIds];
                  });
                }
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {allSelected ? "Clear" : "Select"}
            </button>
          </div>
        </div>

        {module.expanded && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {abilitiesToRender.map((ability) => {
              const isSelected = selectedAbilities.includes(ability.id);
              return (
                <label
                  key={ability.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition",
                    isSelected
                      ? `border-${theme.primary} bg-${theme.primaryBg}`
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAbility(ability.id)}
                    className={`mt-1 h-4 w-4 rounded border-gray-300 text-${theme.primary} focus:ring-${theme.primary}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{ability.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getActionColor(ability.action)}`}>
                        {ability.action}
                      </span>
                    </div>
                    {ability.description && (
                      <p className="mt-1 text-xs text-gray-500">{ability.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const getActionColor = (action: string) => {
    if (action === 'manage') return 'bg-purple-100 text-purple-800';
    if (action === 'create') return 'bg-green-100 text-green-800';
    if (action === 'read' || action === 'show') return 'bg-blue-100 text-blue-800';
    if (action === 'edit') return 'bg-yellow-100 text-yellow-800';
    if (action === 'delete') return 'bg-red-100 text-red-800';
    if (action.includes('profile')) return 'bg-indigo-100 text-indigo-800';
    if (action.includes('password')) return 'bg-orange-100 text-orange-800';
    if (action.includes('login')) return 'bg-teal-100 text-teal-800';
    if (action.includes('import')) return 'bg-pink-100 text-pink-800';
    if (action.includes('logs')) return 'bg-gray-100 text-gray-800';
    if (action.includes('chat')) return 'bg-cyan-100 text-cyan-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Role</h1>
              <p className="text-gray-600">Define a new role and assign permissions</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => router.push('/settings/roles')}
              className="flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={isCreating || !newRoleName.trim() || selectedAbilities.length === 0}
              className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Role
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Role Information</CardTitle>
                <p className="text-sm text-gray-500">
                  Give the role a clear identity before mapping permissions.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input
                    placeholder="e.g., Project Coordinator"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Describe what this role is responsible for..."
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Selection Summary</CardTitle>
                <p className="text-sm text-gray-500">
                  Monitor coverage and finalize when ready.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-2xl font-bold text-gray-900">{selectedCount}</p>
                    <p className="text-xs text-gray-500">Permissions Selected</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-2xl font-bold text-gray-900">{uniqueModulesSelected}</p>
                    <p className="text-xs text-gray-500">Modules Covered</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className={`rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-${theme.primary}`}
                  >
                    Select All ({totalAbilities})
                  </button>
                    <button
                    type="button"
                    onClick={handleClearAll}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500"
                  >
                    Clear All
                    </button>
                </div>

                {selectedAbilities.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-gray-500">Recent picks</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedAbilities.slice(-6).map((abilityId) => (
                        <span
                          key={abilityId}
                          className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700"
                        >
                          {abilityId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleCreateRole}
                  disabled={isCreating || !newRoleName.trim() || selectedAbilities.length === 0}
                  className={`w-full bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
                >
                  {isCreating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Role
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  Roles are activated immediately after creation.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Permissions Catalog</CardTitle>
                    <p className="text-sm text-gray-500">
                      Expand a module and tick the exact permissions this role should own.
                    </p>
                  </div>
                  <div className="relative w-full lg:w-72">
                    <input
                      type="search"
                      placeholder="Quick search permissions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingModules ? (
                  <div className="py-12 text-center text-gray-500">Loading abilities...</div>
                ) : abilitiesError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
                    {abilitiesError}
                      </div>
                ) : modules.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No modules available. Sync your permissions and try again.
                          </div>
                ) : (
                  (() => {
                    const rendered = modules
                      .map((module) => renderModuleSection(module))
                      .filter(Boolean) as JSX.Element[];

                    if (rendered.length === 0) {
                      return (
                        <div className="py-12 text-center text-gray-500">
                          No permissions match “{searchTerm}”.
                        </div>
                      );
                    }

                    return rendered;
                  })()
                      )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
