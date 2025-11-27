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

interface CreateProjectTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => Promise<void> | void;
  projectId: string;
  stages: ProjectStage[];
  defaultStageId?: string | null;
  existingTasks?: ProjectTask[];
}

export function CreateProjectTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  projectId,
  stages,
  defaultStageId,
  existingTasks = [],
}: CreateProjectTaskModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    assignedTo: "",
    assignees: [] as string[],
    assignmentType: "INDIVIDUAL",
    stageId: defaultStageId || "",
    dependencies: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchTasks();
      setFormData((prev) => ({
        ...prev,
        stageId: defaultStageId || prev.stageId || "",
      }));
    }
  }, [isOpen, defaultStageId, projectId]);

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

  const fetchTasks = async () => {
    try {
      setIsFetchingTasks(true);
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsFetchingTasks(false);
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

    setIsLoading(true);
    try {
      const finalAssignees = formData.assignees.length > 0 
        ? formData.assignees 
        : formData.assignedTo 
        ? [formData.assignedTo] 
        : [];

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          priority: formData.priority,
          dueDate: formData.dueDate || null,
          assignmentType: formData.assignmentType,
          assignees: finalAssignees,
          assignedTo: finalAssignees[0] || null,
          projectId: projectId,
          stageId: formData.stageId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to create task");
      }

      const taskData = await response.json();
      const newTaskId = taskData.task?.id;

      // Create dependencies if any
      if (newTaskId && formData.dependencies && formData.dependencies.length > 0) {
        const dependencyPromises = formData.dependencies.map((depTaskId) =>
          fetch(`/api/tasks/${newTaskId}/dependencies`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ dependentTaskId: depTaskId }),
          })
        );

        await Promise.all(dependencyPromises);
      }

      success("Task created successfully");
      handleClose();
      if (onTaskCreated) {
        await onTaskCreated();
      }
    } catch (error) {
      console.error("Error creating task:", error);
      showError(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: "",
        assignedTo: "",
        assignees: [],
        assignmentType: "INDIVIDUAL",
        stageId: defaultStageId || "",
        dependencies: [],
      });
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

  const toggleDependency = (taskId: string) => {
    setFormData((prev) => ({
      ...prev,
      dependencies: (prev.dependencies || []).includes(taskId)
        ? (prev.dependencies || []).filter((id) => id !== taskId)
        : [...(prev.dependencies || []), taskId],
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to this project. You can assign it to a stage and team member.
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

          <div className="grid grid-cols-2 gap-4">
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

          {/* Dependencies */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dependencies (This task depends on)
            </label>
            {isFetchingTasks ? (
              <div className="text-sm text-gray-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-sm text-gray-500">No existing tasks to depend on</div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
                {tasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.dependencies?.includes(task.id) || false}
                      onChange={() => toggleDependency(task.id)}
                      className="rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-gray-700">{task.title}</span>
                      {task.dueDate && (
                        <span className="text-xs text-gray-500 ml-2">
                          (Due: {new Date(task.dueDate).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
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
            {isLoading ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

