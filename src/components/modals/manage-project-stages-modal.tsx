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
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Trash2, Plus, GripVertical } from "lucide-react";

interface ProjectStage {
  id: string;
  name: string;
  color: string;
  order: number;
  stageType: string;
  _count: {
    tasks: number;
    incidents: number;
  };
}

interface ManageProjectStagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStagesUpdated?: () => Promise<void> | void;
  projectId: string;
  existingStages: ProjectStage[];
  stageType?: "TASK" | "INCIDENT" | "RESOURCE";
}

const DEFAULT_TASK_STAGES = [
  { name: "To Do", color: "#6366F1", order: 0 },
  { name: "In Progress", color: "#F59E0B", order: 1 },
  { name: "Review", color: "#8B5CF6", order: 2 },
  { name: "Done", color: "#10B981", order: 3 },
];

const DEFAULT_INCIDENT_STAGES = [
  { name: "Reported", color: "#6366F1", order: 0 },
  { name: "Investigating", color: "#F59E0B", order: 1 },
  { name: "Resolving", color: "#8B5CF6", order: 2 },
  { name: "Resolved", color: "#10B981", order: 3 },
  { name: "Closed", color: "#6B7280", order: 4 },
];

const DEFAULT_RESOURCE_STAGES = [
  { name: "Requested", color: "#6366F1", order: 0 },
  { name: "Approved", color: "#10B981", order: 1 },
  { name: "Procuring", color: "#F59E0B", order: 2 },
  { name: "Fulfilled", color: "#10B981", order: 3 },
  { name: "Closed", color: "#6B7280", order: 4 },
];

