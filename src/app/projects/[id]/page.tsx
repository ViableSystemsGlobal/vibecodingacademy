"use client";

/// <reference types="@types/google.maps" />

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
  Pencil,
  Eye,
  Sparkles,
  FileText,
  Upload,
  Trash2,
  Download,
  MapPin,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditProjectModal } from "@/components/modals/edit-project-modal";
import { AddProjectMemberModal } from "@/components/modals/add-project-member-modal";
import { ManageProjectStagesModal } from "@/components/modals/manage-project-stages-modal";
import { CreateProjectTaskModal } from "@/components/modals/create-project-task-modal";
import { EditProjectTaskModal } from "@/components/modals/edit-project-task-modal";
import { ViewProjectTaskModal } from "@/components/modals/view-project-task-modal";
import { CreateProjectIncidentModal } from "@/components/modals/create-project-incident-modal";
import { ViewEditProjectIncidentModal } from "@/components/modals/view-edit-project-incident-modal";
import { CreateProjectResourceRequestModal } from "@/components/modals/create-project-resource-request-modal";
import { EditProjectResourceRequestModal } from "@/components/modals/edit-project-resource-request-modal";
import { ViewProjectResourceRequestModal } from "@/components/modals/view-project-resource-request-modal";
import { GenerateAiReportModal } from "@/components/modals/generate-ai-report-modal";
import { ProjectGanttChart } from "@/components/project-gantt-chart";
import { ProjectCalendarView } from "@/components/project-calendar-view";
import { DailyReportsTab } from "@/components/daily-reports-tab";

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
  emailTo?: string | null;
  emailCc?: string | null;
  items?: Array<{
    id?: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
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
  scope: string | null;
  status: string;
  visibility: string;
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  budgetCurrency: string | null;
  latitude: number | null;
  longitude: number | null;
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
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  FULFILLED: "Fulfilled",
  DECLINED: "Declined",
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

// Project Location Map Component
function ProjectLocationMap({ projectId, project }: { projectId: string; project: ProjectDetail | null }) {
  const { getThemeColor } = useTheme();
  const { success, error: showError } = useToast();
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSettingLocation, setIsSettingLocation] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    project?.latitude && project?.longitude 
      ? { lat: project.latitude, lng: project.longitude }
      : null
  );

  useEffect(() => {
    if (project?.latitude && project?.longitude) {
      setLocation({ lat: project.latitude, lng: project.longitude });
    }
  }, [project]);

  useEffect(() => {
    const initializeMap = async () => {
      try {
        const response = await fetch('/api/settings/google-maps', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error('Failed to fetch Google Maps config:', response.status);
          return;
        }
        
        const data = await response.json();
        const googleMapsApiKey = data.config?.apiKey;

        if (!googleMapsApiKey || mapLoaded) {
          if (!googleMapsApiKey) {
            console.warn('Google Maps API key not found in settings');
          }
          return;
        }

        if (window.google && window.google.maps) {
          createMap();
          return;
        }

        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          existingScript.addEventListener('load', createMap);
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('Google Maps script loaded successfully');
          createMap();
        };
        script.onerror = (error) => {
          console.error('Failed to load Google Maps script:', error);
          showError('Error', 'Failed to load Google Maps. Please check your API key in settings.');
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error initializing map:', error);
        showError('Error', 'Failed to initialize map');
      }
    };

    if (!mapLoaded) {
      initializeMap();
    }
  }, [mapLoaded]);

  const createMap = () => {
    setTimeout(() => {
      try {
        const mapElement = document.getElementById('project-location-map');
        if (!mapElement) {
          console.error('Map element not found');
          return;
        }
        
        if ((window as any).google && (window as any).google.maps) {
          const center = location || { lat: 5.6037, lng: -0.1870 }; // Default to Accra
          const googleMap = new (window as any).google.maps.Map(mapElement, {
            zoom: location ? 15 : 10,
            center,
            mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP
          });

          console.log('Google Maps created successfully');
          setMap(googleMap);
          setMapLoaded(true);

          if (location) {
            const projectMarker = new (window as any).google.maps.Marker({
              position: location,
              map: googleMap,
              title: project?.name || 'Project Location',
              draggable: true
            });
            setMarker(projectMarker);

            projectMarker.addListener('dragend', (e: any) => {
              if (e.latLng) {
                const newLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                setLocation(newLocation);
                updateProjectLocation(newLocation);
              }
            });
          }

          googleMap.addListener('click', (e: any) => {
            if (e.latLng && isSettingLocation) {
              const newLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              setLocation(newLocation);
              
              if (marker) {
                marker.setPosition(newLocation);
              } else {
                const newMarker = new (window as any).google.maps.Marker({
                  position: newLocation,
                  map: googleMap,
                  title: project?.name || 'Project Location',
                  draggable: true
                });
                setMarker(newMarker);
                
                newMarker.addListener('dragend', (e: any) => {
                  if (e.latLng) {
                    const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                    setLocation(newLoc);
                    updateProjectLocation(newLoc);
                  }
                });
              }
              
              updateProjectLocation(newLocation);
              setIsSettingLocation(false);
            }
          });
        } else {
          console.error('Google Maps API not available');
          showError('Error', 'Google Maps API not loaded. Please check your API key in settings.');
        }
      } catch (error) {
        console.error('Error creating Google Maps:', error);
        showError('Error', 'Failed to create map');
      }
    }, 100);
  };

  const updateProjectLocation = async (loc: { lat: number; lng: number }) => {
    try {
      console.log('Updating project location:', loc);
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: loc.lat, longitude: loc.lng })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Location updated successfully:', data);
        success('Project location updated');
        // Update local state to reflect the change
        setLocation(loc);
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        console.error('Failed to update location:', response.status, errorData);
        showError('Error', errorData.error || errorData.details || 'Failed to update location');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      showError('Error', 'Failed to update location');
    }
  };

  const handleSetLocation = () => {
    setIsSettingLocation(true);
    if (map) {
      map.setOptions({ cursor: 'crosshair' });
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showError('Error', 'Geolocation is not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(newLocation);
        
        if (map) {
          map.setCenter(newLocation);
          map.setZoom(15);
        }
        
        if (marker) {
          marker.setPosition(newLocation);
        } else if (map) {
          const newMarker = new (window as any).google.maps.Marker({
            position: newLocation,
            map,
            title: project?.name || 'Project Location',
            draggable: true
          });
          setMarker(newMarker);
          
          newMarker.addListener('dragend', (e: any) => {
            if (e.latLng) {
              const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              setLocation(newLoc);
              updateProjectLocation(newLoc);
            }
          });
        }
        
        updateProjectLocation(newLocation);
      },
      (error) => {
        console.error('Error getting location:', error);
        showError('Error', 'Unable to get your location');
      }
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-3 py-2 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Project Location
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetLocation}
              className="text-xs h-6 px-2"
              disabled={!mapLoaded}
              title={isSettingLocation ? "Click on the map to set location" : "Click to enable map selection mode"}
            >
              {isSettingLocation ? 'Click Map' : 'Set Location'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseCurrentLocation}
              className="text-xs h-6 px-2"
              disabled={!mapLoaded}
              title="Use your current GPS location"
            >
              Use My Location
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex-1 flex flex-col">
        <div 
          id="project-location-map" 
          className="w-full flex-1 rounded-lg border border-gray-200"
          style={{ minHeight: '200px' }}
        />
        {!mapLoaded && (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            Loading map...
          </div>
        )}
        {isSettingLocation && (
          <p className="mt-2 text-xs text-blue-600">Click on the map to set the project location</p>
        )}
      </CardContent>
    </Card>
  );
}

