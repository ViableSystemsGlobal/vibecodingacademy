"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { AddProjectModal } from "@/components/modals/add-project-modal";
import {
  KanbanSquare,
  Plus,
  Search,
  Filter,
  Users,
  Target,
  AlertTriangle,
  Timer,
  ClipboardList,
  Share2,
} from "lucide-react";

type ProjectSummary = {
  id: string;
  name: string;
  code: string | null;
  description?: string | null;
  status: string;
  visibility: string;
  startDate?: string | null;
  dueDate?: string | null;
  budget?: number | null;
  budgetCurrency?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
  _count: {
    members: number;
    tasks: number;
    incidents: number;
    resourceRequests: number;
  };
};

type ProjectsSummary = {
  total: number;
  upcoming: number;
  overdue: number;
  byStatus: Record<string, number>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-slate-200 text-slate-700",
};

const VISIBILITY_LABELS: Record<string, string> = {
  INTERNAL: "Internal",
  CLIENT: "Client",
  PARTNER: "Partner",
};

export default function ProjectsPage() {
  const { getThemeColor } = useTheme();
  const { error: showError } = useToast();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [summary, setSummary] = useState<ProjectsSummary>({
    total: 0,
    upcoming: 0,
    overdue: 0,
    byStatus: {},
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("ALL");
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      const data = await response.json();
      setProjects(data.projects || []);
      setSummary(data.summary || { total: 0, upcoming: 0, overdue: 0, byStatus: {} });
    } catch (error) {
      console.error("❌ Error fetching projects:", error);
      showError("Error", "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (statusFilter !== "ALL") {
      list = list.filter((project) => project.status === statusFilter);
    }

    if (visibilityFilter !== "ALL") {
      list = list.filter((project) => project.visibility === visibilityFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((project) => {
        return (
          project.name.toLowerCase().includes(term) ||
          project.code?.toLowerCase().includes(term) ||
          project.owner?.name?.toLowerCase().includes(term) ||
          project.owner?.email?.toLowerCase().includes(term)
        );
      });
    }

    return list;
  }, [projects, statusFilter, visibilityFilter, searchTerm]);

  const statusBreakdown = useMemo(() => {
    const entries = Object.entries(summary.byStatus);
    return entries.length ? entries : Object.entries(STATUS_LABELS).map(([status]) => [status, 0]);
  }, [summary.byStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">
            Track implementation progress, manage incidents, and keep delivery teams aligned.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProjects()}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="flex items-center gap-2"
            style={{ backgroundColor: getThemeColor(), borderColor: getThemeColor() }}
            onClick={() => setIsAddProjectModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* AI Insight + Metrics (match products layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Project AI Coach"
            subtitle="Prioritized actions to keep delivery on track"
            page="projects"
            enableAI
            onRecommendationComplete={(id) => console.log("Project recommendation completed:", id)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 border border-gray-200 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-xl font-bold text-gray-900">{summary.total}</p>
              </div>
              <div className="p-2 rounded-full bg-blue-50">
                <KanbanSquare className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-gray-200 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-xl font-bold text-emerald-600">
                  {summary.byStatus.ACTIVE ?? 0}
                </p>
              </div>
              <div className="p-2 rounded-full bg-emerald-100">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-gray-200 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Deadlines</p>
                <p className="text-xl font-bold text-amber-600">{summary.upcoming}</p>
              </div>
              <div className="p-2 rounded-full bg-amber-100">
                <Timer className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-gray-200 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">At Risk / Overdue</p>
                <p className="text-xl font-bold text-rose-600">{summary.overdue}</p>
              </div>
              <div className="p-2 rounded-full bg-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Filters + Status + List */}
      <Card>
        <CardContent className="p-0">
          {/* Filters */}
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between border-b border-gray-200">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search projects"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All visibilities</option>
                {Object.entries(VISIBILITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="px-4 py-3 border-b border-gray-200">
            <CardTitle className="text-sm font-semibold uppercase text-gray-500">
              Status Breakdown
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-3 px-4 pb-4 border-b border-gray-100">
            {statusBreakdown.map(([status, count]) => (
              <Badge
                key={status}
                variant="outline"
                className="rounded-full px-3 py-1 text-xs font-semibold"
              >
                {STATUS_LABELS[status] ?? status}: {count}
              </Badge>
            ))}
          </div>

          {/* Project list */}
          <div className="grid gap-4 p-4 sm:grid-cols-1 md:grid-cols-2">
            {isLoading ? (
              <div className="p-10 text-center text-gray-500">
                Loading projects...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No projects match your filters yet.
              </div>
            ) : (
              filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className="h-full border border-gray-200 transition hover:border-gray-300 hover:shadow-sm"
                >
                  <CardContent className="flex h-full flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[project.status] ?? "bg-gray-100 text-gray-700"}`}
                        >
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
                      <Link href={`/projects/${project.id}`} className="group inline-flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                          {project.name}
                        </h2>
                      </Link>
                      {project.description ? (
                        <p className="max-w-3xl text-sm text-gray-600">{project.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          {project._count.members} members
                        </span>
                        <span className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-gray-400" />
                          {project._count.tasks} tasks
                        </span>
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-gray-400" />
                          {project._count.incidents} incidents
                        </span>
                        <span className="flex items-center gap-2">
                          <Share2 className="h-4 w-4 text-gray-400" />
                          {project._count.resourceRequests} resource requests
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onProjectCreated={fetchProjects}
      />
    </div>
  );
}

