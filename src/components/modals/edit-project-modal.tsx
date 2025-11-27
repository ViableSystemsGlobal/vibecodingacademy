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

interface Project {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  visibility: string;
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  budgetCurrency: string | null;
}

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated?: () => Promise<void> | void;
  project: Project | null;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARCHIVED", label: "Archived" },
];

const VISIBILITY_OPTIONS = [
  { value: "INTERNAL", label: "Internal" },
  { value: "CLIENT", label: "Client" },
  { value: "PARTNER", label: "Partner" },
];

export function EditProjectModal({ isOpen, onClose, onProjectUpdated, project }: EditProjectModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setCode(project.code || "");
      setDescription(project.description || "");
      setStatus(project.status || "ACTIVE");
      setVisibility(project.visibility || "INTERNAL");
      setStartDate(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "");
      setDueDate(project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : "");
      setBudget(project.budget?.toString() || "");
      setBudgetCurrency(project.budgetCurrency || "USD");
    }
  }, [project]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showError("Project name is required");
      return;
    }

    if (!project) {
      showError("Project not found");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
          status,
          visibility,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          budget: budget ? Number(budget) : undefined,
          budgetCurrency: budgetCurrency.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update project");
      }

      success("Project updated successfully");
      onClose();
      if (onProjectUpdated) {
        await onProjectUpdated();
      }
    } catch (error) {
      console.error("Error updating project:", error);
      showError(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) { onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the project details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Name *</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Implementation rollout"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Project Code</label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="PRJ-2025-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Budget (optional)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Budget Currency</label>
              <Input
                value={budgetCurrency}
                onChange={(event) => setBudgetCurrency(event.target.value)}
                placeholder="USD"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Visibility</label>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Summarize the project scope, success criteria, and key milestones."
            />
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="text-white border-0"
            style={{ backgroundColor: getThemeColor() }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {isSubmitting ? "Updating..." : "Update Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