// AI Summary Card Component
function ProjectAISummaryCard({ projectId }: { projectId: string }) {
  const { getThemeColor, getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const [summary, setSummary] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${projectId}/ai-summary`);
        if (response.ok) {
          const data = await response.json();
          setSummary(data.summary || "Unable to generate summary at this time.");
          setScore(data.score ?? null);
        } else {
          setSummary("Unable to generate summary at this time.");
          setScore(null);
        }
      } catch (error) {
        console.error("Error fetching AI summary:", error);
        setSummary("Unable to generate summary at this time.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [projectId]);

  const getGradientBackgroundClasses = () => {
    switch (theme.primary) {
      case 'blue': return 'bg-gradient-to-br from-blue-500 to-blue-600';
      case 'green': return 'bg-gradient-to-br from-green-500 to-green-600';
      case 'purple': return 'bg-gradient-to-br from-purple-500 to-purple-600';
      case 'red': return 'bg-gradient-to-br from-red-500 to-red-600';
      case 'orange': return 'bg-gradient-to-br from-orange-500 to-orange-600';
      case 'pink': return 'bg-gradient-to-br from-pink-500 to-pink-600';
      case 'indigo': return 'bg-gradient-to-br from-indigo-500 to-indigo-600';
      case 'teal': return 'bg-gradient-to-br from-teal-500 to-teal-600';
      default: return 'bg-gradient-to-br from-blue-500 to-blue-600';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-0 shadow-lg flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${getGradientBackgroundClasses()} shadow-lg`}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-gray-900">AI Project Summary</CardTitle>
              <p className="text-xs text-gray-600">Current status & insights</p>
            </div>
          </div>
          {score !== null && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Project Score</p>
                <div className="flex items-center gap-1.5">
                  <div className="relative w-10 h-10">
                    <svg className="transform -rotate-90 w-10 h-10">
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-200"
                      />
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${(score / 100) * 100.5} 100.5`}
                        className={score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500"}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                        {score}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-gray-600">Generating summary...</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "board", label: "Task Board", icon: ClipboardList },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "resources", label: "Resource Requests", icon: Share2 },
  { id: "daily-reports", label: "Daily Report Writing", icon: Calendar },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
  { id: "settings", label: "Project Setup", icon: Settings },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
  const [isEditResourceRequestModalOpen, setIsEditResourceRequestModalOpen] = useState(false);
  const [isViewResourceRequestModalOpen, setIsViewResourceRequestModalOpen] = useState(false);
  const [selectedResourceRequest, setSelectedResourceRequest] = useState<ProjectResourceRequest | null>(null);
  const [resourceRequests, setResourceRequests] = useState<ProjectResourceRequest[]>([]);
  const [isLoadingResourceRequests, setIsLoadingResourceRequests] = useState(false);
  const [isAiReportModalOpen, setIsAiReportModalOpen] = useState(false);
  const [isEditingScope, setIsEditingScope] = useState(false);
  const [scopeValue, setScopeValue] = useState<string>("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentDescription, setDocumentDescription] = useState<string>("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

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

  const fetchDocuments = useCallback(async (projectId: string) => {
    try {
      setIsLoadingDocuments(true);
      const response = await fetch(`/api/projects/${projectId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  const handleUpdateScope = async () => {
    if (!project) return;
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: project.name,
          scope: scopeValue,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setIsEditingScope(false);
      } else {
        const errorData = await response.json().catch(() => null);
        showError("Error", errorData?.error || "Failed to update scope");
      }
    } catch (error) {
      console.error("Error updating scope:", error);
      showError("Error", "Failed to update scope");
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !project) return;

    try {
      setIsUploadingDocument(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (documentDescription.trim()) {
        formData.append("description", documentDescription.trim());
      }

      const response = await fetch(`/api/projects/${project.id}/documents`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const newDocument = await response.json();
        setDocuments((prev) => [newDocument, ...prev]);
        setSelectedFile(null);
        setDocumentDescription("");
        // Reset file input
        const fileInput = document.getElementById("document-file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        const errorData = await response.json().catch(() => null);
        showError("Error", errorData?.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      showError("Error", "Failed to upload document");
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!project) return;
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${project.id}/documents/${documentId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      } else {
        const errorData = await response.json().catch(() => null);
        showError("Error", errorData?.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      showError("Error", "Failed to delete document");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;
    
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update project status");
      }

      const data = await response.json();
      setProject({ ...project, status: data.project.status });
      success("Project status updated successfully");
    } catch (error) {
      console.error("Error updating project status:", error);
      showError("Error", error instanceof Error ? error.message : "Failed to update project status");
      // Revert the select value on error
      if (project) {
        const select = document.getElementById("project-status-select") as HTMLSelectElement;
        if (select) select.value = project.status;
      }
    }
  };

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
      setScopeValue(data.project.scope || "");
      // Fetch tasks, incidents, and resource requests when project is loaded
      fetchTasks(id);
      fetchIncidents(id);
      fetchResourceRequests(id);
      fetchDocuments(id);
    } catch (error) {
      console.error("❌ Error fetching project:", error);
      showError("Error", "Unable to load project details");
    } finally {
      setIsLoading(false);
    }
  }, [router, showError, fetchTasks, fetchIncidents, fetchResourceRequests, fetchDocuments]);

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
    if (!project || !project.stages) return [];
    return project.stages
      .filter((s) => s.stageType === "TASK")
      .sort((a, b) => a.order - b.order);
  }, [project]);

  const incidentStages = useMemo(() => {
    if (!project || !project.stages) return [];
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
    if (!project || !project.stages) return [];
    return project.stages
      .filter((s) => s.stageType === "RESOURCE")
      .sort((a, b) => a.order - b.order);
  }, [project]);

  const defaultTaskStageId = activeStages.length > 0 ? activeStages[0].id : null;
  const defaultIncidentStageId = incidentStages.length > 0 ? incidentStages[0].id : null;
  const defaultResourceStageId = resourceStages.length > 0 ? resourceStages[0].id : null;

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
            <select
              id="project-status-select"
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="space-y-4">
        {activeTab === "overview" ? (
          <>
            {/* First Row: AI Card and Metrics */}
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Column 1: AI Summary Card (3/5 width - wider) */}
              <div className="lg:col-span-3 flex">
                <ProjectAISummaryCard projectId={params.id as string} />
              </div>

              {/* Column 2: Metric Cards (2/5 width) */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-2 gap-2 h-full">
              <Card>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-gray-500">Total Tasks</p>
                      <p className="mt-1 text-lg font-bold">{project._count.tasks}</p>
                </CardContent>
              </Card>
              <Card>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-gray-500">Incidents</p>
                      <p className="mt-1 text-lg font-bold">{project._count.incidents}</p>
                </CardContent>
              </Card>
              <Card>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-gray-500">Resource Requests</p>
                      <p className="mt-1 text-lg font-bold">{project._count.resourceRequests}</p>
                </CardContent>
              </Card>
              <Card>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-gray-500">Team Members</p>
                      <p className="mt-1 text-lg font-bold">{project._count.members}</p>
                </CardContent>
              </Card>
                </div>
              </div>
            </div>

            {/* Second Row: Project Team, Scope, and Project Location (half size) */}
            <div className="grid gap-4 lg:grid-cols-6">
              {/* Column 1: Project Team (1/6 width - half size) */}
              <Card className="lg:col-span-2 flex flex-col h-[300px]">
                <CardHeader className="px-3 py-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold uppercase text-gray-500">
                    Project Team
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddMemberModalOpen(true)}
                      className="text-xs h-6 px-2"
                  >
                      + Add
                  </Button>
                </div>
              </CardHeader>
                <CardContent className="px-3 pb-3 flex-1 overflow-y-auto">
                  {project.members && project.members.length > 0 ? (
                    <div className="space-y-2">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                          className="rounded-lg border border-gray-200 bg-white p-2"
                  >
                          <p className="font-medium text-gray-900 text-xs">
                      {member.user?.name || member.user?.email || "Member"}
                    </p>
                          <p className="text-xs text-gray-500 truncate">{member.user?.email}</p>
                          <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                            <Badge variant="outline" className="rounded-full px-1.5 py-0.5 text-xs">
                        {member.role}
                      </Badge>
                            {member.isExternal && (
                              <Badge variant="outline" className="rounded-full px-1.5 py-0.5 text-xs">
                          External
                        </Badge>
                            )}
                    </div>
                  </div>
                ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500">
                    No team members assigned yet.
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddMemberModalOpen(true)}
                        className="mt-2 w-full text-xs h-6"
                    >
                      + Add First Member
                    </Button>
                  </div>
                  )}
              </CardContent>
            </Card>

              {/* Column 2: Scope of Project (1/6 width - half size) */}
              <Card className="lg:col-span-2 flex flex-col h-[300px]">
                <CardHeader className="px-3 py-2 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold uppercase text-gray-500">
                      Scope of Project
                    </CardTitle>
                    {!isEditingScope ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingScope(true)}
                        className="text-xs h-6 px-2"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingScope(false);
                            setScopeValue(project?.scope || "");
                          }}
                          className="text-xs h-6 px-2"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateScope}
                          className="text-xs h-6 px-2"
                          style={{ backgroundColor: getThemeColor(), color: "white" }}
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 flex-1 overflow-y-auto">
                  {isEditingScope ? (
                    <Textarea
                      value={scopeValue}
                      onChange={(e) => setScopeValue(e.target.value)}
                      placeholder="Enter the scope of the project..."
                      rows={6}
                      className="w-full text-xs"
                    />
                  ) : (
                    <div className="text-xs text-gray-700 whitespace-pre-wrap">
                      {project?.scope || (
                        <span className="text-gray-400 italic">No scope defined yet. Click Edit to add scope.</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 3: Project Location Map (1/6 width - half size) */}
              <div className="lg:col-span-2 h-[300px]">
                <ProjectLocationMap projectId={params.id as string} project={project} />
              </div>
            </div>
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
                                  <p 
                                    className="font-medium text-sm text-gray-900 line-clamp-2 flex-1 cursor-pointer hover:text-blue-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedResourceRequest(request);
                                      setIsViewResourceRequestModalOpen(true);
                                    }}
                                    title="View resource request"
                                  >
                                    {request.title}
                                  </p>
                                  <div className="flex items-center gap-1 ml-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedResourceRequest(request);
                                        setIsViewResourceRequestModalOpen(true);
                                      }}
                                      title="View resource request"
                                    >
                                      <Eye className="h-3 w-3 text-gray-500 hover:text-blue-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedResourceRequest(request);
                                        setIsEditResourceRequestModalOpen(true);
                                      }}
                                      title="Edit resource request"
                                    >
                                      <Pencil className="h-3 w-3 text-gray-500 hover:text-blue-600" />
                                    </Button>
                                  </div>
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
                                <p 
                                  className="font-medium text-sm text-gray-900 line-clamp-2 flex-1 cursor-pointer hover:text-blue-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedResourceRequest(request);
                                    setIsViewResourceRequestModalOpen(true);
                                  }}
                                  title="View resource request"
                                >
                                  {request.title}
                                </p>
                                <div className="flex items-center gap-1 ml-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedResourceRequest(request);
                                      setIsViewResourceRequestModalOpen(true);
                                    }}
                                    title="View resource request"
                                  >
                                    <Eye className="h-3 w-3 text-gray-500 hover:text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedResourceRequest(request);
                                      setIsEditResourceRequestModalOpen(true);
                                    }}
                                    title="Edit resource request"
                                  >
                                    <Pencil className="h-3 w-3 text-gray-500 hover:text-blue-600" />
                                  </Button>
                                </div>
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
          <div className="space-y-6">
            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{tasks.length}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tasks.filter(t => t.status === "COMPLETED").length} completed
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Incidents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{incidents.length}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {incidents.filter(i => i.status === "RESOLVED").length} resolved
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Resource Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{resourceRequests.length}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {resourceRequests.filter(r => r.status === "APPROVED" || r.status === "FULFILLED").length} approved
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{project?.members?.length || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">Active contributors</p>
                </CardContent>
              </Card>
            </div>

            {/* Report Generation Section */}
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-gray-700">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                  Project Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 text-sm text-gray-600">
              <p>
                Export snapshots of task burndown, incident aging, and resource consumption to share
                with stakeholders.
              </p>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    className="inline-flex items-center gap-2"
                    onClick={() => {
                      // TODO: Implement standard report generation
                      showError("Standard report generation coming soon");
                    }}
                  >
                <BarChart3 className="h-4 w-4" />
                Generate Report
              </Button>
                  <Button 
                    className="inline-flex items-center gap-2"
                    style={{ backgroundColor: getThemeColor(), color: 'white' }}
                    onClick={() => {
                      setIsAiReportModalOpen(true);
                    }}
                  >
                    <Activity className="h-4 w-4" />
                    Generate Report by AI
                  </Button>
                </div>
              <p className="text-xs text-gray-400">
                Reports are generated on demand. Historical exports will appear here once generated.
              </p>
            </CardContent>
          </Card>
          </div>
        ) : null}

        {activeTab === "daily-reports" ? (
          <DailyReportsTab projectId={params?.id as string} />
        ) : null}

        {activeTab === "documents" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase text-gray-500">
                    Project Documents
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const fileInput = document.getElementById("document-file");
                      fileInput?.click();
                    }}
                    className="text-xs"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {/* Hidden file input */}
                <input
                  id="document-file"
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        showError("Error", "File size must be less than 10MB");
                        return;
                      }
                      setSelectedFile(file);
                    }
                  }}
                />

                {/* Upload form */}
                {selectedFile && (
                  <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">{selectedFile.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedFile(null)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document-description" className="text-xs text-gray-600">
                        Description (Optional)
                      </Label>
                      <Input
                        id="document-description"
                        value={documentDescription}
                        onChange={(e) => setDocumentDescription(e.target.value)}
                        placeholder="Add a description for this document..."
                        className="text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleUploadDocument}
                      disabled={isUploadingDocument}
                      className="mt-3"
                      style={{ backgroundColor: getThemeColor(), color: "white" }}
                    >
                      {isUploadingDocument ? "Uploading..." : "Upload Document"}
                    </Button>
                  </div>
                )}

                {/* Documents list */}
                {isLoadingDocuments ? (
                  <div className="text-center py-8 text-gray-500">Loading documents...</div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>No documents uploaded yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Upload Document" to add files.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.originalName}
                            </p>
                            {doc.description && (
                              <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span>Uploaded by {doc.uploader?.name || doc.uploader?.email || "Unknown"}</span>
                              <span>•</span>
                              <span>{formatDate(doc.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(doc.filePath, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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

      <AddProjectMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onMemberAdded={fetchProject.bind(null, params.id as string)}
        projectId={params.id as string}
        existingMemberIds={project?.members?.map((m) => m.user?.id).filter((id): id is string => id !== undefined) || []}
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
        defaultStageId={defaultTaskStageId}
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
        stages={incidentStages}
        defaultStageId={defaultIncidentStageId}
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
        stages={resourceStages}
        defaultStageId={defaultResourceStageId}
        existingTasks={tasks}
        existingIncidents={incidents}
      />
      <EditProjectResourceRequestModal
        isOpen={isEditResourceRequestModalOpen}
        onClose={() => {
          setIsEditResourceRequestModalOpen(false);
          setSelectedResourceRequest(null);
        }}
        onRequestUpdated={async () => {
          if (params?.id && typeof params.id === "string") {
            await fetchResourceRequests(params.id);
            await fetchProject(params.id);
          }
        }}
        projectId={params.id as string}
        resourceRequest={selectedResourceRequest}
        stages={project?.stages || []}
        existingTasks={tasks}
        existingIncidents={incidents}
      />
      <ViewProjectResourceRequestModal
        isOpen={isViewResourceRequestModalOpen}
        onClose={() => {
          setIsViewResourceRequestModalOpen(false);
          setSelectedResourceRequest(null);
        }}
        onEdit={() => {
          setIsViewResourceRequestModalOpen(false);
          setIsEditResourceRequestModalOpen(true);
        }}
        projectId={params.id as string}
        resourceRequest={selectedResourceRequest}
      />
      <GenerateAiReportModal
        isOpen={isAiReportModalOpen}
        onClose={() => setIsAiReportModalOpen(false)}
        projectId={params.id as string}
        projectName={project?.name || "Project"}
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

