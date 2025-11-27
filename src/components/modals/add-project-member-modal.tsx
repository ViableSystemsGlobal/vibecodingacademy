import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface AddProjectMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded?: () => Promise<void> | void;
  projectId: string;
  existingMemberIds?: string[];
}

const PROJECT_ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "CONTRIBUTOR", label: "Contributor" },
  { value: "VIEWER", label: "Viewer" },
  { value: "EXTERNAL", label: "External" },
];

export function AddProjectMemberModal({
  isOpen,
  onClose,
  onMemberAdded,
  projectId,
  existingMemberIds = [],
}: AddProjectMemberModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("CONTRIBUTOR");
  const [isExternal, setIsExternal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
    }
  }, [isOpen, projectId]);

  const fetchAvailableUsers = async () => {
    try {
      setIsFetchingUsers(true);
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.availableUsers || []);
      } else {
        // Fallback: fetch all users
        const usersResponse = await fetch("/api/users");
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          const allUsers = usersData.users || [];
          setUsers(
            allUsers.filter(
              (user: User) => !existingMemberIds.includes(user.id)
            )
          );
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      showError("Failed to load available users");
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUserId) {
      showError("Please select a user");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUserId,
          role,
          isExternal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to add team member");
      }

      success("Team member added successfully");
      setSelectedUserId("");
      setRole("CONTRIBUTOR");
      setIsExternal(false);
      onClose();
      if (onMemberAdded) {
        await onMemberAdded();
      }
    } catch (error) {
      console.error("Error adding team member:", error);
      showError(error instanceof Error ? error.message : "Failed to add team member");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedUserId("");
      setRole("CONTRIBUTOR");
      setIsExternal(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Add a user to this project team and assign their role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User *
            </label>
            {isFetchingUsers ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-sm text-gray-500">
                No available users to add. All users are already team members.
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} {user.name && `(${user.email})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {PROJECT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isExternal"
              checked={isExternal}
              onChange={(e) => setIsExternal(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="isExternal" className="text-sm text-gray-700">
              External team member (not part of organization)
            </label>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedUserId || isFetchingUsers}
            className="text-white border-0"
            style={{ backgroundColor: getThemeColor() }}
            onMouseEnter={(e) => {
              if (!isLoading && selectedUserId) {
                e.currentTarget.style.opacity = "0.9";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && selectedUserId) {
                e.currentTarget.style.opacity = "1";
              }
            }}
          >
            {isLoading ? "Adding..." : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