const COLOR_OPTIONS = [
  { value: "#6366F1", label: "Indigo" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
];

export function ManageProjectStagesModal({
  isOpen,
  onClose,
  onStagesUpdated,
  projectId,
  existingStages,
  stageType = "TASK",
}: ManageProjectStagesModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366F1");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Filter stages by the selected stageType and sort by order
      const filteredStages = existingStages
        .filter((s) => s.stageType === stageType)
        .sort((a, b) => a.order - b.order);
      setStages([...filteredStages]);
    }
  }, [isOpen, existingStages, stageType]);

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      showError("Stage name is required");
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/stages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStageName.trim(),
          color: newStageColor,
          stageType: stageType,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to add stage";
        try {
        const errorData = await response.json().catch(() => null);
          if (errorData?.error && typeof errorData.error === "string" && errorData.error.trim().length > 0) {
            errorMessage = errorData.error.trim();
          } else if (errorData?.details && typeof errorData.details === "string" && errorData.details.trim().length > 0) {
            errorMessage = errorData.details.trim();
          } else {
            errorMessage = `HTTP ${response.status}: Failed to add stage`;
          }
        } catch (e) {
          errorMessage = `HTTP ${response.status}: Failed to add stage`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setStages([...stages, data.stage]);
      setNewStageName("");
      setNewStageColor("#6366F1");
      success("Stage added successfully");
      
      if (onStagesUpdated) {
        await onStagesUpdated();
      }
    } catch (error) {
      console.error("Error adding stage:", error);
      showError(error instanceof Error ? error.message : "Failed to add stage");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Are you sure you want to delete this stage? Tasks in this stage will be unassigned.")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/stages/${stageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete stage";
        try {
        const errorData = await response.json().catch(() => null);
          if (errorData?.error && typeof errorData.error === "string" && errorData.error.trim().length > 0) {
            errorMessage = errorData.error.trim();
          } else if (errorData?.details && typeof errorData.details === "string" && errorData.details.trim().length > 0) {
            errorMessage = errorData.details.trim();
          } else {
            errorMessage = `HTTP ${response.status}: Failed to delete stage`;
          }
        } catch (e) {
          errorMessage = `HTTP ${response.status}: Failed to delete stage`;
        }
        throw new Error(errorMessage);
      }

      setStages(stages.filter((s) => s.id !== stageId));
      success("Stage deleted successfully");
      
      if (onStagesUpdated) {
        await onStagesUpdated();
      }
    } catch (error) {
      console.error("Error deleting stage:", error);
      showError(error instanceof Error ? error.message : "Failed to delete stage");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDefaultStages = async () => {
    let defaultStages;
    if (stageType === "INCIDENT") {
      defaultStages = DEFAULT_INCIDENT_STAGES;
    } else if (stageType === "RESOURCE") {
      defaultStages = DEFAULT_RESOURCE_STAGES;
    } else {
      defaultStages = DEFAULT_TASK_STAGES;
    }

    const stageNames = defaultStages.map((s) => s.name).join(", ");
    if (!confirm(`This will create default ${stageType.toLowerCase()} stages (${stageNames}). Continue?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const results = await Promise.allSettled(
        defaultStages.map(async (stage) => {
          const response = await fetch(`/api/projects/${projectId}/stages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: stage.name,
              color: stage.color,
              stageType: stageType,
              order: stage.order,
            }),
          });

          if (!response.ok) {
            let errorMessage = `Failed to create stage "${stage.name}"`;
            const statusCode = response.status;
            
            try {
              const contentType = response.headers.get("content-type");
              
              if (contentType && contentType.includes("application/json")) {
                let errorData: any = null;
                try {
                  errorData = await response.json();
                } catch (jsonError) {
                  // JSON parsing failed - response body might be empty or invalid
                  errorMessage = `HTTP ${statusCode}: Failed to create stage "${stage.name}"`;
                  console.error(`API Error for stage "${stage.name}": HTTP ${statusCode} - Failed to parse JSON response`);
                  throw new Error(errorMessage);
                }
                
                // Check if errorData has meaningful error content
                const errorText = errorData?.error;
                const detailsText = errorData?.details;
                const hasError = errorText && typeof errorText === "string" && errorText.trim().length > 0;
                const hasDetails = detailsText && typeof detailsText === "string" && detailsText.trim().length > 0;
                
                if (hasError || hasDetails) {
                  errorMessage = (errorText || detailsText || errorMessage).trim();
                  // Build log data with meaningful content only
                  const logData: Record<string, string> = { status: String(statusCode) };
                  if (hasError) logData.error = errorText.trim();
                  if (hasDetails) logData.details = detailsText.trim();
                  
                  // Double check: only log if we actually have error or details content
                  const hasActualContent = (logData.error && logData.error.length > 0) || (logData.details && logData.details.length > 0);
                  if (hasActualContent) {
                    // NEVER EVER log empty objects - construct message string instead
                    const errorParts: string[] = [`HTTP ${statusCode}`];
                    if (logData.error && logData.error.trim().length > 0) {
                      errorParts.push(`Error: ${logData.error.trim()}`);
                    }
                    if (logData.details && logData.details.trim().length > 0) {
                      errorParts.push(`Details: ${logData.details.trim()}`);
                    }
                    
                    if (errorParts.length > 1) {
                      console.error(`[STAGE-CREATE-v3] Stage "${stage.name}" failed:`, errorParts.join(" | "));
                    } else {
                      console.error(`[STAGE-CREATE-v3] Stage "${stage.name}" failed: HTTP ${statusCode} - No error message from API`);
                    }
                  } else {
                    console.error(`[STAGE-CREATE-v3] Stage "${stage.name}" failed: HTTP ${statusCode} - No error message from API`);
                  }
                } else {
                  // Empty or invalid error response - don't log empty objects
                  errorMessage = `HTTP ${statusCode}: Failed to create stage "${stage.name}"`;
                  console.error(`API Error for stage "${stage.name}": HTTP ${statusCode} - No error data received`);
                }
              } else {
                const text = await response.text().catch(() => "");
                errorMessage = `HTTP ${statusCode}: ${text || `Failed to create stage "${stage.name}"`}`;
                if (text && text.trim().length > 0) {
                  console.error(`API Error for stage "${stage.name}": HTTP ${statusCode} -`, text);
                } else {
                  console.error(`API Error for stage "${stage.name}": HTTP ${statusCode} - No response body`);
                }
              }
            } catch (e) {
              // Fallback error handling - avoid logging empty objects
              errorMessage = `HTTP ${statusCode}: Failed to create stage "${stage.name}"`;
              if (e instanceof Error && e.message !== errorMessage) {
                console.error(`API Error for stage "${stage.name}": HTTP ${statusCode} -`, e.message);
              } else {
                console.error(`API Error for stage "${stage.name}": HTTP ${statusCode} - Error processing response`);
              }
            }
            throw new Error(errorMessage);
          }

          return response.json();
        })
      );

      // Count successes and failures
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      const failures = results
        .map((r, idx) => ({
          stage: defaultStages[idx].name,
          status: r.status,
          error: r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null,
        }))
        .filter((f) => f.status === "rejected");

      if (failed > 0) {
        const failureMessages = failures.map((f) => `"${f.stage}": ${f.error}`).join("; ");
        if (successful > 0) {
          showError(
            `Created ${successful} stage(s), but ${failed} failed: ${failureMessages}`
          );
        } else {
          showError(`Failed to create stages: ${failureMessages}`);
        }
      } else {
      success(`Default ${stageType.toLowerCase()} stages created successfully`);
      }
      
      if (onStagesUpdated) {
        await onStagesUpdated();
      }
      
      // Refresh stages list
      const response = await fetch(`/api/projects/${projectId}/stages`);
      if (response.ok) {
        const data = await response.json();
        const filteredStages = data.stages
          ?.filter((s: ProjectStage) => s.stageType === stageType)
          .sort((a: ProjectStage, b: ProjectStage) => a.order - b.order) || [];
        setStages(filteredStages);
      }
    } catch (error) {
      console.error("Error creating default stages:", error);
      showError(error instanceof Error ? error.message : "Failed to create default stages");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage {stageType === "INCIDENT" ? "Incident" : stageType === "RESOURCE" ? "Resource" : "Task Board"} Stages
          </DialogTitle>
          <DialogDescription>
            Create and manage stages for your project {stageType === "INCIDENT" ? "incident" : stageType === "RESOURCE" ? "resource" : "task"} board. {stageType === "INCIDENT" ? "Incidents" : stageType === "RESOURCE" ? "Resources" : "Tasks"} can be moved between stages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Setup */}
          {stages.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-3">
                No stages configured yet. Create custom stages or use the default set.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateDefaultStages}
                disabled={isLoading}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Default {stageType === "INCIDENT" ? "Incident" : stageType === "RESOURCE" ? "Resource" : "Task"} Stages
              </Button>
            </div>
          )}

          {/* Existing Stages */}
          {stages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Current Stages</h3>
              <p className="text-xs text-gray-500 mb-3">Drag stages to reorder them</p>
              <div 
                className="space-y-2"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
              >
                {stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 cursor-move hover:shadow-md transition-shadow select-none"
                    draggable={true}
                    style={{ userSelect: "none", WebkitUserSelect: "none" }}
                    onDragStart={(e) => {
                      setDraggedStageId(stage.id);
                      e.dataTransfer.setData("stage-id", stage.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.dropEffect = "move";
                      e.currentTarget.style.opacity = "0.5";
                    }}
                    onDragEnd={(e) => {
                      setDraggedStageId(null);
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.borderLeft = "none";
                      e.currentTarget.style.borderRight = "none";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      if (draggedStageId && draggedStageId !== stage.id) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const midpoint = rect.left + rect.width / 2;
                        if (e.clientX < midpoint) {
                          e.currentTarget.style.borderLeft = "3px solid #3B82F6";
                          e.currentTarget.style.borderRight = "none";
                        } else {
                          e.currentTarget.style.borderRight = "3px solid #3B82F6";
                          e.currentTarget.style.borderLeft = "none";
                        }
                      }
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.borderLeft = "none";
                      e.currentTarget.style.borderRight = "none";
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.style.borderLeft = "none";
                      e.currentTarget.style.borderRight = "none";
                      
                      const droppedStageId = e.dataTransfer.getData("stage-id");
                      if (droppedStageId && droppedStageId !== stage.id) {
                        const draggedIndex = stages.findIndex((s) => s.id === droppedStageId);
                        const targetIndex = index;
                        
                        if (draggedIndex !== targetIndex) {
                          // Save original order for potential revert
                          const originalStages = [...stages];
                          const newStages = [...stages];
                          const [removed] = newStages.splice(draggedIndex, 1);
                          newStages.splice(targetIndex, 0, removed);
                          
                          const newOrder = newStages.map((s, idx) => ({
                            stageId: s.id,
                            order: idx,
                          }));
                          
                          // Update local state immediately for better UX
                          setStages(newStages);
                          
                          // Call API to persist the new order
                          try {
                            setIsLoading(true);
                            const response = await fetch(`/api/projects/${projectId}/stages/reorder`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({ stageOrders: newOrder }),
                            });

                            if (!response.ok) {
                              // Revert on error
                              setStages(originalStages);
                              let errorMessage = "Failed to reorder stages";
                              try {
                              const errorData = await response.json().catch(() => null);
                                if (errorData?.error && typeof errorData.error === "string" && errorData.error.trim().length > 0) {
                                  errorMessage = errorData.error.trim();
                                } else if (errorData?.details && typeof errorData.details === "string" && errorData.details.trim().length > 0) {
                                  errorMessage = errorData.details.trim();
                                } else {
                                  errorMessage = `HTTP ${response.status}: Failed to reorder stages`;
                                }
                              } catch (e) {
                                errorMessage = `HTTP ${response.status}: Failed to reorder stages`;
                              }
                              throw new Error(errorMessage);
                            }

                            success("Stages reordered successfully");
                            
                            if (onStagesUpdated) {
                              await onStagesUpdated();
                            }
                          } catch (error) {
                            console.error("Error reordering stages:", error);
                            showError(error instanceof Error ? error.message : "Failed to reorder stages");
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }
                    }}
                  >
                    <div className="flex-shrink-0" draggable={false}>
                      <GripVertical 
                        className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" 
                      />
                    </div>
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                      draggable={false}
                    />
                    <div className="flex-1" draggable={false}>
                      <p className="font-medium text-gray-900">{stage.name}</p>
                      <p className="text-xs text-gray-500">
                        {stage._count.tasks} tasks • {stage._count.incidents} incidents
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteStage(stage.id);
                      }}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      draggable={false}
                      onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Stage */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Stage</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder="Stage name (e.g., 'In Progress')"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newStageName.trim()) {
                      handleAddStage();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
                <div
                  className="w-10 h-10 rounded border border-gray-300"
                  style={{ backgroundColor: newStageColor }}
                />
              </div>
            </div>
            <Button
              onClick={handleAddStage}
              disabled={isAdding || !newStageName.trim()}
              size="sm"
              className="mt-2 text-white border-0"
              style={{ backgroundColor: getThemeColor() }}
            >
              {isAdding ? "Adding..." : "Add Stage"}
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading || isAdding}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

