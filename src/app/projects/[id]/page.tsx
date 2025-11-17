"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ClipboardList,
  CalendarDays,
  AlertTriangle,
  Share2,
  BarChart3,
  Settings,
  Activity,
  Plus,
  User,
  Calendar,
  CheckCircle,
  GripVertical,
  GanttChart,
  Grid3x3,
} from "lucide-react";
import { EditProjectModal } from "@/components/modals/edit-project-modal";
import { AddProjectUpdateModal } from "@/components/modals/add-project-update-modal";
import { AddProjectMemberModal } from "@/components/modals/add-project-member-modal";
import { ManageProjectStagesModal } from "@/components/modals/manage-project-stages-modal";
import { CreateProjectTaskModal } from "@/components/modals/create-project-task-modal";
import { EditProjectTaskModal } from "@/components/modals/edit-project-task-modal";
import { ViewProjectTaskModal } from "@/components/modals/view-project-task-modal";
import { CreateProjectIncidentModal } from "@/components/modals/create-project-incident-modal";
import { ViewEditProjectIncidentModal } from "@/components/modals/view-edit-project-incident-modal";
import { CreateProjectResourceRequestModal } from "@/components/modals/create-project-resource-request-modal";
import { ProjectGanttChart } from "@/components/project-gantt-chart";
import { ProjectCalendarView } from "@/components/project-calendar-view";

type ProjectMember = {
  id: string;
  role: string;
  isExternal: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
};

type ProjectStage = {
  id: string;
  name: string;
  color: string;
  order: number;
  stageType: string;
  _count: {
    tasks: number;
    incidents: number;
  };
};

type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  startDate?: string | null;
  assignedTo: string | null;
  stageId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  assignees?: {
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }[];
  stage?: {
    id: string;
    name: string;
    color: string;
  } | null;
  dependencies?: {
    id: string;
    dependsOnTaskId: string;
    dependsOnTask: {
      id: string;
      title: string;
      dueDate: string | null;
    };
  }[];
};

type ProjectIncident = {
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
};

type ProjectResourceRequest = {
  id: string;
  title: string;
  details: string | null;
  status: string;
  priority: string;
  quantity: number;
  unit: string;
  sku: string | null;
  neededBy: string | null;
  assignedTeam: string;
  estimatedCost: number | null;
  currency: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  fulfilledAt: string | null;
  taskId: string | null;
  incidentId: string | null;
  stageId: string | null;
  createdAt: string;
  requester?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  approver?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  task?: {
    id: string;
    title: string;
    status: string;
  } | null;
  incident?: {
    id: string;
    title: string;
    status: string;
  } | null;
  stage?: {
    id: string;
    name: string;
    color: string;
    order: number;
  } | null;
};

