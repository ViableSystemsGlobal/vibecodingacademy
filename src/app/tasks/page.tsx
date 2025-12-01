'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Pause,
  Play,
  Grid3X3,
  List,
  Settings,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy
} from 'lucide-react';
import { AIRecommendationCard } from '@/components/ai-recommendation-card';
import SimpleCreateTaskModal from '@/components/modals/simple-create-task-modal';
import EditTaskModal from '@/components/modals/edit-task-modal';
import TaskSlideout from '@/components/task-slideout';
import TaskCalendar from '@/components/task-calendar';
import { DropdownMenu } from '@/components/ui/dropdown-menu-custom';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  completedAt?: string;
  assignedTo?: string; // Legacy field
  assignmentType: 'INDIVIDUAL' | 'COLLABORATIVE';
  createdBy: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  creator: {
    id: string;
    name: string;
    email: string;
  };
  assignees: {
    id: string;
    userId: string;
    status: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  createdAt: string;
  updatedAt: string;
  dependencies: {
    id: string;
    dependsOnTask: {
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate?: string;
    };
  }[];
  dependentTasks: {
    id: string;
    task: {
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate?: string;
    };
  }[];
}

interface TaskStats {
  PENDING?: number;
  IN_PROGRESS?: number;
  COMPLETED?: number;
  CANCELLED?: number;
  OVERDUE?: number;
}

