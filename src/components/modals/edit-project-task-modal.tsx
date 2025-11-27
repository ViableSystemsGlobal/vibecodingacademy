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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import TaskDependencies from "@/components/task-dependencies";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface ProjectStage {
  id: string;
  name: string;
  color: string;
}

interface ProjectTask {
  id: string;
  title: string;
  dueDate: string | null;
}

interface EditProjectTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => Promise<void> | void;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string | null;
    dueDate: string | null;
    stageId: string | null;
    assignedTo: string | null;
    assignees?: {
      user: {
        id: string;
        name: string | null;
        email: string | null;
      };
    }[];
    assignee?: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  } | null;
  projectId: string;
  stages: ProjectStage[];
  existingTasks?: ProjectTask[];
}

export function EditProjectTaskModal({
  isOpen,
  onClose,
  onTaskUpdated,
  task,
  projectId,
  stages,
  existingTasks = [],
}: EditProjectTaskModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isFetchingTask, setIsFetchingTask] = useState(false);
  const [fullTask, setFullTask] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    status: "PENDING",
    dueDate: "",
    assignedTo: "",
    assignees: [] as string[],
    assignmentType: "INDIVIDUAL",
    stageId: "",
  });

  useEffect(() => {
    if (isOpen && task) {
      fetchFullTask();
      fetchUsers();
    }
  }, [isOpen, task?.id]);

  const fetchFullTask = async () => {
    if (!task?.id) return;
    try {
      setIsFetchingTask(true);
      const response = await fetch(`/api/tasks/${task.id}`);
      if (response.ok) {
        const data = await response.json();
        const taskData = data.task || data; // Handle both response formats
        if (!taskData) {
          showError("Failed to load task data");
          return;
        }
        setFullTask(taskData);
        setFormData({
          title: taskData.title || "",
          description: taskData.description || "",
          priority: taskData.priority || "MEDIUM",
          status: taskData.status || "PENDING",
          dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString().slice(0, 10) : "",
          assignedTo: taskData.assignedTo || "",
          assignees: taskData.assignees?.map((a: any) => a.userId || a.user?.id) || [],
          assignmentType: taskData.assignmentType || (taskData.assignees && taskData.assignees.length > 1 ? "COLLABORATIVE" : "INDIVIDUAL"),
          stageId: taskData.stageId || taskData.stage?.id || "",
        });
      } else {
        const errorData = await response.json().catch(() => null);
        showError(errorData?.error || "Failed to load task");
      }
    } catch (error) {
      console.error("Error fetching task:", error);
      showError("Failed to load task");
    } finally {
      setIsFetchingTask(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsFetchingUsers(true);
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showError("Task title is required");
      return;
    }

    if (formData.assignmentType === "INDIVIDUAL" && formData.assignees.length === 0 && !formData.assignedTo) {
      showError("Please select at least one assignee");
      return;
    }

    if (!task) return;

    setIsLoading(true);
    try {
      const finalAssignees = formData.assignees.length > 0 
        ? formData.assignees 
        : formData.assignedTo 
        ? [formData.assignedTo] 
        : [];

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          priority: formData.priority,
          status: formData.status,
          dueDate: formData.dueDate || null,
          assignedTo: finalAssignees[0] || null,
          assignees: finalAssignees,
          assignmentType: formData.assignmentType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update task");
      }

      // Update stage if changed
      if (formData.stageId !== task.stageId) {
        await fetch(`/api/projects/${projectId}/tasks/${task.id}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stageId: formData.stageId || null }),
        });
      }

      success("Task updated successfully");
      handleClose();
      if (onTaskUpdated) {
        await onTaskUpdated();
      }
    } catch (error) {
      console.error("Error updating task:", error);
      showError(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const toggleAssignee = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(userId)
        ? prev.assignees.filter((id) => id !== userId)
        : [...prev.assignees, userId],
    }));
  };

  if (!task) return null;

  if (isFetchingTask) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task details, assignees, and stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter task title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={4}
              placeholder="Enter task description..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, priority: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage
              </label>
              <select
                value={formData.stageId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, stageId: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">No stage (unassigned)</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <Input
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Type
            </label>
            <select
              value={formData.assignmentType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  assignmentType: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="COLLABORATIVE">Collaborative</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignees {formData.assignmentType === "INDIVIDUAL" ? "*" : ""}
            </label>
            {isFetchingUsers ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
                {users.length === 0 ? (
                  <div className="text-sm text-gray-500">No users available</div>
                ) : (
                  users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignees.includes(user.id)}
                        onChange={() => toggleAssignee(user.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">
                        {user.name || user.email}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Dependencies Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dependencies
            </label>
            <div className="border border-gray-200 rounded-lg p-4">
              <TaskDependencies
                taskId={task.id}
                currentTaskTitle={task.title}
                onDependenciesChange={onTaskUpdated}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.title.trim()}
            className="text-white border-0"
            style={{ backgroundColor: getThemeColor() }}
            onMouseEnter={(e) => {
              if (!isLoading && formData.title.trim()) {
                e.currentTarget.style.opacity = "0.9";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && formData.title.trim()) {
                e.currentTarget.style.opacity = "1";
              }
            }}
          >
            {isLoading ? "Updating..." : "Update Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

