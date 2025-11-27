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
import { Plus, Trash2 } from "lucide-react";

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
  
  interface ResourceRequestItem {
    productName: string;
    quantity: string;
    unit: string;
  }
  
  const [items, setItems] = useState<ResourceRequestItem[]>([
    { productName: "", quantity: "1", unit: "unit" }
  ]);
  
  const [formData, setFormData] = useState({
    title: "",
    details: "",
    neededBy: "",
    priority: "NORMAL",
    taskId: "",
    incidentId: "",
    stageId: defaultStageId || "",
    emailTo: "",
    emailCc: "",
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
      neededBy: "",
      priority: "NORMAL",
      taskId: "",
      incidentId: "",
      stageId: defaultStageId || "",
      emailTo: "",
      emailCc: "",
    });
    setItems([{ productName: "", quantity: "1", unit: "unit" }]);
    onClose();
  };

  const addItem = () => {
    setItems([...items, { productName: "", quantity: "1", unit: "unit" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ResourceRequestItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showError("Error", "Title is required");
      return;
    }

    // Validate items
    const validItems = items.filter(item => item.productName.trim() && parseFloat(item.quantity) > 0);
    if (validItems.length === 0) {
      showError("Error", "Please add at least one product with a name and quantity");
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
          neededBy: formData.neededBy || null,
          priority: formData.priority,
          taskId: formData.taskId || null,
          incidentId: formData.incidentId || null,
          stageId: formData.stageId || null,
          emailTo: formData.emailTo.trim() || null,
          emailCc: formData.emailCc.trim() || null,
          items: validItems.map(item => ({
            productName: item.productName.trim(),
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit || "unit",
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("API Error Response:", errorData);
        const errorMessage = errorData?.error || errorData?.details || "Failed to create resource request";
        const fullMessage = errorData?.details 
          ? `${errorMessage}: ${errorData.details}` 
          : errorMessage;
        throw new Error(fullMessage);
      }

      success("Resource request created successfully");
      if (onRequestCreated) {
        await onRequestCreated();
      }
      handleClose();
    } catch (error: any) {
      console.error("Error creating resource request:", error);
      const errorMessage = error.message || "Failed to create resource request";
      console.error("Full error:", errorMessage);
      showError("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resourceStages = stages.filter((s: any) => s.stageType === "RESOURCE");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

          {/* Products/Items Section */}
            <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Products/Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label htmlFor={`product-${index}`} className="text-xs">Product Name</Label>
                    <Input
                      id={`product-${index}`}
                      value={item.productName}
                      onChange={(e) => updateItem(index, "productName", e.target.value)}
                      placeholder="e.g., Tiles, Cement, etc."
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor={`quantity-${index}`} className="text-xs">Quantity</Label>
              <Input
                      id={`quantity-${index}`}
                type="number"
                min="0.01"
                step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                required
              />
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor={`unit-${index}`} className="text-xs">Unit</Label>
                    <Input
                      id={`unit-${index}`}
                      value={item.unit}
                      onChange={(e) => updateItem(index, "unit", e.target.value)}
                      placeholder="unit"
                    />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emailTo">Email To</Label>
              <Input
                id="emailTo"
                type="text"
                value={formData.emailTo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, emailTo: e.target.value }))
                }
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated email addresses</p>
            </div>

            <div>
              <Label htmlFor="emailCc">Email CC</Label>
              <Input
                id="emailCc"
                type="text"
                value={formData.emailCc}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, emailCc: e.target.value }))
                }
                placeholder="cc1@example.com, cc2@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated email addresses</p>
            </div>
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
              {isLoading ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

