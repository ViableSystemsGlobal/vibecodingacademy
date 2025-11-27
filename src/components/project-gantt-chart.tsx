"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Calendar, User, Link } from "lucide-react";

interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  startDate?: string | null;
  stageId: string | null;
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
  dependencies?: {
    id: string;
    dependsOnTaskId: string;
    dependsOnTask: {
      id: string;
      title: string;
      dueDate: string | null;
    };
  }[];
  stage?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface ProjectGanttChartProps {
  tasks: ProjectTask[];
  startDate?: Date;
  endDate?: Date;
}

export function ProjectGanttChart({
  tasks,
  startDate,
  endDate,
}: ProjectGanttChartProps) {
  // Calculate date range
  const dateRange = useMemo(() => {
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    const dates = tasks
      .map((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const startDate = task.startDate ? new Date(task.startDate) : null;
        return [dueDate, startDate].filter(Boolean) as Date[];
      })
      .flat();

    if (dates.length === 0) {
      const today = new Date();
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    return { start: minDate, end: maxDate };
  }, [tasks, startDate, endDate]);

  // Generate date columns
  const dateColumns = useMemo(() => {
    const columns: Date[] = [];
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      columns.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return columns;
  }, [dateRange]);

  // Calculate task position and width
  const getTaskPosition = (task: ProjectTask) => {
    const taskStart = task.startDate
      ? new Date(task.startDate)
      : task.dueDate
      ? new Date(new Date(task.dueDate).getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days before due date
      : new Date();
    const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(taskStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalDays = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const startOffset = Math.max(
      0,
      Math.ceil((taskStart.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const duration = Math.max(
      1,
      Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
      start: taskStart,
      end: taskEnd,
    };
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500";
      case "IN_PROGRESS":
        return "bg-blue-500";
      case "PENDING":
        return "bg-gray-400";
      case "CANCELLED":
        return "bg-red-400";
      default:
        return "bg-gray-400";
    }
  };

  // Group tasks by dependencies
  const taskGroups = useMemo(() => {
    const groups: ProjectTask[][] = [];
    const processed = new Set<string>();
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    tasks.forEach((task) => {
      if (processed.has(task.id)) return;

      const group: ProjectTask[] = [task];
      processed.add(task.id);

      // Find all related tasks (dependencies and dependents)
      const findRelated = (currentTask: ProjectTask) => {
        if (currentTask.dependencies) {
          currentTask.dependencies.forEach((dep) => {
            const depTask = taskMap.get(dep.dependsOnTaskId);
            if (depTask && !processed.has(depTask.id)) {
              group.push(depTask);
              processed.add(depTask.id);
              findRelated(depTask);
            }
          });
        }

        // Find tasks that depend on this one
        tasks.forEach((t) => {
          if (
            t.dependencies?.some((d) => d.dependsOnTaskId === currentTask.id) &&
            !processed.has(t.id)
          ) {
            group.push(t);
            processed.add(t.id);
            findRelated(t);
          }
        });
      };

      findRelated(task);
      if (group.length > 0) {
        groups.push(group);
      }
    });

    return groups;
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Date Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Gantt Chart View
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-full" style={{ minWidth: `${dateColumns.length * 40}px` }}>
              {/* Date Row */}
              <div className="flex border-b border-gray-200 mb-2">
                <div className="w-64 flex-shrink-0 p-2 font-semibold text-sm text-gray-700 border-r">
                  Task
                </div>
                <div className="flex-1 flex">
                  {dateColumns.map((date, idx) => {
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={idx}
                        className={`flex-1 min-w-[40px] p-1 text-xs text-center border-r ${
                          isWeekend ? "bg-gray-50" : "bg-white"
                        } ${isToday ? "bg-blue-50 font-semibold" : ""}`}
                      >
                        <div>{date.getDate()}</div>
                        <div className="text-gray-500">
                          {date.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Task Rows */}
              <div className="space-y-1">
                {tasks.map((task) => {
                  const position = getTaskPosition(task);
                  const hasDependencies = task.dependencies && task.dependencies.length > 0;
                  const color = task.stage?.color || getPriorityColor(task.priority) || "#6366F1";

                  return (
                    <div key={task.id} className="flex items-center border-b border-gray-100 py-2">
                      {/* Task Info */}
                      <div className="w-64 flex-shrink-0 p-2 border-r">
                        <div className="flex items-start gap-2">
                          {hasDependencies && (
                            <Link className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {task.assignees && task.assignees.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {task.assignees[0].user.name || task.assignees[0].user.email}
                                    {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                                  </span>
                                </div>
                              ) : task.assignee ? (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {task.assignee.name || task.assignee.email}
                                  </span>
                                </div>
                              ) : null}
                              {task.priority && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getPriorityColor(task.priority)} text-white border-0`}
                                >
                                  {task.priority}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gantt Bar */}
                      <div className="flex-1 relative h-12">
                        <div
                          className="absolute h-6 rounded mt-1 flex items-center justify-center text-white text-xs font-medium shadow-sm"
                          style={{
                            left: position.left,
                            width: position.width,
                            backgroundColor: color,
                            opacity: task.status === "COMPLETED" ? 0.7 : 1,
                          }}
                        >
                          {task.dueDate && (
                            <span className="truncate px-2">{task.title}</span>
                          )}
                        </div>
                        {hasDependencies && (
                          <div className="absolute top-0 left-0 w-full h-full">
                            {task.dependencies?.map((dep, idx) => {
                              const depTask = tasks.find((t) => t.id === dep.dependsOnTaskId);
                              if (!depTask) return null;
                              const depPosition = getTaskPosition(depTask);
                              return (
                                <div
                                  key={dep.id}
                                  className="absolute"
                                  style={{
                                    left: `${parseFloat(depPosition.left.replace("%", "")) + parseFloat(depPosition.width.replace("%", ""))}%`,
                                    top: "50%",
                                    width: `${Math.max(0, parseFloat(position.left.replace("%", "")) - parseFloat(depPosition.left.replace("%", "")) - parseFloat(depPosition.width.replace("%", "")))}%`,
                                    height: "2px",
                                    backgroundColor: "#94a3b8",
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span>Task Bar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500 opacity-70" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-blue-500" />
              <span>Has Dependencies</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

