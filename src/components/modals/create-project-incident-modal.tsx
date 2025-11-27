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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
}

interface CreateProjectIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentCreated?: () => Promise<void> | void;
  projectId: string;
  stages: ProjectStage[];
  defaultStageId?: string | null;
  existingTasks?: ProjectTask[];
}

export function CreateProjectIncidentModal({
  isOpen,
  onClose,
  onIncidentCreated,
  projectId,
  stages,
  defaultStageId,
  existingTasks = [],
}: CreateProjectIncidentModalProps) {
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
    severity: "MEDIUM",
    source: "INTERNAL",
    assignedTo: "",
    stageId: defaultStageId || "",
    relatedTaskId: "",
    dueDate: "",
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
        setTasks(data.tasks || existingTasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks(existingTasks);
    } finally {
      setIsFetchingTasks(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: "",
      description: "",
      severity: "MEDIUM",
      source: "INTERNAL",
      assignedTo: "",
      stageId: defaultStageId || "",
      relatedTaskId: "",
      dueDate: "",
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showError("Error", "Title is required");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          severity: formData.severity,
          source: formData.source,
          assignedTo: formData.assignedTo || null,
          stageId: formData.stageId || null,
          relatedTaskId: formData.relatedTaskId || null,
          dueDate: formData.dueDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to create incident");
      }

      success("Incident created successfully");
      if (onIncidentCreated) {
        await onIncidentCreated();
      }
      handleClose();
    } catch (error: any) {
      console.error("Error creating incident:", error);
      showError("Error", error.message || "Failed to create incident");
    } finally {
      setIsLoading(false);
    }
  };

  const incidentStages = stages.filter((s) => s.stageType === "INCIDENT");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Incident</DialogTitle>
          <DialogDescription>
            Report a new incident for this project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter incident title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe the incident..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, severity: value }))
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, source: value }))
                }
              >
                <option value="INTERNAL">Internal</option>
                <option value="CLIENT">Client</option>
                <option value="QA">QA</option>
                <option value="REGULATORY">Regulatory</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="assignedTo">Assigned To</Label>
            <Select
              id="assignedTo"
              value={formData.assignedTo}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, assignedTo: value }))
              }
              disabled={isFetchingUsers}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </Select>
          </div>

          {incidentStages.length > 0 && (
            <div>
              <Label htmlFor="stageId">Stage</Label>
              <Select
                id="stageId"
                value={formData.stageId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, stageId: value }))
                }
              >
                <option value="">No stage</option>
                {incidentStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <Label htmlFor="relatedTaskId">Related Task</Label>
              <Select
                id="relatedTaskId"
                value={formData.relatedTaskId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, relatedTaskId: value }))
                }
                disabled={isFetchingTasks}
              >
                <option value="">No related task</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              style={{
                backgroundColor: getThemeColor(),
                color: "white",
              }}
            >
              {isLoading ? "Creating..." : "Create Incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

