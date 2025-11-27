"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

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
  role: string;
  isActive: boolean;
  createdAt: string;
  userRoles?: UserRoleAssignment[];
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (userId: string, userData: Partial<User>) => Promise<boolean>;
  user: User | null;
  roles: Role[];
}

const formatRoleLabel = (roleName: string) => {
  if (!roleName) return "";
  if (/[a-z]/.test(roleName)) {
    return roleName
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return roleName
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

export function EditUserModal({ 
  isOpen, 
  onClose, 
  onUpdateUser, 
  user, 
  roles = [] 
}: EditUserModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        isActive: user.isActive ?? true,
      });
      const existingRoleIds = user.userRoles?.map((assignment) => assignment.roleId) || [];
      setSelectedRoleIds(existingRoleIds);
    } else {
      setSelectedRoleIds([]);
    }
  }, [user]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedRoleIds.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      const primaryRoleId = selectedRoleIds[0];
      const primaryRole = roles.find((role) => role.id === primaryRoleId);
      const primaryRoleLabel = formatRoleLabel(primaryRole?.name || '');

      const succeeded = await onUpdateUser(user.id, {
        ...formData,
        role: primaryRoleLabel,
        roleIds: selectedRoleIds,
      });

      if (succeeded) {
      onClose();
      }
    } catch (error) {
      console.error('Error updating user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Edit User
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="mt-1"
              placeholder="+1234567890"
            />
          </div>

          <div>
            <Label>Assigned Roles</Label>
            <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y">
              {roles.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  No roles available.
                </div>
              ) : (
                roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-start space-x-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={(e) => {
                        setSelectedRoleIds((prev) =>
                          e.target.checked
                            ? [...prev, role.id]
                            : prev.filter((id) => id !== role.id)
                        );
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatRoleLabel(role.name)}
                      </p>
                      {role.description && (
                        <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select one or more roles for this user.
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <Label htmlFor="isActive" className="ml-2">
              Active User
            </Label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || selectedRoleIds.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}