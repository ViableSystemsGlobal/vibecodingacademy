"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { 
  Users, 
  Plus,
  Edit,
  Trash2,
  Key,
  ArrowRight,
  Check,
  User,
  Mail,
  Phone,
  Shield,
  Eye,
  EyeOff,
  Grid,
  List,
  MoreHorizontal
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import AddUserModal from "@/components/modals/add-user-modal";
import { EditUserModal } from "@/components/modals/edit-user-modal";
import { ChangePasswordModal } from "@/components/modals/change-password-modal";
import { UserDetailsModal } from "@/components/modals/user-details-modal";
import { ConfirmationModal } from "@/components/modals/confirmation-modal";
import { useAsyncConfirmation } from "@/hooks/use-async-confirmation";

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
}

interface UserRoleAssignment {
  id: string;
  roleId: string;
  role?: Role;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  avatar?: string;
  userRoles?: UserRoleAssignment[];
}

// Mock data for users - only the admin user
const MOCK_USERS: User[] = [
  {
    id: "cmfi6s8um00008o6nh4kryxph",
    name: "Admin User",
    email: "admin@adpools.com",
    phone: "+233 30 123 4567",
    role: "Super Admin",
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z"
  }
];

export default function UserManagementPage() {
  const { success, error: showError } = useToast();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { data: session, update: updateSession } = useSession();
  
  const formatRoleLabel = (value: string) => {
    if (!value) return "";
    if (/[a-z]/.test(value)) {
      return value
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
    return value
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  };

  const normalizeRoleValue = (value: string) =>
    value ? value.replace(/\s+/g, "_").toUpperCase() : "";

  const getUserRoleLabels = (user: User) => {
    if (user.userRoles && user.userRoles.length > 0) {
      return user.userRoles
        .map((assignment) => assignment.role?.name)
        .filter(Boolean)
        .map((name) => formatRoleLabel(name as string));
    }
    return [formatRoleLabel(user.role)];
  };

  const getPrimaryRoleLabel = (user: User) => {
    const labels = getUserRoleLabels(user);
    return labels[0] || '';
  };
  
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const deleteConfirmation = useAsyncConfirmation();

  const systemRoleOptions = useMemo(() => {
    const unique = new Set<string>();
    roles.forEach((role) => {
      if (role.name && /^[A-Z_]+$/.test(role.name)) {
        unique.add(role.name);
      }
    });
    return Array.from(unique).map((value) => ({
      value,
      label: formatRoleLabel(value),
    }));
  }, [roles]);

  // Initial load on mount
  useEffect(() => {
    loadRoles();
    if (viewMode === 'list') {
      fetchUsers(1);
    } else {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for sorting and filters (list view only)
  useEffect(() => {
    if (viewMode === 'list') {
      const isInitialMount = currentPage === 1 && !searchTerm && !roleFilter && !sortBy;
      if (isInitialMount) {
        return;
      }
      fetchUsers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, sortBy, sortOrder, viewMode]);

  // Debounced search effect (list view only)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (viewMode === 'list') {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      
      const timeoutId = setTimeout(() => {
        setCurrentPage(1);
        fetchUsers(1);
      }, searchTerm ? 500 : 0);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, viewMode]);

  const loadRoles = async () => {
    try {
      const rolesResponse = await fetch('/api/roles/public');
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setRoles(rolesData.roles || []);
      } else {
        console.error('Failed to fetch roles');
        setRoles([]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles([]);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load users from API (for grid view)
      const usersResponse = await fetch('/api/users/public');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      } else {
        console.error('Failed to fetch users');
        setUsers(MOCK_USERS); // Fallback to mock data
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setUsers(MOCK_USERS); // Fallback to mock data
    }
    setIsLoading(false);
  };

  const fetchUsers = async (page: number = currentPage) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (roleFilter) {
        params.append('role', roleFilter);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }
      
      const response = await fetch(`/api/users?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch users');
        setUsers([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };


  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowUserDetailsModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowEditUserModal(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    deleteConfirmation.confirm(
      {
        title: 'Delete User',
        message: `Are you sure you want to delete "${user.name || 'this user'}"? This action cannot be undone and will permanently remove the user and ALL their associated data (tasks, accounts, leads, messages, etc.) from the system.\n\nTo confirm, type "DELETE PERMANENTLY" below:`,
        confirmText: 'Delete User & All Data',
        cancelText: 'Cancel',
        type: 'danger',
        requireConfirmationText: 'DELETE PERMANENTLY'
      },
      async () => {
        // Use the user parameter directly instead of userToDelete state
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          if (viewMode === 'list') {
            await fetchUsers(currentPage);
          } else {
            setUsers(prev => prev.filter(u => u.id !== user.id));
            await loadData();
          }
          success('User deleted successfully');
          setUserToDelete(null);
        } else {
          console.error('User deletion response status:', response.status);
          console.error('User deletion response headers:', Object.fromEntries(response.headers.entries()));
          
          let error;
          try {
            const responseText = await response.text();
            console.error('Raw response text:', responseText);
            
            if (responseText.trim()) {
              error = JSON.parse(responseText);
            } else {
              error = { error: 'Empty response from server' };
            }
          } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            error = { error: 'Invalid response from server' };
          }
          
          console.error('Parsed error object:', error);
          
          // Show detailed error message
          let errorMessage = error.error || 'Failed to delete user';
          if (error.details) {
            if (typeof error.details === 'string') {
              errorMessage += `: ${error.details}`;
            } else if (error.details.totalRelations > 0) {
              errorMessage += `. User has ${error.details.totalRelations} associated records.`;
            }
          }
          
          showError(errorMessage);
          // Close the modal even on error
          setUserToDelete(null);
        }
      }
    );
  };

  const handleChangePassword = (user: User) => {
    setSelectedUser(user);
    setShowChangePasswordModal(true);
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/users/${user.id}/toggle-status`, {
        method: 'PUT',
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(prev => prev.map(u => u.id === user.id ? data.user : u));
        success(data.message);
        await loadData(); // Reload to update metrics
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      showError('Failed to update user status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<User>) => {
    let wasSuccessful = false;
    try {
      setIsLoading(true);
      
      // Map role name back to enum value
      const roleMapping: { [key: string]: string } = {
        'Super Admin': 'ADMIN',
        'Sales Manager': 'SALES_MANAGER',
        'Sales Rep': 'SALES_REP',
        'Inventory Manager': 'INVENTORY_MANAGER',
        'Finance Officer': 'FINANCE_OFFICER',
        'Executive Viewer': 'EXECUTIVE_VIEWER'
      };
      
      const mappedUserData = {
        ...userData,
        role: userData.role ? roleMapping[userData.role] || userData.role : undefined
      };
      
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mappedUserData,
          roleIds: userData.roleIds || [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
        
        // If updating the current user's role, refresh the session
        if (session?.user?.id === userId && userData.roleIds) {
          // Trigger session refresh by calling update
          await updateSession();
          success('User updated successfully. Your session has been refreshed. Please refresh the page to see your updated role.');
        } else {
        success('User updated successfully');
        }
        
        setShowEditUserModal(false);
        await loadData(); // Reload to update metrics
        wasSuccessful = true;
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showError('Failed to update user');
    } finally {
      setIsLoading(false);
    }
    return wasSuccessful;
  };

  const handleChangeUserPassword = async (userId: string, newPassword: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/users/${userId}/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        success('Password changed successfully');
        setShowChangePasswordModal(false);
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showError('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (newUser: Partial<User> & { roleIds?: string[] }) => {
    let wasSuccessful = false;
    try {
      setIsLoading(true);
      
      // Create user in database
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          password: newUser.password,
          role: newUser.role,
          isActive: newUser.isActive ?? true,
          roleIds: newUser.roleIds || [],
        }),
      });

      if (response.ok) {
        const { user: createdUser } = await response.json();

        if (!createdUser?.id) {
          throw new Error('User creation response missing user payload');
        }

        // Ensure created user has all required fields
        const safeUser = {
          ...createdUser,
          name: createdUser.name || '',
          email: createdUser.email || '',
          phone: createdUser.phone || '',
          role: createdUser.role || 'SALES_REP',
          isActive: createdUser.isActive ?? true
        };

        // Add to local state (avoid duplicates by id)
        if (viewMode === 'list') {
          await fetchUsers(1);
        } else {
          setUsers(prev => [safeUser, ...prev.filter(u => u.id !== safeUser.id)]);
        }
        success('User created successfully');
        setShowAddUserModal(false);
        wasSuccessful = true;
        
        // Reload data to get updated metrics
        if (viewMode === 'grid') {
          await loadData();
        }
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showError('Failed to create user');
    } finally {
      setIsLoading(false);
    }
    return wasSuccessful;
  };

  const getRoleDisplayName = (role: string) => formatRoleLabel(role);

  const getRoleColor = (roleLabel: string) => {
    switch (roleLabel) {
      case "Super Admin":
        return "bg-red-100 text-red-800";
      case "Admin":
        return "bg-purple-100 text-purple-800";
      case "Sales Manager":
        return "bg-blue-100 text-blue-800";
      case "Sales Rep":
        return "bg-green-100 text-green-800";
      case "Inventory Manager":
        return "bg-amber-100 text-amber-800";
      case "Finance Officer":
        return "bg-indigo-100 text-indigo-800";
      case "Executive Viewer":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Only filter for grid view (list view uses server-side filtering)
  const filteredUsers = viewMode === 'grid' ? users.filter(user => {
    // Safely handle undefined/null values
    const userName = user.name || '';
    const userEmail = user.email || '';
    
    const matchesSearch = userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      !roleFilter ||
      user.role === roleFilter ||
      (user.userRoles?.some(
        (assignment) => normalizeRoleValue(assignment.role?.name || "") === roleFilter
      ) ?? false);
    
    return matchesSearch && matchesRole;
  }) : users;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-600">Dashboard &gt; Users</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowAddUserModal(true)}
              className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter(u => u.role === "Staff").length}</div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Check className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter(u => u.isActive).length}</div>
            </CardContent>
          </Card>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newMode = viewMode === "grid" ? "list" : "grid";
              setViewMode(newMode);
              if (newMode === 'list') {
                fetchUsers(1);
              } else {
                loadData();
              }
            }}
            className="flex items-center space-x-2"
          >
            {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
            <span>{viewMode === "grid" ? "Table View" : "Grid View"}</span>
          </Button>
        </div>

        {/* Users Display */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Add New User Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2 border-gray-300 hover:border-gray-400"
              onClick={() => setShowAddUserModal(true)}
            >
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <div className={`w-16 h-16 rounded-full bg-${theme.primary} flex items-center justify-center mb-4`}>
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">New User</h3>
                <p className="text-sm text-gray-600">Click here to Create New User</p>
              </CardContent>
            </Card>

            {/* User Cards */}
            {filteredUsers.map((user) => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.name || 'User'}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600">
                          {getInitials(user.name || '')}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {user.name || 'Unnamed User'}
                      </h3>
                      <p className="text-xs text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenu
                    trigger={
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                    }
                    items={[
                      {
                        label: "Edit User",
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => handleEditUser(user)
                      },
                      {
                        label: "Change Password",
                        icon: <Key className="h-4 w-4" />,
                        onClick: () => handleChangePassword(user)
                      },
                      {
                        label: "View Details",
                        icon: <ArrowRight className="h-4 w-4" />,
                        onClick: () => handleViewUser(user)
                      },
                      {
                        label: "Delete User",
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => handleDeleteUser(user),
                        className: "text-red-600 hover:text-red-700"
                      }
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Phone className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600">{user.phone || "No phone"}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {getUserRoleLabels(user).map((label, index) => (
                        <span
                          key={`${label}-${index}`}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(label)}`}
                        >
                          {label}
                    </span>
                      ))}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="h-3 w-3 text-gray-500 cursor-pointer hover:text-gray-700"
                        title="Edit user"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="h-3 w-3 text-gray-500 cursor-pointer hover:text-red-600"
                        title="Delete user"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleChangePassword(user)}
                        className="h-3 w-3 text-gray-500 cursor-pointer hover:text-gray-700"
                        title="Change password"
                      >
                        <Key className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(user)}
                        className={`h-3 w-3 cursor-pointer ${
                          user.isActive 
                            ? 'text-green-500 hover:text-green-600' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title={user.isActive ? 'Deactivate user' : 'Activate user'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleViewUser(user)}
                        className="h-3 w-3 text-gray-500 cursor-pointer hover:text-gray-700"
                        title="View user details"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-6">
              <DataTable
                data={users}
                columns={[
                  {
                    key: 'name',
                    label: 'Name',
                    sortable: true,
                    exportable: true,
                    render: (user: User) => (
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt={user.name || 'User'}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-600">
                              {getInitials(user.name || '')}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name || 'Unnamed User'}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    ),
                    exportFormat: (user: User) => user.name || 'Unnamed User'
                  },
                  {
                    key: 'phone',
                    label: 'Phone',
                    sortable: true,
                    exportable: true,
                    render: (user: User) => (
                      <span className="text-sm text-gray-900">{user.phone || '-'}</span>
                    ),
                    exportFormat: (user: User) => user.phone || '-'
                  },
                  {
                    key: 'role',
                    label: 'Role',
                    sortable: true,
                    exportable: true,
                    render: (user: User) => {
                      const labels = getUserRoleLabels(user);
                      return (
                        <div className="flex flex-wrap gap-1">
                          {labels.map((label, index) => (
                            <span
                              key={`${label}-${index}`}
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(label)}`}
                            >
                              {label}
                        </span>
                          ))}
                        </div>
                      );
                    },
                    exportFormat: (user: User) => getUserRoleLabels(user).join(', ')
                  },
                  {
                    key: 'isActive',
                    label: 'Status',
                    sortable: true,
                    exportable: true,
                    render: (user: User) => (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    ),
                    exportFormat: (user: User) => user.isActive ? 'Active' : 'Inactive'
                  },
                  {
                    key: 'lastLoginAt',
                    label: 'Last Login',
                    sortable: true,
                    exportable: true,
                    render: (user: User) => (
                      <span className="text-sm text-gray-900">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                      </span>
                    ),
                    exportFormat: (user: User) => user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    sortable: false,
                    exportable: false,
                    render: (user: User) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewUser(user)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleChangePassword(user)}>
                            <Key className="h-4 w-4 mr-2" />
                            Change Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                            {user.isActive ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                ]}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  fetchUsers(page);
                }}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search users by name, email, or phone..."
                enableExport={true}
                exportFilename="users"
                isLoading={isLoading}
                onRowClick={(user) => handleViewUser(user)}
                customFilters={
                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Roles</option>
                    {systemRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        </option>
                    ))}
                  </select>
                }
              />
            </CardContent>
          </Card>
        )}

        {/* Add User Modal */}
        <AddUserModal
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onAddUser={handleAddUser}
          roles={roles}
        />

        {/* Edit User Modal */}
        <EditUserModal
          isOpen={showEditUserModal}
          onClose={() => setShowEditUserModal(false)}
          onUpdateUser={handleUpdateUser}
          user={selectedUser}
          roles={roles}
        />

        {/* Change Password Modal */}
        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          onChangePassword={handleChangeUserPassword}
          user={selectedUser}
        />

        {/* User Details Modal */}
        <UserDetailsModal
          isOpen={showUserDetailsModal}
          onClose={() => setShowUserDetailsModal(false)}
          user={selectedUser}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() => {
            deleteConfirmation.close();
            setUserToDelete(null);
          }}
          onConfirm={deleteConfirmation.handleConfirm}
          title={deleteConfirmation.options?.title || ''}
          message={deleteConfirmation.options?.message || ''}
          confirmText={deleteConfirmation.options?.confirmText}
          cancelText={deleteConfirmation.options?.cancelText}
          type={deleteConfirmation.options?.type}
          isLoading={deleteConfirmation.isLoading}
          requireConfirmationText={deleteConfirmation.options?.requireConfirmationText}
          confirmationText={deleteConfirmation.confirmationText}
          onConfirmationTextChange={deleteConfirmation.updateConfirmationText}
        />
      </div>
    </>
  );
}