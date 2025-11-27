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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { TaskComments } from "@/components/task-comments";
import { TaskAttachments } from "@/components/task-attachments";
import TaskDependencies from "@/components/task-dependencies";
import {
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Play,
  Link,
  Edit,
} from "lucide-react";

interface ViewProjectTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
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
    stage?: {
      id: string;
      name: string;
      color: string;
    } | null;
  } | null;
}

export function ViewProjectTaskModal({
  isOpen,
  onClose,
  onEdit,
  task,
}: ViewProjectTaskModalProps) {
  const { getThemeColor } = useTheme();
  const [fullTask, setFullTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && task?.id) {
      fetchFullTask();
    }
  }, [isOpen, task?.id]);

  const fetchFullTask = async () => {
    if (!task?.id) return;
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tasks/${task.id}`);
      if (response.ok) {
        const data = await response.json();
        setFullTask(data.task || data);
      }
    } catch (error) {
      console.error("Error fetching task:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDependencyChange = () => {
    // Refresh task data when dependencies change
    fetchFullTask();
  };

  if (!task) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "IN_PROGRESS":
        return <Play className="w-4 h-4 text-blue-500" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-gray-500" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "OVERDUE":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "URGENT":
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
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-200";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "PENDING":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      case "OVERDUE":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const taskData = fullTask || task;

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
                {task.title}
              </DialogTitle>
              <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {getStatusIcon(task.status)}
                  <Badge variant="outline" className={getStatusColor(task.status)}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
                {task.priority && (
                  <Badge variant="outline" className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                )}
                {task.stage && (
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: `${task.stage.color}20`,
                      borderColor: task.stage.color,
                      color: task.stage.color,
                    }}
                  >
                    {task.stage.name}
                  </Badge>
                )}
              </div>
            </div>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Task Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Due Date</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                {task.dueDate ? (
                  <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                ) : (
                  <span className="text-gray-400">No due date</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned To</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                {task.assignees && task.assignees.length > 0 ? (
                  <span>
                    {task.assignees[0].user.name || task.assignees[0].user.email}
                    {task.assignees.length > 1 && ` +${task.assignees.length - 1} more`}
                  </span>
                ) : task.assignee ? (
                  <span>{task.assignee.name || task.assignee.email}</span>
                ) : (
                  <span className="text-gray-400">Unassigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {taskData?.dependencies && taskData.dependencies.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Link className="w-4 h-4" />
                Dependencies
              </h3>
              <div className="border border-gray-200 rounded-lg p-4">
                <TaskDependencies
                  taskId={task.id}
                  currentTaskTitle={task.title}
                  onDependenciesChange={handleDependencyChange}
                />
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Attachments</h3>
            <div className="border border-gray-200 rounded-lg p-4">
              <TaskAttachments taskId={task.id} />
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Comments</h3>
            <div className="border border-gray-200 rounded-lg p-4">
              <TaskComments taskId={task.id} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          {onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Task
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