type ProjectDetail = {
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
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  members: ProjectMember[];
  stages: ProjectStage[];
  tasks: ProjectTask[];
  incidents: ProjectIncident[];
  resourceRequests: ProjectResourceRequest[];
  _count: {
    members: number;
    stages: number;
    tasks: number;
    incidents: number;
    resourceRequests: number;
  };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  FULFILLED: "Fulfilled",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

const VISIBILITY_LABELS: Record<string, string> = {
  INTERNAL: "Internal",
  CLIENT: "Client",
  PARTNER: "Partner",
};

const STAGE_TYPE_LABELS: Record<string, string> = {
  TASK: "Task Board",
  INCIDENT: "Incidents",
  RESOURCE: "Resources",
};

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "board", label: "Task Board", icon: ClipboardList },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "resources", label: "Resource Requests", icon: Share2 },
  { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
  { id: "settings", label: "Project Setup", icon: Settings },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddUpdateModalOpen, setIsAddUpdateModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isManageStagesModalOpen, setIsManageStagesModalOpen] = useState(false);
  const [manageStagesType, setManageStagesType] = useState<"TASK" | "INCIDENT" | "RESOURCE">("TASK");
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [isViewTaskModalOpen, setIsViewTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [boardView, setBoardView] = useState<"kanban" | "gantt">("kanban");
  const [isCreateIncidentModalOpen, setIsCreateIncidentModalOpen] = useState(false);
  const [isViewIncidentModalOpen, setIsViewIncidentModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<ProjectIncident | null>(null);
  const [incidents, setIncidents] = useState<ProjectIncident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [isCreateResourceRequestModalOpen, setIsCreateResourceRequestModalOpen] = useState(false);
  const [resourceRequests, setResourceRequests] = useState<ProjectResourceRequest[]>([]);
  const [isLoadingResourceRequests, setIsLoadingResourceRequests] = useState(false);

  const fetchTasks = useCallback(async (projectId: string) => {
    try {
      setIsLoadingTasks(true);
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  const fetchIncidents = useCallback(async (projectId: string) => {
    try {
      setIsLoadingIncidents(true);
      const response = await fetch(`/api/projects/${projectId}/incidents`);
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, []);

  const fetchResourceRequests = useCallback(async (projectId: string) => {
    try {
      setIsLoadingResourceRequests(true);
      const response = await fetch(`/api/projects/${projectId}/resource-requests`);
      if (response.ok) {
        const data = await response.json();
        setResourceRequests(data.resourceRequests || []);
      }
    } catch (error) {
      console.error("Error fetching resource requests:", error);
    } finally {
      setIsLoadingResourceRequests(false);
    }
  }, []);

  const fetchProject = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${id}`);
      if (response.status === 404) {
        router.replace("/projects");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch project");
      }
      const data = await response.json();
      setProject(data.project);
      // Fetch tasks, incidents, and resource requests when project is loaded
      fetchTasks(id);
      fetchIncidents(id);
      fetchResourceRequests(id);
    } catch (error) {
      console.error("❌ Error fetching project:", error);
      showError("Error", "Unable to load project details");
    } finally {
      setIsLoading(false);
    }
  }, [router, showError, fetchTasks, fetchIncidents, fetchResourceRequests]);

  useEffect(() => {
    const projectId = params?.id;
    if (!projectId || typeof projectId !== "string") {
      return;
    }
    fetchProject(projectId);
  }, [params?.id, fetchProject]);

  const ownerName = useMemo(
    () => project?.owner?.name || project?.owner?.email || "Unassigned",
    [project]
  );

  const activeStages = useMemo(() => {
    if (!project) return [];
    return project.stages
      .filter((s) => s.stageType === "TASK")
      .sort((a, b) => a.order - b.order);
  }, [project]);

  const incidentStages = useMemo(() => {
    if (!project) return [];
    return project.stages
      .filter((s) => s.stageType === "INCIDENT")
      .sort((a, b) => a.order - b.order);
  }, [project]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<string, ProjectTask[]> = {};
    activeStages.forEach((stage) => {
      grouped[stage.id] = [];
    });
    tasks.forEach((task) => {
      const stageId = task.stageId || "unassigned";
      if (!grouped[stageId]) {
        grouped[stageId] = [];
      }
      grouped[stageId].push(task);
    });
    return grouped;
  }, [tasks, activeStages]);

  const incidentsByStage = useMemo(() => {
    const grouped: Record<string, ProjectIncident[]> = {};
    incidentStages.forEach((stage) => {
      grouped[stage.id] = [];
    });
    incidents.forEach((incident) => {
      const stageId = incident.stageId || "unassigned";
      if (!grouped[stageId]) {
        grouped[stageId] = [];
      }
      grouped[stageId].push(incident);
    });
    return grouped;
  }, [incidents, incidentStages]);

  const handleIncidentMove = async (incidentId: string, newStageId: string | null) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/incidents/${incidentId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stageId: newStageId }),
      });

      if (response.ok) {
        const data = await response.json();
        setIncidents((prev) =>
          prev.map((i) => (i.id === incidentId ? data.incident : i))
        );
      } else {
        const errorData = await response.json().catch(() => null);
        showError(errorData?.error || "Failed to move incident");
      }
    } catch (error) {
      console.error("Error moving incident:", error);
      showError("Error", "Failed to move incident");
    }
  };

  const resourceStages = useMemo(() => {
    if (!project) return [];
    return project.stages
      .filter((s) => s.stageType === "RESOURCE")
      .sort((a, b) => a.order - b.order);
  }, [project]);

  const resourceRequestsByStage = useMemo(() => {
    const grouped: Record<string, ProjectResourceRequest[]> = {};
    resourceStages.forEach((stage) => {
      grouped[stage.id] = [];
    });
    resourceRequests.forEach((request) => {
      const stageId = request.stageId || "unassigned";
      if (!grouped[stageId]) {
        grouped[stageId] = [];
      }
      grouped[stageId].push(request);
    });
    return grouped;
  }, [resourceRequests, resourceStages]);

  const handleResourceRequestMove = async (requestId: string, newStageId: string | null) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/resource-requests/${requestId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stageId: newStageId }),
      });

      if (response.ok) {
        const data = await response.json();
        setResourceRequests((prev) =>
          prev.map((r) => (r.id === requestId ? data.resourceRequest : r))
        );
      } else {
        const errorData = await response.json().catch(() => null);
        showError(errorData?.error || "Failed to move resource request");
      }
    } catch (error) {
      console.error("Error moving resource request:", error);
      showError("Error", "Failed to move resource request");
    }
  };

  const handleTaskMove = async (taskId: string, newStageId: string | null) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/tasks/${taskId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stageId: newStageId }),
      });

      if (response.ok) {
        const data = await response.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? data.task : t))
        );
      } else {
        const errorData = await response.json().catch(() => null);
        showError(errorData?.error || "Failed to move task");
      }
    } catch (error) {
      console.error("Error moving task:", error);
      showError("Failed to move task");
    }
  };

  const handleStageReorder = async (newOrder: { stageId: string; order: number }[]) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/stages/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stageOrders: newOrder }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update project stages
        if (project) {
          setProject({
            ...project,
            stages: data.stages,
          });
        }
      } else {
        const errorData = await response.json().catch(() => null);
        showError(errorData?.error || "Failed to reorder stages");
      }
    } catch (error) {
      console.error("Error reordering stages:", error);
      showError("Failed to reorder stages");
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

  const upcomingTasks = useMemo(() => {
    if (!project?.tasks) return [];
    return project.tasks
      .filter((task) => task.dueDate)
      .sort((a, b) => new Date(a.dueDate || "").getTime() - new Date(b.dueDate || "").getTime())
      .slice(0, 5);
  }, [project?.tasks]);

  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-10 text-center text-gray-500">
          Loading project details...
        </CardContent>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-10 text-center text-gray-500">
          Project not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => router.push("/projects")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
              {STATUS_LABELS[project.status] ?? project.status}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold text-gray-600">
              {VISIBILITY_LABELS[project.visibility] ?? project.visibility}
            </Badge>
            {project.code ? (
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold text-gray-600">
                {project.code}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.description ? (
            <p className="max-w-4xl text-sm text-gray-600">{project.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {project.startDate ? <span>Start: {formatDate(project.startDate)}</span> : null}
            {project.dueDate ? <span>Due: {formatDate(project.dueDate)}</span> : null}
            {project.budget ? (
              <span>
                Budget: {formatCurrency(project.budget, project.budgetCurrency || "USD")}
              </span>
            ) : null}
            <span>Owner: {ownerName}</span>
            {project.creator ? <span>Created by: {project.creator.name || project.creator.email}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
            Edit Project
          </Button>
          <Button 
            size="sm"
            className="text-white border-0"
            style={{ backgroundColor: getThemeColor() }}
            onClick={() => setIsAddUpdateModalOpen(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Add Update
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="space-y-4">
        {activeTab === "overview" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-gray-500">Total Tasks</p>
                  <p className="mt-2 text-2xl font-bold">{project._count.tasks}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-gray-500">Incidents</p>
                  <p className="mt-2 text-2xl font-bold">{project._count.incidents}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-gray-500">Resource Requests</p>
                  <p className="mt-2 text-2xl font-bold">{project._count.resourceRequests}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-gray-500">Team Members</p>
                  <p className="mt-2 text-2xl font-bold">{project._count.members}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase text-gray-500">
                    Project Team
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddMemberModalOpen(true)}
                    className="text-xs"
                  >
                    + Add Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 px-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <p className="font-medium text-gray-900">
                      {member.user?.name || member.user?.email || "Member"}
                    </p>
                    <p className="text-xs text-gray-500">{member.user?.email}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                        {member.role}
                      </Badge>
                      {member.isExternal ? (
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                          External
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
                {project.members.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                    No team members assigned yet.
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddMemberModalOpen(true)}
                      className="mt-2 w-full"
                    >
                      + Add First Member
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        {activeTab === "board" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Task Board</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
                  <Button
                    variant={boardView === "kanban" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setBoardView("kanban")}
                    className={boardView === "kanban" ? "text-white" : ""}
                    style={
                      boardView === "kanban"
                        ? { backgroundColor: getThemeColor() }
                        : {}
                    }
                  >
                    <Grid3x3 className="w-4 h-4 mr-1" />
                    Kanban
                  </Button>
                  <Button
                    variant={boardView === "gantt" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setBoardView("gantt")}
                    className={boardView === "gantt" ? "text-white" : ""}
                    style={
                      boardView === "gantt"
                        ? { backgroundColor: getThemeColor() }
                        : {}
                    }
                  >
                    <GanttChart className="w-4 h-4 mr-1" />
                    Gantt
                  </Button>
                </div>
                <Button
                  onClick={() => setIsCreateTaskModalOpen(true)}
                  className="text-white border-0"
                  style={{ backgroundColor: getThemeColor() }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </div>
            </div>
            {boardView === "gantt" ? (
              <ProjectGanttChart
                tasks={tasks}
                startDate={project?.startDate ? new Date(project.startDate) : undefined}
                endDate={project?.dueDate ? new Date(project.dueDate) : undefined}
              />
            ) : (
              activeStages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">
                    No stages configured yet. Set up your task board stages in Project Setup.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("settings")}
                  >
                    Go to Project Setup
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {activeStages.map((stage, index) => {
                  const stageTasks = tasksByStage[stage.id] || [];
                  return (
                    <div
                      key={stage.id}
                      className="flex-shrink-0 w-80"
                      draggable
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const taskId = e.dataTransfer.getData("task-id");
                        if (taskId) {
                          handleTaskMove(taskId, stage.id);
                        }
                      }}
                      data-stage-id={stage.id}
                    >
                      <Card className="h-full">
                        <CardHeader
                          className="px-4 py-3 cursor-move"
                          style={{ borderTop: `3px solid ${stage.color}` }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("stage-id", stage.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.currentTarget.style.opacity = "0.5";
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = "1";
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            const draggedStageId = e.dataTransfer.getData("stage-id");
                            if (draggedStageId && draggedStageId !== stage.id) {
                              e.dataTransfer.dropEffect = "move";
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
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderLeft = "none";
                            e.currentTarget.style.borderRight = "none";
                            
                            const draggedStageId = e.dataTransfer.getData("stage-id");
                            if (draggedStageId && draggedStageId !== stage.id) {
                              const draggedIndex = activeStages.findIndex((s) => s.id === draggedStageId);
                              const targetIndex = index;
                              
                              if (draggedIndex !== targetIndex) {
                                const newStages = [...activeStages];
                                const [removed] = newStages.splice(draggedIndex, 1);
                                newStages.splice(targetIndex, 0, removed);
                                
                                const newOrder = newStages.map((s, idx) => ({
                                  stageId: s.id,
                                  order: idx,
                                }));
                                
                                handleStageReorder(newOrder);
                              }
                            }
                          }}
                        >
                          <CardTitle className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="font-semibold">{stage.name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {stageTasks.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 py-3 space-y-2 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
                          {stageTasks.map((task) => (
                            <Card
                              key={task.id}
                              className="p-3 cursor-move hover:shadow-md transition-shadow bg-white group"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("task-id", task.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.stopPropagation(); // Prevent stage drag from triggering
                              }}
                              onClick={(e) => {
                                // Only open view modal if not dragging
                                if (e.detail === 1) {
                                  setTimeout(() => {
                                    setSelectedTask(task);
                                    setIsViewTaskModalOpen(true);
                                  }, 200);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-sm text-gray-900 line-clamp-2 flex-1">
                                  {task.title}
                                </h4>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {task.priority && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getPriorityColor(task.priority)}`}
                                    >
                                      {task.priority}
                                    </Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      setIsEditTaskModalOpen(true);
                                    }}
                                    title="Edit task"
                                  >
                                    <Settings className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              {task.description && (
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                                <div className="flex items-center gap-1">
                                  {task.assignees && task.assignees.length > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>
                                        {task.assignees.length > 1
                                          ? `${task.assignees[0].user.name || task.assignees[0].user.email} +${task.assignees.length - 1}`
                                          : task.assignees[0].user.name || task.assignees[0].user.email}
                                      </span>
                                    </div>
                                  ) : task.assignee ? (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>{task.assignee.name || task.assignee.email}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">Unassigned</span>
                                  )}
                                </div>
                                {task.dueDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))}
                          {stageTasks.length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              Drop tasks here
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
              )
            )}
          </div>
        ) : null}

        {activeTab === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar View - Takes 2 columns */}
            <div className="lg:col-span-2">
              <ProjectCalendarView
                tasks={tasks}
                onTaskClick={(task) => {
                  setSelectedTask(task);
                  setIsViewTaskModalOpen(true);
                }}
              />
            </div>

            {/* Upcoming Tasks List - Takes 1 column */}
            <Card>
              <CardHeader className="px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-gray-700">
                  <CalendarDays className="h-5 w-5 text-indigo-500" />
                  Upcoming Milestones & Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                {upcomingTasks.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming tasks with due dates yet.</p>
                ) : (
                  upcomingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsViewTaskModalOpen(true);
                      }}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          Status: {task.status} • Priority: {task.priority || "Normal"}
                        </p>
                      </div>
                      <div className="text-sm text-gray-600">
                        Due {task.dueDate ? formatDate(task.dueDate) : "—"}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "incidents" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Incidents</h2>
              <Button
                onClick={() => setIsCreateIncidentModalOpen(true)}
                className="text-white border-0"
                style={{ backgroundColor: getThemeColor() }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Incident
              </Button>
            </div>
            {isLoadingIncidents ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : incidentStages.length === 0 ? (
              <div className="space-y-4">
                {incidents.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                      <p className="text-sm text-gray-500 mb-4">
                        No incident stages configured. Please set up stages in Project Setup.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("settings")}
                      >
                        Go to Project Setup
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm text-gray-600">
                            You have {incidents.length} incident{incidents.length !== 1 ? 's' : ''} but no stages configured. 
                            Set up stages to organize them in a Kanban board.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("settings")}
                          >
                            Configure Stages
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="grid gap-3">
                      {incidents.map((incident) => {
                        const getSeverityColor = (severity: string) => {
                          switch (severity) {
                            case "CRITICAL":
                              return "bg-red-100 text-red-800";
                            case "HIGH":
                              return "bg-orange-100 text-orange-800";
                            case "MEDIUM":
                              return "bg-yellow-100 text-yellow-800";
                            case "LOW":
                              return "bg-blue-100 text-blue-800";
                            default:
                              return "bg-gray-100 text-gray-800";
                          }
                        };
                        return (
                          <Card
                            key={incident.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                              setSelectedIncident(incident);
                              setIsViewIncidentModalOpen(true);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium text-gray-900 mb-2">
                                    {incident.title}
                                  </h3>
                                  {incident.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                      {incident.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getSeverityColor(incident.severity)}`}
                                    >
                                      {incident.severity}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {incident.status.replace("_", " ")}
                                    </Badge>
                                    {incident.dueDate && new Date(incident.dueDate) < new Date() && (
                                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                                        Overdue
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-4 text-right text-xs text-gray-500">
                                  {incident.assignee && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <User className="w-3 h-3" />
                                      <span className="truncate max-w-[100px]">
                                        {incident.assignee.name || incident.assignee.email}
                                      </span>
                                    </div>
                                  )}
                                  {incident.dueDate && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      <span>{formatDate(incident.dueDate)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {incidentStages.map((stage) => {
                  const stageIncidents = incidentsByStage[stage.id] || [];
                  return (
                    <div
                      key={stage.id}
                      className="flex-shrink-0 w-80"
                    >
                      <Card className="h-full">
                        <CardHeader
                          className="px-4 py-3 border-b"
                          style={{ borderBottomColor: `${stage.color}40` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              <CardTitle className="text-sm font-semibold text-gray-700">
                                {stage.name}
                              </CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {stageIncidents.length}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent
                          className="px-3 py-3 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = stage.color;
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.borderColor = "transparent";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = "transparent";
                            const incidentId = e.dataTransfer.getData("incident-id");
                            if (incidentId) {
                              handleIncidentMove(incidentId, stage.id);
                            }
                          }}
                        >
                          {stageIncidents.map((incident) => {
                            const getSeverityColor = (severity: string) => {
                              switch (severity) {
                                case "CRITICAL":
                                  return "bg-red-100 text-red-800";
                                case "HIGH":
                                  return "bg-orange-100 text-orange-800";
                                case "MEDIUM":
                                  return "bg-yellow-100 text-yellow-800";
                                case "LOW":
                                  return "bg-blue-100 text-blue-800";
                                default:
                                  return "bg-gray-100 text-gray-800";
                              }
                            };
                            return (
                              <div
                                key={incident.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("incident-id", incident.id);
                                  e.stopPropagation();
                                }}
                                onClick={() => {
                                  setSelectedIncident(incident);
                                  setIsViewIncidentModalOpen(true);
                                }}
                                className="rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-medium text-sm text-gray-900 line-clamp-2">
                                    {incident.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getSeverityColor(incident.severity)}`}
                                  >
                                    {incident.severity}
                                  </Badge>
                                  {incident.dueDate && new Date(incident.dueDate) < new Date() && (
                                    <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                {incident.assignee && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                                    <User className="w-3 h-3" />
                                    <span className="truncate">
                                      {incident.assignee.name || incident.assignee.email}
                                    </span>
                                  </div>
                                )}
                                {incident.dueDate && (
                                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                    <Calendar className="w-3 h-3" />
                                    <span>{formatDate(incident.dueDate)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {stageIncidents.length === 0 && (
                            <div className="text-center py-8 text-sm text-gray-400">
                              No incidents
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
                {/* Unassigned incidents */}
                {incidentsByStage["unassigned"] && incidentsByStage["unassigned"].length > 0 && (
                  <div className="flex-shrink-0 w-80">
                    <Card className="h-full">
                      <CardHeader className="px-4 py-3 border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold text-gray-700">
                            Unassigned
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {incidentsByStage["unassigned"].length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent
                        className="px-3 py-3 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "#e5e7eb";
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderColor = "transparent";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "transparent";
                          const incidentId = e.dataTransfer.getData("incident-id");
                          if (incidentId) {
                            handleIncidentMove(incidentId, null);
                          }
                        }}
                      >
                        {incidentsByStage["unassigned"].map((incident) => {
                          const getSeverityColor = (severity: string) => {
                            switch (severity) {
                              case "CRITICAL":
                                return "bg-red-100 text-red-800";
                              case "HIGH":
                                return "bg-orange-100 text-orange-800";
                              case "MEDIUM":
                                return "bg-yellow-100 text-yellow-800";
                              case "LOW":
                                return "bg-blue-100 text-blue-800";
                              default:
                                return "bg-gray-100 text-gray-800";
                            }
                          };
                          return (
                            <div
                              key={incident.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("incident-id", incident.id);
                                e.stopPropagation();
                              }}
                              onClick={() => {
                                setSelectedIncident(incident);
                                setIsViewIncidentModalOpen(true);
                              }}
                              className="rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <p className="font-medium text-sm text-gray-900 line-clamp-2">
                                  {incident.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getSeverityColor(incident.severity)}`}
                                >
                                  {incident.severity}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "resources" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Resource Requests</h2>
              <Button
                onClick={() => setIsCreateResourceRequestModalOpen(true)}
                style={{
                  backgroundColor: getThemeColor(),
                  color: "white",
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Request
              </Button>
            </div>

            {isLoadingResourceRequests ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-500">Loading resource requests...</p>
              </div>
            ) : resourceStages.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-gray-500 mb-4">
                    No resource request stages configured. Configure stages for resource requests under Project Setup.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setManageStagesType("RESOURCE");
                      setIsManageStagesModalOpen(true);
                    }}
                  >
                    Configure Resource Stages
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {resourceStages.map((stage) => {
                  const stageRequests = resourceRequestsByStage[stage.id] || [];
                  return (
                    <div key={stage.id} className="flex-shrink-0 w-80">
                      <Card className="h-full">
                        <CardHeader
                          className="px-4 py-3"
                          style={{ borderTop: `3px solid ${stage.color}` }}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-gray-700">
                              {stage.name}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {stageRequests.length}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent
                          className="px-3 py-3 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const requestId = e.dataTransfer.getData("resource-request-id");
                            if (requestId) {
                              handleResourceRequestMove(requestId, stage.id);
                            }
                          }}
                        >
                          {stageRequests.map((request) => {
                            const getPriorityColor = (priority: string) => {
                              switch (priority) {
                                case "URGENT":
                                  return "bg-red-100 text-red-800";
                                case "HIGH":
                                  return "bg-orange-100 text-orange-800";
                                case "NORMAL":
                                  return "bg-blue-100 text-blue-800";
                                case "LOW":
                                  return "bg-gray-100 text-gray-800";
                                default:
                                  return "bg-gray-100 text-gray-800";
                              }
                            };
                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case "APPROVED":
                                  return "bg-green-100 text-green-800";
                                case "FULFILLED":
                                  return "bg-blue-100 text-blue-800";
                                case "DECLINED":
                                  return "bg-red-100 text-red-800";
                                case "CANCELLED":
                                  return "bg-gray-100 text-gray-800";
                                case "SUBMITTED":
                                  return "bg-yellow-100 text-yellow-800";
                                default:
                                  return "bg-gray-100 text-gray-800";
                              }
                            };
                            return (
                              <div
                                key={request.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("resource-request-id", request.id);
                                  e.stopPropagation();
                                }}
                                className="rounded-lg border border-gray-200 bg-white p-3 cursor-move hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-medium text-sm text-gray-900 line-clamp-2">
                                    {request.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getPriorityColor(request.priority)}`}
                                  >
                                    {request.priority}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getStatusColor(request.status)}`}
                                  >
                                    {STATUS_LABELS[request.status] || request.status}
                                  </Badge>
                                </div>
                                {request.sku && (
                                  <div className="text-xs text-gray-500 mb-1">
                                    SKU: {request.sku}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                  Qty: {request.quantity} {request.unit}
                                </div>
                                {request.estimatedCost && (
                                  <div className="text-xs font-medium text-gray-700 mt-1">
                                    {formatCurrency(request.estimatedCost, request.currency || "USD")}
                                  </div>
                                )}
                                {request.neededBy && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                                    <Calendar className="w-3 h-3" />
                                    <span>Needed by {formatDate(request.neededBy)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {stageRequests.length === 0 && (
                            <div className="text-center py-8 text-sm text-gray-400">
                              No requests
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
                {/* Unassigned resource requests */}
                {resourceRequestsByStage["unassigned"] && resourceRequestsByStage["unassigned"].length > 0 && (
                  <div className="flex-shrink-0 w-80">
                    <Card className="h-full">
                      <CardHeader className="px-4 py-3 border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold text-gray-700">
                            Unassigned
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {resourceRequestsByStage["unassigned"].length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent
                        className="px-3 py-3 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "#e5e7eb";
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderColor = "transparent";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "transparent";
                          const requestId = e.dataTransfer.getData("resource-request-id");
                          if (requestId) {
                            handleResourceRequestMove(requestId, null);
                          }
                        }}
                      >
                        {resourceRequestsByStage["unassigned"].map((request) => {
                          const getPriorityColor = (priority: string) => {
                            switch (priority) {
                              case "URGENT":
                                return "bg-red-100 text-red-800";
                              case "HIGH":
                                return "bg-orange-100 text-orange-800";
                              case "NORMAL":
                                return "bg-blue-100 text-blue-800";
                              case "LOW":
                                return "bg-gray-100 text-gray-800";
                              default:
                                return "bg-gray-100 text-gray-800";
                            }
                          };
                          return (
                            <div
                              key={request.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("resource-request-id", request.id);
                                e.stopPropagation();
                              }}
                              className="rounded-lg border border-gray-200 bg-white p-3 cursor-move hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <p className="font-medium text-sm text-gray-900 line-clamp-2">
                                  {request.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getPriorityColor(request.priority)}`}
                                >
                                  {request.priority}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-gray-700">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Project Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 text-sm text-gray-600">
              <p>
                Export snapshots of task burndown, incident aging, and resource consumption to share
                with stakeholders.
              </p>
              <Button variant="outline" className="mt-2 inline-flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Generate Report
              </Button>
              <p className="text-xs text-gray-400">
                Reports are generated on demand. Historical exports will appear here once generated.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "settings" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-gray-700">
                    <Settings className="h-5 w-5 text-slate-500" />
                    Task Board Stages
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setManageStagesType("TASK");
                      setIsManageStagesModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Stages
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {project.stages && project.stages.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {project.stages
                      .filter((s) => s.stageType === "TASK")
                      .map((stage) => (
                        <div
                          key={stage.id}
                          className="rounded-lg border border-gray-200 bg-white p-4"
                          style={{ borderTopWidth: 3, borderTopColor: stage.color }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{stage.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {stage._count.tasks} tasks
                              </p>
                            </div>
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">
                      No stages configured yet. Set up your task board stages to get started.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsManageStagesModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Set Up Stages
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Incident Stages */}
            <Card>
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-gray-700">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Incident Stages
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setManageStagesType("INCIDENT");
                      setIsManageStagesModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Stages
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {project.stages && project.stages.filter((s) => s.stageType === "INCIDENT").length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {project.stages
                      .filter((s) => s.stageType === "INCIDENT")
                      .map((stage) => (
                        <div
                          key={stage.id}
                          className="rounded-lg border border-gray-200 bg-white p-4"
                          style={{ borderTopWidth: 3, borderTopColor: stage.color }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{stage.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {stage._count.incidents} incidents
                              </p>
                            </div>
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">
                      No incident stages configured yet. Create stages to organize your incidents.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManageStagesType("INCIDENT");
                        setIsManageStagesModalOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Stages
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resource Stages */}
            <Card>
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-gray-700">
                    <Share2 className="h-5 w-5 text-purple-500" />
                    Resource Stages
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setManageStagesType("RESOURCE");
                      setIsManageStagesModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Stages
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {project.stages && project.stages.filter((s) => s.stageType === "RESOURCE").length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {project.stages
                      .filter((s) => s.stageType === "RESOURCE")
                      .map((stage) => (
                        <div
                          key={stage.id}
                          className="rounded-lg border border-gray-200 bg-white p-4"
                          style={{ borderTopWidth: 3, borderTopColor: stage.color }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{stage.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {project._count.resourceRequests || 0} requests
                              </p>
                            </div>
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">
                      No resource stages configured yet. Create stages to organize your resource requests.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManageStagesType("RESOURCE");
                        setIsManageStagesModalOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Set Up Stages
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm font-semibold uppercase text-gray-500">
                  Project Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-700">Visibility</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {VISIBILITY_LABELS[project.visibility] ?? project.visibility}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-700">Created</p>
                  <p className="mt-1 text-sm text-gray-600">{formatDate(project.createdAt, "MMM DD, YYYY HH:MM")}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-700">Last Updated</p>
                  <p className="mt-1 text-sm text-gray-600">{formatDate(project.updatedAt, "MMM DD, YYYY HH:MM")}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-700">Stage Count</p>
                  <p className="mt-1 text-sm text-gray-600">{project._count.stages}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProjectUpdated={fetchProject.bind(null, params.id as string)}
        project={project ? {
          id: project.id,
          name: project.name,
          code: project.code,
          description: project.description,
          status: project.status,
          visibility: project.visibility,
          startDate: project.startDate,
          dueDate: project.dueDate,
          budget: project.budget,
          budgetCurrency: project.budgetCurrency,
        } : null}
      />

      <AddProjectUpdateModal
        isOpen={isAddUpdateModalOpen}
        onClose={() => setIsAddUpdateModalOpen(false)}
        onUpdateAdded={fetchProject.bind(null, params.id as string)}
        projectId={params.id as string}
        projectName={project?.name || "Project"}
      />

      <AddProjectMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onMemberAdded={fetchProject.bind(null, params.id as string)}
        projectId={params.id as string}
        existingMemberIds={project?.members.map((m) => m.userId) || []}
      />

      <ManageProjectStagesModal
        isOpen={isManageStagesModalOpen}
        onClose={() => setIsManageStagesModalOpen(false)}
        stageType={manageStagesType}
        onStagesUpdated={fetchProject.bind(null, params.id as string)}
        projectId={params.id as string}
        existingStages={project?.stages || []}
      />

      <CreateProjectTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onTaskCreated={async () => {
          await fetchTasks(params.id as string);
          await fetchProject(params.id as string); // Refresh project to update stage counts
        }}
        projectId={params.id as string}
        stages={activeStages}
        existingTasks={tasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate }))}
      />

      <CreateProjectIncidentModal
        isOpen={isCreateIncidentModalOpen}
        onClose={() => setIsCreateIncidentModalOpen(false)}
        onIncidentCreated={async () => {
          await fetchIncidents(params.id as string);
          await fetchProject(params.id as string);
        }}
        projectId={params.id as string}
        stages={project?.stages || []}
        existingTasks={tasks}
      />
      <ViewEditProjectIncidentModal
        isOpen={isViewIncidentModalOpen}
        onClose={() => {
          setIsViewIncidentModalOpen(false);
          setSelectedIncident(null);
        }}
        onIncidentUpdated={async () => {
          await fetchIncidents(params.id as string);
          await fetchProject(params.id as string);
        }}
        incident={selectedIncident}
        projectId={params.id as string}
        stages={project?.stages || []}
        existingTasks={tasks}
      />

      <CreateProjectResourceRequestModal
        isOpen={isCreateResourceRequestModalOpen}
        onClose={() => setIsCreateResourceRequestModalOpen(false)}
        onRequestCreated={async () => {
          if (params?.id && typeof params.id === "string") {
            await fetchResourceRequests(params.id);
            await fetchProject(params.id);
          }
        }}
        projectId={params.id as string}
        stages={project?.stages || []}
        existingTasks={tasks}
        existingIncidents={incidents}
      />
      <ViewProjectTaskModal
        isOpen={isViewTaskModalOpen}
        onClose={() => {
          setIsViewTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onEdit={() => {
          setIsViewTaskModalOpen(false);
          setIsEditTaskModalOpen(true);
        }}
        task={selectedTask}
      />

      <EditProjectTaskModal
        isOpen={isEditTaskModalOpen}
        onClose={() => {
          setIsEditTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={async () => {
          await fetchTasks(params.id as string);
          await fetchProject(params.id as string);
          // Refresh view if it was open
          if (isViewTaskModalOpen && selectedTask) {
            await fetchFullTask();
          }
        }}
        task={selectedTask}
        projectId={params.id as string}
        stages={activeStages}
        existingTasks={tasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate }))}
      />
    </div>
  );
}