// Component that uses useSearchParams
function TasksPageContent() {
  const { data: session } = useSession();
  const { themeColor, getThemeClasses, getThemeColor } = useTheme();
  const { success: showSuccess, error: showError } = useToast();
  const themeClasses = getThemeClasses();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<TaskStats>({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all');
  const [recurringFilter, setRecurringFilter] = useState('all');
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const itemsPerPage = 10;
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Read URL parameters on mount
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [statusFilter, priorityFilter, assignedToFilter, recurringFilter]);

  // Check for overdue tasks periodically
  useEffect(() => {
    const checkOverdueTasks = async () => {
      try {
        await fetch('/api/tasks/check-overdue', { method: 'POST' });
      } catch (error) {
        console.error('Error checking overdue tasks:', error);
      }
    };

    // Check immediately on page load
    checkOverdueTasks();

    // Check every 5 minutes
    const interval = setInterval(checkOverdueTasks, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (assignedToFilter !== 'all') params.append('assignedTo', assignedToFilter);
      if (recurringFilter !== 'all') params.append('recurring', recurringFilter);

      console.log('Loading tasks from:', `/api/tasks?${params}`);
      
      const response = await fetch(`/api/tasks?${params}`, {
        credentials: 'include', // Include session cookies
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Tasks data received:', data);
        setTasks(data.tasks || []);
        setStats(data.stats || {});
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('API Error:', errorData);
          if (errorData && (errorData.error || errorData.message)) {
            errorMessage = errorData.error || errorData.message;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        showError(`Failed to load tasks: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      showError('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update the local state immediately for better UX
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, status: newStatus as any }
              : task
          )
        );
        showSuccess('Task status updated successfully!');
      } else {
        showError('Failed to update task status');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      showError('Failed to update task status');
    }
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsSlideoutOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  const handleDuplicateTask = async (task: Task) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `${task.title} (Copy)`,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
          assignedTo: task.assignedTo,
        }),
      });

      if (response.ok) {
        showSuccess('Task duplicated successfully!');
        loadTasks(); // Refresh the task list
      } else {
        showError('Failed to duplicate task');
      }
    } catch (error) {
      console.error('Error duplicating task:', error);
      showError('Failed to duplicate task');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          showSuccess('Task deleted successfully!');
          loadTasks(); // Refresh the task list
        } else {
          showError('Failed to delete task');
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        showError('Failed to delete task');
      }
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        showSuccess(`Task "${task.title}" marked as completed!`);
        loadTasks(); // Refresh the task list
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to complete task');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      showError('Failed to complete task');
    }
  };

  // Bulk action functions
  const handleSelectAll = () => {
    if (selectedTasks.length === paginatedTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(paginatedTasks.map(task => task.id));
    }
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleBulkComplete = async () => {
    try {
      const promises = selectedTasks.map(taskId => 
        fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
          }),
        })
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter(response => response.ok).length;

      if (successCount === selectedTasks.length) {
        showSuccess(`Successfully completed ${successCount} tasks!`);
      } else {
        showError(`Completed ${successCount} of ${selectedTasks.length} tasks`);
      }

      setSelectedTasks([]);
      loadTasks();
    } catch (error) {
      console.error('Error completing tasks:', error);
      showError('Failed to complete tasks');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedTasks.length} tasks?`)) {
      return;
    }

    try {
      const promises = selectedTasks.map(taskId => 
        fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        })
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter(response => response.ok).length;

      if (successCount === selectedTasks.length) {
        showSuccess(`Successfully deleted ${successCount} tasks!`);
      } else {
        showError(`Deleted ${successCount} of ${selectedTasks.length} tasks`);
      }

      setSelectedTasks([]);
      loadTasks();
    } catch (error) {
      console.error('Error deleting tasks:', error);
      showError('Failed to delete tasks');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'IN_PROGRESS':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'OVERDUE':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 border-red-200 animate-pulse'; // Special styling for overdue
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesAssignee = assignedToFilter === 'all' || task.assignedTo === assignedToFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  // Reset to page 1 when filters change and clear selections
  useEffect(() => {
    setCurrentPage(1);
    setSelectedTasks([]);
  }, [statusFilter, priorityFilter, assignedToFilter, searchTerm]);

  const groupedTasks = {
    PENDING: filteredTasks.filter(task => task.status === 'PENDING'),
    IN_PROGRESS: filteredTasks.filter(task => task.status === 'IN_PROGRESS'),
    COMPLETED: filteredTasks.filter(task => task.status === 'COMPLETED'),
    CANCELLED: filteredTasks.filter(task => task.status === 'CANCELLED'),
    OVERDUE: filteredTasks.filter(task => task.status === 'OVERDUE'),
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    };

    return (
      <Card 
        className="p-4 mb-3 hover:shadow-md transition-shadow cursor-move"
        draggable
        onDragStart={handleDragStart}
        onClick={() => handleViewTask(task)}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-gray-900 line-clamp-2">{task.title}</h4>
          <div className="flex items-center gap-1">
            <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            {task.status === 'OVERDUE' && (
              <span className="text-red-500 text-xs">🚨</span>
            )}
          </div>
        </div>
        
        {task.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>
              {task.assignees.length > 0 ? (
                task.assignees.length > 1 
                  ? `${task.assignees[0].user.name} +${task.assignees.length - 1}`
                  : task.assignees[0].user.name
              ) : task.assignee ? (
                task.assignee.name
              ) : (
                'Unassigned'
              )}
            </span>
            {task.assignmentType === 'COLLABORATIVE' && (
              <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                Team
              </span>
            )}
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Complete Task Button */}
        {task.status !== 'COMPLETED' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-green-600 border-green-200 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                handleCompleteTask(task);
              }}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const KanbanColumn = ({ status, title, tasks, count }: { 
    status: string; 
    title: string; 
    tasks: Task[]; 
    count: number;
  }) => {
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      
      // Don't update if the task is already in this status
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status === status) {
        return;
      }
      
      updateTaskStatus(taskId, status);
    };

    return (
      <div className="flex-1 min-w-0">
        <div 
          className="bg-gray-50 rounded-lg p-4 min-h-[400px] transition-colors hover:bg-gray-100"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(status)}
              <h3 className="font-medium text-gray-900">{title}</h3>
              <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                {count}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Drop tasks here
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage and track all tasks across your team</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              className={`flex items-center gap-1 sm:gap-2 ${viewMode === 'list' ? 'text-white hover:opacity-90 transition-opacity' : ''}`}
              style={viewMode === 'list' ? { backgroundColor: getThemeColor() || '#dc2626' } : undefined}
            >
              <List className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              onClick={() => setViewMode('kanban')}
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              className={`flex items-center gap-1 sm:gap-2 ${viewMode === 'kanban' ? 'text-white hover:opacity-90 transition-opacity' : ''}`}
              style={viewMode === 'kanban' ? { backgroundColor: getThemeColor() || '#dc2626' } : undefined}
            >
              <Grid3X3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              onClick={() => setViewMode('calendar')}
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              className={`flex items-center gap-1 sm:gap-2 ${viewMode === 'calendar' ? 'text-white hover:opacity-90 transition-opacity' : ''}`}
              style={viewMode === 'calendar' ? { backgroundColor: getThemeColor() || '#dc2626' } : undefined}
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
            <Button
              onClick={() => setIsCreateTaskModalOpen(true)}
              size="sm"
              className="text-white hover:opacity-90 transition-opacity flex items-center gap-1 sm:gap-2 w-full sm:w-auto"
              style={{ backgroundColor: getThemeColor() || '#dc2626' }}
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Create Task</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </div>

        {/* AI Recommendation Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="flex">
            <div className="w-full h-full">
              <AIRecommendationCard
                title="Task Management AI"
                subtitle="Your intelligent assistant for task optimization"
                page="tasks"
                enableAI={true}
                onRecommendationComplete={(id) => {
                  console.log('Recommendation completed:', id);
                }}
                className="h-full"
              />
            </div>
          </div>
          
          {/* Enhanced Stats Cards */}
          <div className="flex">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
              {/* Total Tasks */}
              <Card className="p-3 h-18">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Total</p>
                    <p className="text-base font-bold text-gray-900">
                      {Object.values(stats).reduce((sum, count) => sum + (count || 0), 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                </div>
              </Card>

              {/* Completed Tasks */}
              <Card className="p-3 h-18">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Done</p>
                    <p className="text-base font-bold text-green-600">{stats.COMPLETED || 0}</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  </div>
                </div>
              </Card>

              {/* In Progress */}
              <Card className="p-3 h-18">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Active</p>
                    <p className="text-base font-bold text-blue-600">{stats.IN_PROGRESS || 0}</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Play className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                </div>
              </Card>

              {/* Overdue Tasks */}
              <Card className="p-3 h-18">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Due</p>
                    <p className="text-base font-bold text-red-600">{stats.OVERDUE || 0}</p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  </div>
                </div>
              </Card>

              {/* Pending Tasks */}
              <Card className="p-3 h-18">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Pending</p>
                    <p className="text-base font-bold text-gray-600">{stats.PENDING || 0}</p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                </div>
              </Card>

              {/* Completion Rate */}
              <Card className="p-3 h-18">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Rate</p>
                    <p className="text-base font-bold text-green-600">
                      {Object.values(stats).reduce((sum, count) => sum + (count || 0), 0) > 0 
                        ? Math.round(((stats.COMPLETED || 0) / Object.values(stats).reduce((sum, count) => sum + (count || 0), 0)) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>


        {/* Content */}
        {viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 overflow-x-auto">
            <KanbanColumn 
              status="PENDING" 
              title="Pending" 
              tasks={groupedTasks.PENDING} 
              count={groupedTasks.PENDING.length} 
            />
            <KanbanColumn 
              status="IN_PROGRESS" 
              title="In Progress" 
              tasks={groupedTasks.IN_PROGRESS} 
              count={groupedTasks.IN_PROGRESS.length} 
            />
            <KanbanColumn 
              status="COMPLETED" 
              title="Completed" 
              tasks={groupedTasks.COMPLETED} 
              count={groupedTasks.COMPLETED.length} 
            />
            <KanbanColumn 
              status="CANCELLED" 
              title="Cancelled" 
              tasks={groupedTasks.CANCELLED} 
              count={groupedTasks.CANCELLED.length} 
            />
            <KanbanColumn 
              status="OVERDUE" 
              title="Overdue" 
              tasks={groupedTasks.OVERDUE} 
              count={groupedTasks.OVERDUE.length} 
            />
          </div>
        ) : viewMode === 'calendar' ? (
          <TaskCalendar
            tasks={filteredTasks}
            onTaskClick={handleViewTask}
            onDateClick={(date) => {
              // Optional: Handle date clicks (e.g., create new task for that date)
              console.log('Date clicked:', date);
            }}
          />
        ) : (
          <Card className="p-0">
            {/* Search and Filter Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                <div className="flex-1 w-full sm:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search tasks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMoreFilters(!showMoreFilters)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    More Filters
                  </Button>
                  
                  {showMoreFilters && (
                    <div className="flex gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="OVERDUE">Overdue</option>
                      </select>
                      
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="all">All Priority</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                      
                      <select
                        value={assignedToFilter}
                        onChange={(e) => setAssignedToFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="all">All Assignees</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      
                      <select
                        value={recurringFilter}
                        onChange={(e) => setRecurringFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="all">All Tasks</option>
                        <option value="recurring">Recurring Only</option>
                        <option value="non-recurring">Non-Recurring Only</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedTasks.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkComplete}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTasks([])}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="w-12 py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedTasks.length === paginatedTasks.length && paginatedTasks.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Task</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Priority</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Assignee</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTasks.map(task => (
                    <tr 
                      key={task.id} 
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedTasks.includes(task.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => handleViewTask(task)}
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => handleSelectTask(task.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(task.status)}
                          <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div className="flex flex-col gap-1">
                            {task.assignees.length > 0 ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-gray-900">
                                    {task.assignees.length > 1 
                                      ? `${task.assignees[0].user.name} +${task.assignees.length - 1} more`
                                      : task.assignees[0].user.name
                                    }
                                  </span>
                                  {task.assignmentType === 'COLLABORATIVE' && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                      Team
                                    </span>
                                  )}
                                </div>
                                {task.assignees.length > 1 && (
                                  <div className="text-xs text-gray-500">
                                    {task.assignees.map(a => a.user.name).join(', ')}
                                  </div>
                                )}
                              </>
                            ) : task.assignee ? (
                              <span className="text-sm text-gray-900">{task.assignee.name}</span>
                            ) : (
                              <span className="text-sm text-gray-500">Unassigned</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {task.dueDate ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No due date</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu
                            trigger={
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                          items={[
                            {
                              label: "View Details",
                              icon: <Eye className="mr-2 h-4 w-4" />,
                              onClick: () => handleViewTask(task)
                            },
                            {
                              label: "Edit Task",
                              icon: <Edit className="mr-2 h-4 w-4" />,
                              onClick: () => handleEditTask(task)
                            },
                            ...(task.status !== 'COMPLETED' ? [{
                              label: "Complete Task",
                              icon: <CheckCircle className="mr-2 h-4 w-4" />,
                              onClick: () => handleCompleteTask(task),
                              className: "text-green-600"
                            }] : []),
                            {
                              label: "Duplicate",
                              icon: <Copy className="mr-2 h-4 w-4" />,
                              onClick: () => handleDuplicateTask(task)
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 className="mr-2 h-4 w-4" />,
                              onClick: () => handleDeleteTask(task),
                              className: "text-red-600"
                            }
                          ]}
                          align="right"
                        />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTasks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredTasks.length)} of {filteredTasks.length} tasks
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      setSelectedTasks([]);
                    }}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => {
                          setCurrentPage(page);
                          setSelectedTasks([]);
                        }}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === page
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      setSelectedTasks([]);
                    }}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Create Task Modal */}
        <SimpleCreateTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onTaskCreated={loadTasks}
        />

        {/* Edit Task Modal */}
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={loadTasks}
          task={selectedTask}
        />

        {/* Task Slideout */}
        <TaskSlideout
          isOpen={isSlideoutOpen}
          onClose={() => {
            setIsSlideoutOpen(false);
            // Delay setting task to null to allow exit animation
            setTimeout(() => setSelectedTask(null), 1000);
          }}
          task={selectedTask}
        />
      </div>
    </>
  );
}

// Main export with Suspense boundary
export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 ml-3">Loading tasks...</p>
        </div>
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}
