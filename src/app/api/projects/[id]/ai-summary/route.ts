import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Fetch project with full context for comprehensive AI summary
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            stageId: true,
            dueDate: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            stage: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        incidents: true,
        resourceRequests: true,
        members: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        stages: {
          select: {
            id: true,
            name: true,
            stageType: true,
            _count: {
              select: {
                tasks: true,
                incidents: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            incidents: true,
            resourceRequests: true,
            members: true,
            stages: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = project as any;
    const stageNameById = new Map<string, string>();
    (projectData.stages || []).forEach((stage: any) => {
      if (stage?.id) {
        stageNameById.set(stage.id, stage.name || "");
      }
    });

    // Calculate accurate statistics - exclude CANCELLED tasks from active count
    // A task is considered completed if: status is COMPLETED OR it's in a stage named "Done" (case-insensitive)
    const allTasks = (projectData.tasks || []) as Array<{ 
      id: string; 
      status: string; 
      stageId: string | null;
      stage: { id: string; name: string } | null;
      dueDate: Date | null; 
      priority: string; 
      createdAt: Date; 
      updatedAt: Date 
    }>;
    const activeTasks = allTasks.filter((t) => t.status !== "CANCELLED");
    const totalTasks = activeTasks.length;
    // Check both status and stage name for completion
    const completedTasks = activeTasks.filter((t) => {
      const isStatusCompleted = t.status === "COMPLETED";
      const isInDoneStage = t.stage?.name?.toLowerCase().includes("done") || false;
      return isStatusCompleted || isInDoneStage;
    }).length;
    const inProgressTasks = activeTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pendingTasks = activeTasks.filter((t) => t.status === "PENDING").length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const allIncidents = (projectData.incidents || []) as Array<{ 
      id: string; 
      status: string; 
      severity: string; 
      createdAt: Date; 
      resolvedAt: Date | null;
      stageId: string | null;
    }>;
    const isResolvedIncidentStage = (stageId?: string | null) => {
      if (!stageId) return false;
      const name = stageNameById.get(stageId);
      return name ? /resolved|closing|closed|done/i.test(name) : false;
    };
    const closedIncidentStatuses = ["RESOLVED", "CLOSED", "ARCHIVED"];
    const openIncidents = allIncidents.filter(
      (i) => !closedIncidentStatuses.includes(i.status) && !isResolvedIncidentStage(i.stageId)
    ).length;
    const urgentIncidents = allIncidents.filter(
      (i) =>
        !closedIncidentStatuses.includes(i.status) &&
        !isResolvedIncidentStage(i.stageId) &&
        (i.severity === "CRITICAL" || i.severity === "HIGH")
    ).length;

    const allResourceRequests = (projectData.resourceRequests || []) as Array<{ 
      id: string; 
      status: string; 
      priority: string; 
      createdAt: Date;
      stageId: string | null;
    }>;
    const isFulfilledStage = (stageId?: string | null) => {
      if (!stageId) return false;
      const name = stageNameById.get(stageId);
      return name ? /fulfill|fulfilled|closed|complete|done|delivered/i.test(name) : false;
    };
    const pendingResourceRequests = allResourceRequests.filter(
      (r) =>
        !isFulfilledStage(r.stageId) &&
        (r.status === "DRAFT" || r.status === "SUBMITTED" || r.status === "PENDING")
    ).length;
    const urgentResourceRequests = allResourceRequests.filter(
      (r) =>
        !isFulfilledStage(r.stageId) &&
        (r.status === "DRAFT" || r.status === "SUBMITTED" || r.status === "PENDING") &&
        r.priority === "URGENT"
    ).length;
    
    // Calculate overdue tasks - check both OVERDUE status and dueDate
    const now = new Date();
    const overdueTasks = activeTasks.filter((t) => {
      // If task is completed (by status or stage), it's not overdue
      const isStatusCompleted = t.status === "COMPLETED";
      const isInDoneStage = t.stage?.name?.toLowerCase().includes("done") || false;
      if (isStatusCompleted || isInDoneStage) return false;
      
      // If task has OVERDUE status, it's overdue
      if (t.status === "OVERDUE") return true;
      // If task has a dueDate and it's past, it's overdue (unless completed)
      if (t.dueDate) {
        return new Date(t.dueDate) < now;
      }
      return false;
    }).length;

    // Calculate project score (0-100) - define function first
    const calculateProjectScore = (data: {
      taskCompletionRate: number;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      openIncidents: number;
      urgentIncidents: number;
      pendingResourceRequests: number;
      urgentResourceRequests: number;
      teamSize: number;
      dueDate: Date | null;
    }): number => {
      let score = 100;

      // Deduct points for incomplete tasks (weighted by completion rate)
      const incompleteRate = 100 - data.taskCompletionRate;
      score -= incompleteRate * 0.3; // Max -30 points

      // Deduct points for overdue tasks (more severe)
      if (data.totalTasks > 0) {
        const overdueRate = (data.overdueTasks / data.totalTasks) * 100;
        score -= overdueRate * 0.5; // Max -50 points
      }

      // Deduct points for open incidents
      score -= data.openIncidents * 5; // -5 per incident
      score -= data.urgentIncidents * 10; // -10 per urgent incident

      // Deduct points for pending resource requests
      score -= data.pendingResourceRequests * 2; // -2 per pending request
      score -= data.urgentResourceRequests * 5; // -5 per urgent request

      // Deduct points if deadline is approaching or passed
      if (data.dueDate) {
        const now = new Date();
        const due = new Date(data.dueDate);
        const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue < 0) {
          score -= 20; // Deadline passed
        } else if (daysUntilDue <= 7) {
          score -= 10; // Deadline within a week
        } else if (daysUntilDue <= 30) {
          score -= 5; // Deadline within a month
        }
      }

      // Bonus points for good completion rate
      if (data.taskCompletionRate >= 80) {
        score += 5;
      }
      if (data.taskCompletionRate >= 90) {
        score += 5;
      }

      // Ensure score is between 0 and 100
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    const projectScore = calculateProjectScore({
      taskCompletionRate,
      totalTasks,
      completedTasks,
      overdueTasks,
      openIncidents,
      urgentIncidents,
      pendingResourceRequests,
      urgentResourceRequests,
      teamSize: projectData._count?.members || 0,
      dueDate: projectData.dueDate,
    });

    // Generate brief written summary with full context
    const summary = generateProjectSummary({
      projectName: projectData.name,
      projectCode: projectData.code,
      projectStatus: projectData.status,
      projectDescription: projectData.description,
      projectScope: projectData.scope || null,
      taskCompletionRate,
      totalTasks,
      completedTasks,
      openIncidents,
      urgentIncidents,
      pendingResourceRequests,
      urgentResourceRequests,
      overdueTasks,
      teamSize: projectData._count?.members || 0,
      ownerName: projectData.owner?.name || null,
      startDate: projectData.startDate,
      dueDate: projectData.dueDate,
      budget: projectData.budget,
      budgetCurrency: projectData.budgetCurrency,
    });

    return NextResponse.json({ summary, score: projectScore });
  } catch (error) {
    console.error("[AI-SUMMARY] Error generating summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

function generateProjectSummary(data: {
  projectName: string;
  projectCode: string | null;
  projectStatus: string;
  projectDescription: string | null;
  projectScope: string | null;
  taskCompletionRate: number;
  totalTasks: number;
  completedTasks: number;
  openIncidents: number;
  urgentIncidents: number;
  pendingResourceRequests: number;
  urgentResourceRequests: number;
  overdueTasks: number;
  teamSize: number;
  ownerName: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  budget: number | null;
  budgetCurrency: string | null;
}): string {
  const { 
    projectName,
    projectCode,
    projectStatus,
    projectDescription,
    projectScope,
    taskCompletionRate, 
    totalTasks,
    completedTasks,
    openIncidents,
    urgentIncidents,
    pendingResourceRequests,
    urgentResourceRequests,
    overdueTasks,
    teamSize,
    ownerName,
    startDate,
    dueDate,
    budget,
    budgetCurrency
  } = data;

  let summary = `${projectName}${projectCode ? ` (${projectCode})` : ''} is currently ${projectStatus.toLowerCase()}. `;
  
  // Add project context if available
  if (projectDescription) {
    summary += `The project focuses on ${projectDescription.substring(0, 100)}${projectDescription.length > 100 ? '...' : ''}. `;
  }
  
  if (projectScope) {
    summary += `Scope: ${projectScope.substring(0, 150)}${projectScope.length > 150 ? '...' : ''}. `;
  }
  
  if (ownerName) {
    summary += `Project owner: ${ownerName}. `;
  }
  
  if (startDate) {
    const daysSinceStart = Math.floor((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    summary += `Project started ${daysSinceStart} day${daysSinceStart !== 1 ? 's' : ''} ago. `;
  }
  
  if (budget && budgetCurrency) {
    summary += `Budget: ${budgetCurrency} ${budget.toLocaleString()}. `;
  }

  // Task status
  if (totalTasks > 0) {
    summary += `Task completion is at ${taskCompletionRate}% (${completedTasks} of ${totalTasks} tasks completed). `;
    if (overdueTasks > 0) {
      summary += `${overdueTasks} task${overdueTasks > 1 ? 's are' : ' is'} overdue and requires attention. `;
    }
  } else {
    summary += `No tasks have been created yet. `;
  }

  // Incident status
  if (openIncidents > 0) {
    summary += `There ${openIncidents === 1 ? 'is' : 'are'} ${openIncidents} open incident${openIncidents > 1 ? 's' : ''}`;
    if (urgentIncidents > 0) {
      summary += `, with ${urgentIncidents} marked as urgent`;
    }
    summary += `. `;
  } else {
    summary += `No open incidents. `;
  }

  // Resource requests
  if (pendingResourceRequests > 0) {
    summary += `${pendingResourceRequests} resource request${pendingResourceRequests > 1 ? 's are' : ' is'} pending`;
    if (urgentResourceRequests > 0) {
      summary += `, including ${urgentResourceRequests} urgent request${urgentResourceRequests > 1 ? 's' : ''}`;
    }
    summary += `. `;
  }

  // Team
  if (teamSize > 0) {
    summary += `The project team consists of ${teamSize} member${teamSize > 1 ? 's' : ''}. `;
  }

  // Timeline
  if (dueDate) {
    const daysUntilDue = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue > 0) {
      summary += `Project deadline is in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}. `;
    } else if (daysUntilDue === 0) {
      summary += `Project deadline is today! `;
    } else {
      summary += `Project deadline has passed (${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) > 1 ? 's' : ''} ago). `;
    }
  }

  // Overall assessment
  if (taskCompletionRate >= 80 && openIncidents === 0 && overdueTasks === 0) {
    summary += `Overall, the project is progressing well with strong completion rates and no critical issues.`;
  } else if (taskCompletionRate >= 50 && overdueTasks < 3) {
    summary += `The project is making steady progress, though some attention may be needed on overdue tasks.`;
  } else {
    summary += `The project requires immediate attention due to low completion rates, overdue tasks, or critical incidents.`;
  }

  return summary;
}

