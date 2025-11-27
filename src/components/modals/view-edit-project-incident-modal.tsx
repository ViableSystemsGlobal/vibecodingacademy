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
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import {
  Calendar,
  User,
  AlertTriangle,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  Link as LinkIcon,
} from "lucide-react";

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

interface ProjectIncident {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  source: string;
  assignedTo: string | null;
  stageId: string | null;
  relatedTaskId: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  createdAt: string;
  reporter?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  stage?: {
    id: string;
    name: string;
    color: string;
  } | null;
  relatedTask?: {
    id: string;
    title: string;
    status: string;
  } | null;
}

interface ViewEditProjectIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentUpdated?: () => Promise<void> | void;
  incident: ProjectIncident | null;
  projectId: string;
  stages: ProjectStage[];
  existingTasks?: ProjectTask[];
}

export function ViewEditProjectIncidentModal({
  isOpen,
  onClose,
  onIncidentUpdated,
  incident,
  projectId,
  stages,
  existingTasks = [],
}: ViewEditProjectIncidentModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [isEditMode, setIsEditMode] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fullIncident, setFullIncident] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "NEW",
    severity: "MEDIUM",
    source: "INTERNAL",
    assignedTo: "",
    stageId: "",
    relatedTaskId: "",
    dueDate: "",
    resolutionSummary: "",
  });

  useEffect(() => {
    if (isOpen && incident?.id) {
      fetchFullIncident();
      fetchUsers();
      fetchTasks();
    }
  }, [isOpen, incident?.id, projectId]);

  useEffect(() => {
    if (fullIncident || incident) {
      const data = fullIncident || incident;
      setFormData({
        title: data.title || "",
        description: data.description || "",
        status: data.status || "NEW",
        severity: data.severity || "MEDIUM",
        source: data.source || "INTERNAL",
        assignedTo: data.assignedTo || "",
        stageId: data.stageId || "",
        relatedTaskId: data.relatedTaskId || "",
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString().slice(0, 16)
          : "",
        resolutionSummary: data.resolutionSummary || "",
      });
    }
  }, [fullIncident, incident]);

  const fetchFullIncident = async () => {
    if (!incident?.id) return;
    try {
      setIsFetching(true);
      const response = await fetch(
        `/api/projects/${projectId}/incidents/${incident.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setFullIncident(data.incident || data);
      }
    } catch (error) {
      console.error("Error fetching incident:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || existingTasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks(existingTasks);
    }
  };

  const handleClose = () => {
    setIsEditMode(false);
    setFullIncident(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showError("Error", "Title is required");
      return;
    }

    if (!incident?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/incidents/${incident.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description || null,
            status: formData.status,
            severity: formData.severity,
            source: formData.source,
            assignedTo: formData.assignedTo || null,
            stageId: formData.stageId || null,
            relatedTaskId: formData.relatedTaskId || null,
            dueDate: formData.dueDate || null,
            resolvedAt:
              formData.status === "RESOLVED" || formData.status === "CLOSED"
                ? new Date().toISOString()
                : null,
            resolutionSummary: formData.resolutionSummary || null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update incident");
      }

      success("Incident updated successfully");
      if (onIncidentUpdated) {
        await onIncidentUpdated();
      }
      setIsEditMode(false);
      fetchFullIncident();
    } catch (error: any) {
      console.error("Error updating incident:", error);
      showError("Error", error.message || "Failed to update incident");
    } finally {
      setIsLoading(false);
    }
  };

  if (!incident) return null;

  const incidentData = fullIncident || incident;
  const incidentStages = stages.filter((s) => s.stageType === "INCIDENT");

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-200";
      case "HIGH":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "LOW":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CLOSED":
        return "bg-green-100 text-green-800 border-green-200";
      case "RESOLVED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "NEW":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditMode ? (
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="text-xl font-semibold mb-2"
                />
              ) : (
                <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
                  {incidentData.title}
                </DialogTitle>
              )}
              <div className="flex items-center gap-3 flex-wrap text-sm text-gray-500">
                <Badge variant="outline" className={getStatusColor(incidentData.status)}>
                  {incidentData.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={getSeverityColor(incidentData.severity)}>
                  {incidentData.severity}
                </Badge>
                {incidentData.stage && (
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: `${incidentData.stage.color}20`,
                      borderColor: incidentData.stage.color,
                      color: incidentData.stage.color,
                    }}
                  >
                    {incidentData.stage.name}
                  </Badge>
                )}
              </div>
            </div>
            {!isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {isEditMode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  id="severity"
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="source">Source</Label>
                <Select
                  id="source"
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

              <div>
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Select
                  id="assignedTo"
                  value={formData.assignedTo}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, assignedTo: value }))
                  }
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </Select>
              </div>
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

            {(formData.status === "RESOLVED" || formData.status === "CLOSED") && (
              <div>
                <Label htmlFor="resolutionSummary">Resolution Summary</Label>
                <Textarea
                  id="resolutionSummary"
                  value={formData.resolutionSummary}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      resolutionSummary: e.target.value,
                    }))
                  }
                  placeholder="Describe how the incident was resolved..."
                  rows={3}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditMode(false)}
              >
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
                {isLoading ? "Updating..." : "Update Incident"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-6 mt-4">
            {incidentData.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Description
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {incidentData.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Reported By
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>
                    {incidentData.reporter?.name ||
                      incidentData.reporter?.email ||
                      "Unknown"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Assigned To
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>
                    {incidentData.assignee?.name ||
                      incidentData.assignee?.email ||
                      "Unassigned"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  {incidentData.dueDate ? (
                    <span>
                      {new Date(incidentData.dueDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-gray-400">No due date</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Created At
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(incidentData.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {incidentData.relatedTask && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Related Task
                </h3>
                <div className="border border-gray-200 rounded-lg p-3">
                  <p className="font-medium text-gray-900">
                    {incidentData.relatedTask.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {incidentData.relatedTask.status}
                  </p>
                </div>
              </div>
            )}

            {incidentData.resolutionSummary && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Resolution Summary
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {incidentData.resolutionSummary}
                </p>
              </div>
            )}
          </div>
        )}

        {!isEditMode && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

