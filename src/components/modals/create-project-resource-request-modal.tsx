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
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";

interface ProjectTask {
  id: string;
  title: string;
}

interface ProjectIncident {
  id: string;
  title: string;
}

interface ProjectStage {
  id: string;
  name: string;
  color: string;
  stageType?: string;
}

interface CreateProjectResourceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated?: () => Promise<void> | void;
  projectId: string;
  stages: ProjectStage[];
  existingTasks?: ProjectTask[];
  existingIncidents?: ProjectIncident[];
  defaultStageId?: string | null;
}

export function CreateProjectResourceRequestModal({
  isOpen,
  onClose,
  onRequestCreated,
  projectId,
  stages,
  existingTasks = [],
  existingIncidents = [],
  defaultStageId,
}: CreateProjectResourceRequestModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [incidents, setIncidents] = useState<ProjectIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);
  const [isFetchingIncidents, setIsFetchingIncidents] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    details: "",
    sku: "",
    quantity: "1",
    unit: "unit",
    neededBy: "",
    assignedTeam: "WAREHOUSE",
    priority: "NORMAL",
    estimatedCost: "",
    currency: "USD",
    taskId: "",
    incidentId: "",
    stageId: defaultStageId || "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
      fetchIncidents();
      setFormData((prev) => ({
        ...prev,
        stageId: defaultStageId || prev.stageId || "",
      }));
    }
  }, [isOpen, defaultStageId, projectId]);

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

  const fetchIncidents = async () => {
    try {
      setIsFetchingIncidents(true);
      const response = await fetch(`/api/projects/${projectId}/incidents`);
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || existingIncidents || []);
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
      setIncidents(existingIncidents);
    } finally {
      setIsFetchingIncidents(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: "",
      details: "",
      sku: "",
      quantity: "1",
      unit: "unit",
      neededBy: "",
      assignedTeam: "WAREHOUSE",
      priority: "NORMAL",
      estimatedCost: "",
      currency: "USD",
      taskId: "",
      incidentId: "",
      stageId: defaultStageId || "",
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
      const response = await fetch(`/api/projects/${projectId}/resource-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          details: formData.details || null,
          sku: formData.sku || null,
          quantity: parseFloat(formData.quantity) || 1,
          unit: formData.unit,
          neededBy: formData.neededBy || null,
          assignedTeam: formData.assignedTeam,
          priority: formData.priority,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : null,
          currency: formData.currency || null,
          taskId: formData.taskId || null,
          incidentId: formData.incidentId || null,
          stageId: formData.stageId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to create resource request");
      }

      success("Resource request created successfully");
      if (onRequestCreated) {
        await onRequestCreated();
      }
      handleClose();
    } catch (error: any) {
      console.error("Error creating resource request:", error);
      showError("Error", error.message || "Failed to create resource request");
    } finally {
      setIsLoading(false);
    }
  };

  const resourceStages = stages.filter((s: any) => s.stageType === "RESOURCE");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Resource Request</DialogTitle>
          <DialogDescription>
            Request resources needed for this project
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
              placeholder="Enter resource request title"
              required
            />
          </div>

          <div>
            <Label htmlFor="details">Details</Label>
            <Textarea
              id="details"
              value={formData.details}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  details: e.target.value,
                }))
              }
              placeholder="Describe the resource needed..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU/Product Code</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sku: e.target.value }))
                }
                placeholder="Optional SKU"
              />
            </div>

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, quantity: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, unit: e.target.value }))
                }
                placeholder="e.g., unit, kg, m"
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, priority: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignedTeam">Assigned Team</Label>
              <select
                id="assignedTeam"
                value={formData.assignedTeam}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, assignedTeam: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="PURCHASING">Purchasing</option>
                <option value="FACILITIES">Facilities</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="FINANCE">Finance</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="neededBy">Needed By</Label>
              <Input
                id="neededBy"
                type="datetime-local"
                value={formData.neededBy}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, neededBy: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="estimatedCost">Estimated Cost</Label>
              <Input
                id="estimatedCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedCost: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currency: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="GHS">GHS</option>
              </select>
            </div>
          </div>

          {resourceStages.length > 0 && (
            <div>
              <Label htmlFor="stageId">Stage</Label>
              <select
                id="stageId"
                value={formData.stageId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, stageId: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <option value="">No stage</option>
                {resourceStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <Label htmlFor="taskId">Related Task</Label>
              <select
                id="taskId"
                value={formData.taskId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, taskId: e.target.value }))
                }
                disabled={isFetchingTasks}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No related task</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {incidents.length > 0 && (
            <div>
              <Label htmlFor="incidentId">Related Incident</Label>
              <select
                id="incidentId"
                value={formData.incidentId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, incidentId: e.target.value }))
                }
                disabled={isFetchingIncidents}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No related incident</option>
                {incidents.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.title}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isLoading ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

