"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { useRouter } from "next/navigation";
import { 
  Shield, 
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  Copy,
  RefreshCw
} from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ConfirmationModal } from "@/components/modals/confirmation-modal";
import { useAsyncConfirmation } from "@/hooks/use-async-confirmation";
import { EditRoleModal } from "@/components/modals/edit-role-modal";

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  memberCount?: number;
  abilities?: Ability[];
  createdAt: string;
  updatedAt?: string;
  roleAbilities?: {
    ability: Ability;
  }[];
  _count?: {
    userRoles: number;
  };
}

interface Ability {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

// Mock data for roles
const MOCK_ROLES: Role[] = [
  {
    id: "1",
    name: "Administrator",
    description: "Full system access and management capabilities",
    isSystem: true,
    isActive: true,
    memberCount: 1,
    abilities: [
      { id: "1", name: "users.manage", resource: "users", action: "manage", description: "Full user management" },
      { id: "2", name: "users.create", resource: "users", action: "create", description: "Create new users" },
      { id: "3", name: "users.edit", resource: "users", action: "edit", description: "Edit user information" },
      { id: "4", name: "users.delete", resource: "users", action: "delete", description: "Delete users" },
      { id: "5", name: "users.profile.manage", resource: "users", action: "profile-manage", description: "Profile management" },
      { id: "6", name: "users.reset.password", resource: "users", action: "reset-password", description: "Reset user passwords" },
      { id: "7", name: "users.login.manage", resource: "users", action: "login-manage", description: "Login management" },
      { id: "8", name: "users.import", resource: "users", action: "import", description: "Import users" },
      { id: "9", name: "users.logs.history", resource: "users", action: "logs-history", description: "View user logs" },
      { id: "10", name: "users.chat.manage", resource: "users", action: "chat-manage", description: "Chat management" },
      { id: "11", name: "roles.manage", resource: "roles", action: "manage", description: "Role management" },
      { id: "12", name: "settings.manage", resource: "settings", action: "manage", description: "System settings" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2",
    name: "Sales Manager",
    description: "Sales team management and oversight",
    isSystem: true,
    isActive: true,
    memberCount: 2,
    abilities: [
      { id: "13", name: "users.edit", resource: "users", action: "edit", description: "Edit user information" },
      { id: "14", name: "users.profile.manage", resource: "users", action: "profile-manage", description: "Profile management" },
      { id: "15", name: "users.login.manage", resource: "users", action: "login-manage", description: "Login management" },
      { id: "16", name: "users.logs.history", resource: "users", action: "logs-history", description: "View user logs" },
      { id: "17", name: "users.chat.manage", resource: "users", action: "chat-manage", description: "Chat management" },
      { id: "18", name: "leads.manage", resource: "leads", action: "manage", description: "Lead management" },
      { id: "19", name: "opportunities.manage", resource: "opportunities", action: "manage", description: "Opportunity management" },
      { id: "20", name: "quotations.manage", resource: "quotations", action: "manage", description: "Quotation management" },
      { id: "21", name: "accounts.manage", resource: "accounts", action: "manage", description: "Account management" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    name: "Sales Representative",
    description: "Customer sales and lead management",
    isSystem: true,
    isActive: true,
    memberCount: 5,
    abilities: [
      { id: "22", name: "users.profile.manage", resource: "users", action: "profile-manage", description: "Profile management" },
      { id: "23", name: "users.logs.history", resource: "users", action: "logs-history", description: "View user logs" },
      { id: "24", name: "users.chat.manage", resource: "users", action: "chat-manage", description: "Chat management" },
      { id: "25", name: "leads.manage", resource: "leads", action: "manage", description: "Lead management" },
      { id: "26", name: "leads.show", resource: "leads", action: "show", description: "View leads" },
      { id: "27", name: "opportunities.manage", resource: "opportunities", action: "manage", description: "Opportunity management" },
      { id: "28", name: "opportunities.show", resource: "opportunities", action: "show", description: "View opportunities" },
      { id: "29", name: "quotations.manage", resource: "quotations", action: "manage", description: "Quotation management" },
      { id: "30", name: "quotations.show", resource: "quotations", action: "show", description: "View quotations" },
      { id: "31", name: "accounts.manage", resource: "accounts", action: "manage", description: "Account management" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "4",
    name: "Inventory Manager",
    description: "Stock and warehouse management",
    isSystem: true,
    isActive: true,
    memberCount: 0,
    abilities: [
      { id: "32", name: "users.profile.manage", resource: "users", action: "profile-manage", description: "Profile management" },
      { id: "33", name: "workspace.manage", resource: "workspace", action: "manage", description: "Workspace management" },
      { id: "34", name: "accounts.manage", resource: "accounts", action: "manage", description: "Account management" },
      { id: "35", name: "products.manage", resource: "products", action: "manage", description: "Product management" },
      { id: "36", name: "products.show", resource: "products", action: "show", description: "View products" },
      { id: "37", name: "inventory.manage", resource: "inventory", action: "manage", description: "Inventory management" },
      { id: "38", name: "warehouses.manage", resource: "warehouses", action: "manage", description: "Warehouse management" },
      { id: "39", name: "stock-movements.manage", resource: "stock-movements", action: "manage", description: "Stock movement management" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "5",
    name: "Finance Officer",
    description: "Financial operations and reporting",
    isSystem: true,
    isActive: true,
    memberCount: 0,
    abilities: [
      { id: "40", name: "users.manage", resource: "users", action: "manage", description: "User management" },
      { id: "41", name: "users.profile.manage", resource: "users", action: "profile-manage", description: "Profile management" },
      { id: "42", name: "users.logs.history", resource: "users", action: "logs-history", description: "View user logs" },
      { id: "43", name: "users.chat.manage", resource: "users", action: "chat-manage", description: "Chat management" },
      { id: "44", name: "workspace.manage", resource: "workspace", action: "manage", description: "Workspace management" },
      { id: "45", name: "roles.manage", resource: "roles", action: "manage", description: "Role management" },
      { id: "46", name: "quotations.manage", resource: "quotations", action: "manage", description: "Quotation management" },
      { id: "47", name: "invoices.manage", resource: "invoices", action: "manage", description: "Invoice management" },
      { id: "48", name: "payments.manage", resource: "payments", action: "manage", description: "Payment management" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export default function RoleManagementPage() {
  const formatRoleName = (name: string) => {
    if (!name) return "";
    if (/[a-z]/.test(name)) {
      return name
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
    return name
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  };
  const { success, error: showError } = useToast();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const router = useRouter();
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const deleteConfirmation = useAsyncConfirmation();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/roles/public');
      if (response.ok) {
        const data = await response.json();
        const rolesData = data.roles || [];
        // Ensure all roles have proper structure
        const sanitizedRoles = rolesData.map((role: any) => ({
          ...role,
          memberCount: role.memberCount || 0,
          abilities: role.abilities || [],
          roleAbilities: role.roleAbilities || [],
          isSystem: Boolean(role.isSystem),
          isActive: Boolean(role.isActive),
        }));
        setRoles(sanitizedRoles);
      } else {
        // Fallback to mock data if API fails
        setRoles(MOCK_ROLES);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      // Fallback to mock data
      setRoles(MOCK_ROLES);
    }
    setIsLoading(false);
  };

  const handleSyncPermissions = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/system/permissions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || "Failed to sync permissions";
        const errorDetails = errorData?.details ? `: ${errorData.details}` : "";
        const errorCode = errorData?.code ? ` (Code: ${errorData.code})` : "";
        throw new Error(`${errorMessage}${errorDetails}${errorCode}`);
      }

      const data = await response.json();
      success(
        data?.message ||
          "Permissions synchronized. Refreshing role catalog..."
      );
      await loadData();
    } catch (error: any) {
      console.error("Permission sync failed:", error);
      showError(error.message || "Failed to sync permissions");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedRole(null);
    loadData(); // Reload roles to get updated data
  };

  const handleDeleteRole = (role: Role) => {
    setSelectedRole(role);
    deleteConfirmation.confirm(
      {
        title: 'Delete Role',
        message: `Are you sure you want to delete the "${role.name}" role? This action cannot be undone and will permanently remove the role from the system.`,
        confirmText: 'Delete Role',
        cancelText: 'Cancel',
        type: 'danger'
      },
      async () => {
        if (!selectedRole) return;

        const response = await fetch(`/api/roles/${selectedRole.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setRoles(prev => prev.filter(r => r.id !== selectedRole.id));
          success('Role deleted successfully');
          setSelectedRole(null);
        } else {
          const error = await response.json();
          showError(error.error || 'Failed to delete role');
          throw new Error(error.error || 'Failed to delete role');
        }
      }
    );
  };

  const handleDuplicateRole = async (role: Role) => {
    try {
      setIsLoading(true);
      
      // Get the role's abilities
      const abilities = role.roleAbilities?.map(ra => ra.ability.id) || [];
      
      // Create duplicate role data
      const duplicateRoleData = {
        name: `${role.name} (Copy)`,
        description: role.description || '',
        abilities: abilities
      };

      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateRoleData),
      });

      if (response.ok) {
        const newRole = await response.json();
        setRoles(prev => [newRole.role, ...prev]);
        success(`Role "${role.name}" duplicated successfully`);
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to duplicate role');
      }
    } catch (error) {
      console.error('Error duplicating role:', error);
      showError('Failed to duplicate role');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Roles</h1>
            <p className="text-gray-600">View and manage existing roles</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSyncPermissions}
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              {isSyncing ? (
                <div className="h-4 w-4 border-2 border-t-transparent border-gray-500 rounded-full animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>{isSyncing ? "Syncing..." : "Sync system roles"}</span>
            </Button>

          <Button
            onClick={() => router.push('/settings/roles/create')}
            className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.filter(r => r.isSystem).length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.filter(r => !r.isSystem).length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.reduce((sum, r) => sum + (r.memberCount || 0), 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Roles List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Roles</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading roles...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRoles.map((role) => (
                  <div
                    key={role.id}
                    className="p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${theme.primaryBg} text-${theme.primaryText}`}>
                          {formatRoleName(role.name)}
                        </span>
                        {role.isSystem && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            System
                          </span>
                        )}
                      </div>
                      <DropdownMenu
                        trigger={
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                        items={[
                          {
                            label: "Edit Role",
                            icon: <Edit className="h-4 w-4" />,
                            onClick: () => handleEditRole(role)
                          },
                          {
                            label: "Duplicate Role",
                            icon: <Copy className="h-4 w-4" />,
                            onClick: () => handleDuplicateRole(role)
                          },
                          {
                            label: "Delete Role",
                            icon: <Trash2 className="h-4 w-4" />,
                            onClick: () => role.isSystem ? null : handleDeleteRole(role),
                            className: role.isSystem ? "text-gray-400 cursor-not-allowed" : "text-red-600 hover:text-red-700"
                          }
                        ]}
                      />
                    </div>

                    {role.description && (
                      <p className="text-sm text-gray-600 mb-4">{role.description}</p>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Members: {role.memberCount || 0}</span>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Abilities:</p>
                        <div className="flex flex-wrap gap-1">
                          {(role.roleAbilities || []).slice(0, 5).map((ra) => (
                            <span
                              key={ra.ability.id}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${theme.primaryBg} text-${theme.primaryText}`}
                            >
                              {ra.ability.name}
                            </span>
                          ))}
                          {(role.roleAbilities?.length || 0) > 5 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              +{(role.roleAbilities?.length || 0) - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredRoles.length === 0 && (
                  <div className="col-span-full text-center py-8">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No roles found</h3>
                    <p className="text-gray-600">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Create your first role to get started'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Role Modal */}
        <EditRoleModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRole(null);
          }}
          onSuccess={handleEditSuccess}
          role={selectedRole}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() => {
            deleteConfirmation.close();
            setSelectedRole(null);
          }}
          onConfirm={deleteConfirmation.handleConfirm}
          title={deleteConfirmation.options?.title || ''}
          message={deleteConfirmation.options?.message || ''}
          confirmText={deleteConfirmation.options?.confirmText}
          cancelText={deleteConfirmation.options?.cancelText}
          type={deleteConfirmation.options?.type}
          isLoading={deleteConfirmation.isLoading}
        />
      </div>
    </>
  );
}
