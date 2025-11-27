import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskNotificationService } from '@/lib/task-notifications';

// Function to update overdue tasks
async function updateOverdueTasks() {
  try {
    const now = new Date();
    
    // Find tasks that are due and not completed/cancelled/overdue
    const overdueTasks = await (prisma as any).task.findMany({
      where: {
        dueDate: {
          lt: now, // Less than current time
        },
        status: {
          notIn: ['COMPLETED', 'CANCELLED', 'OVERDUE'], // Not already completed, cancelled, or overdue
        },
      },
    });

    // Update each overdue task
    if (overdueTasks.length > 0) {
      await (prisma as any).task.updateMany({
        where: {
          id: {
            in: overdueTasks.map((task: any) => task.id),
          },
        },
        data: {
          status: 'OVERDUE',
          updatedAt: now,
        },
      });

      // Also update individual assignee statuses for collaborative tasks
      for (const task of overdueTasks) {
        if (task.assignmentType === 'COLLABORATIVE') {
          await (prisma as any).taskAssignee.updateMany({
            where: {
              taskId: task.id,
              status: {
                notIn: ['COMPLETED', 'CANCELLED'],
              },
            },
            data: {
              status: 'OVERDUE',
              updatedAt: now,
            },
          });
        }
      }

      console.log(`Updated ${overdueTasks.length} tasks to OVERDUE status`);
    }
  } catch (error) {
    console.error('Error updating overdue tasks:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const recurring = searchParams.get('recurring');
    const leadId = searchParams.get('leadId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: any = {};

    // Filter by assignee
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Filter by status
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      where.priority = priority;
    }

    // Filter by recurring
    if (recurring && recurring !== 'all') {
      if (recurring === 'recurring') {
        where.recurringTaskId = { not: null };
      } else if (recurring === 'non-recurring') {
        where.recurringTaskId = null;
      }
    }

    // Filter by leadId
    if (leadId) {
      where.leadId = leadId;
    }

    // First, update any overdue tasks
    await updateOverdueTasks();

    // Get tasks with related data
    const tasks = await (prisma as any).task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recurringTask: true,
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            priority: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        dependencies: {
          include: {
            dependsOnTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
              },
            },
          },
        },
        dependentTasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // High priority first
        { dueDate: 'asc' },   // Then by due date
        { createdAt: 'desc' }, // Then by creation date
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get total count for pagination
    const total = await (prisma as any).task.count({ where });

    // Get task statistics
    const stats = await (prisma as any).task.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const statusStats = stats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: statusStats,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      priority = 'MEDIUM',
      dueDate,
      assignedTo, // Legacy field
      assignees = [], // New multiple assignees
      assignmentType = 'INDIVIDUAL',
      recurringTaskId,
      templateId,
      leadId, // For lead-related tasks
      projectId, // For project-related tasks
      stageId, // For project stage assignment
      status = 'PENDING',
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (assignees.length === 0 && !assignedTo) {
      return NextResponse.json(
        { error: 'At least one assignee is required' },
        { status: 400 }
      );
    }

    // Use new assignees array or fall back to legacy assignedTo
    const finalAssignees = assignees.length > 0 ? assignees : [assignedTo];

    // Create the task with multiple assignees
    const task = await (prisma as any).task.create({
      data: {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignmentType,
        assignedTo: finalAssignees[0], // Keep legacy field for backward compatibility
        createdBy: session.user.id,
        recurringTaskId,
        templateId,
        leadId: leadId || null,
        projectId: projectId || null,
        stageId: stageId || null,
        status: status as any,
        assignees: {
          create: finalAssignees.map((userId: string) => ({
            userId,
            status: 'PENDING',
          })),
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recurringTask: true,
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            priority: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Send assignment notifications to all assignees
    try {
      for (const assigneeData of task.assignees) {
        if (assigneeData.user) {
          await TaskNotificationService.sendTaskAssignedNotification({
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description,
            taskPriority: task.priority,
            taskDueDate: task.dueDate?.toISOString(),
            assignedBy: {
              id: task.creator.id,
              name: task.creator.name || 'System',
              email: task.creator.email
            },
            assignedTo: {
              id: assigneeData.user.id,
              name: assigneeData.user.name || 'User',
              email: assigneeData.user.email,
              phone: assigneeData.user.phone
            }
          });
        }
      }
    } catch (notificationError) {
      console.error('Error sending task assignment notifications:', notificationError);
      // Don't fail the task creation if notifications fail
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
