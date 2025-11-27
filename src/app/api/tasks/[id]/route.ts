import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskNotificationService } from '@/lib/task-notifications';
import { StakeholderNotificationService } from '@/lib/stakeholder-notifications';

// Function to check and update overdue status for a single task
async function checkAndUpdateOverdueStatus(taskId: string) {
  try {
    const now = new Date();
    
    const task = await (prisma as any).task.findUnique({
      where: { id: taskId },
    });

    if (!task) return null;

    // Check if task is overdue
    if (task.dueDate && 
        new Date(task.dueDate) < now && 
        !['COMPLETED', 'CANCELLED', 'OVERDUE'].includes(task.status)) {
      
      // Update task status
      await (prisma as any).task.update({
        where: { id: taskId },
        data: {
          status: 'OVERDUE',
          updatedAt: now,
        },
      });

      // Update assignee statuses if collaborative
      if (task.assignmentType === 'COLLABORATIVE') {
        await (prisma as any).taskAssignee.updateMany({
          where: {
            taskId: taskId,
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

      console.log(`Updated task ${taskId} to OVERDUE status`);
    }

    return task;
  } catch (error) {
    console.error('Error checking overdue status:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;

    // Check and update overdue status first
    await checkAndUpdateOverdueStatus(resolvedParams.id);

    const task = await (prisma as any).task.findUnique({
      where: { id: resolvedParams.id },
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
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
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
                dueDate: true,
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
                dueDate: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
    } = body;

    // Check if task exists
    const existingTask = await (prisma as any).task.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        stageId: true,
        assignedTo: true,
        createdBy: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user can update this task (assignee or creator)
    if (existingTask.assignedTo !== session.user.id && existingTask.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    // If status is being changed to completed, check dependencies first
    if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      // Check if all dependencies are completed
      const dependencies = await (prisma as any).taskDependency.findMany({
        where: { taskId: resolvedParams.id },
        include: {
          dependsOnTask: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      const incompleteDependencies = dependencies.filter(
        (dep: any) => dep.dependsOnTask.status !== 'COMPLETED'
      );

      if (incompleteDependencies.length > 0) {
        return NextResponse.json({
          error: 'Cannot complete task with incomplete dependencies',
          incompleteDependencies: incompleteDependencies.map((dep: any) => ({
            id: dep.dependsOnTask.id,
            title: dep.dependsOnTask.title,
            status: dep.dependsOnTask.status,
          })),
        }, { status: 400 });
      }

      updateData.completedAt = new Date();
      
      // If task belongs to a project, find the "Done" stage and move task there
      if (existingTask.projectId) {
        // SQLite doesn't support mode: 'insensitive', so fetch all stages and filter in JavaScript
        const allStages = await prisma.projectStage.findMany({
          where: {
            projectId: existingTask.projectId,
            stageType: 'TASK',
          },
          select: { id: true, name: true },
        });
        
        const doneStage = allStages.find(
          stage => stage.name.toLowerCase().includes('done')
        );
        
        if (doneStage) {
          updateData.stageId = doneStage.id;
        }
      }
    } else if (status !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
      updateData.completedAt = null;
      
      // If task was in a "Done" stage, remove it from that stage
      if (existingTask.projectId && existingTask.stageId) {
        const currentStage = await prisma.projectStage.findUnique({
          where: { id: existingTask.stageId },
          select: { name: true },
        });
        
        if (currentStage && currentStage.name.toLowerCase().includes('done')) {
          updateData.stageId = null; // Remove from Done stage
        }
      }
    }

    // If assignee is being changed, also update the assignees relationship
    if (assignedTo !== undefined && assignedTo !== existingTask.assignedTo) {
      console.log(`Updating assignee from ${existingTask.assignedTo} to ${assignedTo}`);
      
      // First, remove all existing assignees
      await (prisma as any).taskAssignee.deleteMany({
        where: { taskId: resolvedParams.id }
      });
      console.log(`Removed existing assignees for task ${resolvedParams.id}`);

      // Then, if there's a new assignee, add them to the assignees relationship
      if (assignedTo) {
        const newAssignee = await (prisma as any).taskAssignee.create({
          data: {
            taskId: resolvedParams.id,
            userId: assignedTo,
            status: 'PENDING'
          }
        });
        console.log(`Added new assignee:`, newAssignee);
      }
    }

    const updatedTask = await (prisma as any).task.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
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
        recurringTask: true,
        dependencies: {
          include: {
            dependsOnTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                dueDate: true,
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
                dueDate: true,
              },
            },
          },
        },
      },
    });

    console.log('Updated task response:', {
      id: updatedTask.id,
      assignedTo: updatedTask.assignedTo,
      assignee: updatedTask.assignee,
      assigneesCount: updatedTask.assignees?.length || 0
    });

    // Send notifications for task updates
    try {
      // If assignee changed, send assignment notification to new assignee
      if (assignedTo !== undefined && assignedTo !== existingTask.assignedTo && updatedTask.assignee) {
        await TaskNotificationService.sendTaskAssignedNotification({
          taskId: updatedTask.id,
          taskTitle: updatedTask.title,
          taskDescription: updatedTask.description,
          taskPriority: updatedTask.priority,
          taskDueDate: updatedTask.dueDate?.toISOString(),
          assignedBy: {
            id: session.user.id,
            name: session.user.name || 'System',
            email: session.user.email || ''
          },
          assignedTo: {
            id: updatedTask.assignee.id,
            name: updatedTask.assignee.name || 'User',
            email: updatedTask.assignee.email,
            phone: updatedTask.assignee.phone
          }
        });
      }

      // If task was completed, send completion notification to creator
      if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        await TaskNotificationService.sendTaskCompletedNotification(
          updatedTask.id,
          {
            id: session.user.id,
            name: session.user.name || 'User'
          }
        );
      }

      // Send stakeholder notifications for major changes
      const hasMajorChanges = (
        (status !== undefined && status !== existingTask.status) ||
        (priority !== undefined && priority !== existingTask.priority) ||
        (assignedTo !== undefined && assignedTo !== existingTask.assignedTo) ||
        (dueDate !== undefined && dueDate !== existingTask.dueDate?.toISOString()) ||
        (description !== undefined && description !== existingTask.description)
      );

      if (hasMajorChanges) {
        // Get all stakeholders for this task
        const stakeholders = await StakeholderNotificationService.getTaskStakeholders(updatedTask.id);
        
        if (stakeholders.length > 0) {
          // Determine the type of change
          let changeType = 'STATUS_CHANGE';
          let oldValue = '';
          let newValue = '';

          if (status !== undefined && status !== existingTask.status) {
            changeType = 'STATUS_CHANGE';
            oldValue = existingTask.status;
            newValue = status;
          } else if (priority !== undefined && priority !== existingTask.priority) {
            changeType = 'PRIORITY_CHANGE';
            oldValue = existingTask.priority;
            newValue = priority;
          } else if (assignedTo !== undefined && assignedTo !== existingTask.assignedTo) {
            changeType = 'ASSIGNEE_CHANGE';
            oldValue = existingTask.assignedTo || 'Unassigned';
            newValue = assignedTo || 'Unassigned';
          } else if (dueDate !== undefined && dueDate !== existingTask.dueDate?.toISOString()) {
            changeType = 'DUE_DATE_CHANGE';
            oldValue = existingTask.dueDate ? existingTask.dueDate.toISOString() : 'No due date';
            newValue = dueDate || 'No due date';
          } else if (description !== undefined && description !== existingTask.description) {
            changeType = 'DESCRIPTION_CHANGE';
            oldValue = existingTask.description || 'No description';
            newValue = description || 'No description';
          }

          // Send stakeholder notifications
          await StakeholderNotificationService.sendTaskUpdateNotification({
            taskId: updatedTask.id,
            taskTitle: updatedTask.title,
            taskDescription: updatedTask.description,
            taskPriority: updatedTask.priority,
            taskStatus: updatedTask.status,
            taskDueDate: updatedTask.dueDate?.toISOString(),
            updatedBy: {
              id: session.user.id,
              name: session.user.name || 'System',
              email: session.user.email || ''
            },
            stakeholders,
            changeType: changeType as any,
            oldValue,
            newValue
          });
        }
      }
    } catch (notificationError) {
      console.error('Error sending task update notifications:', notificationError);
      // Don't fail the task update if notifications fail
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack ? error.stack : errorMessage;
    
    return NextResponse.json(
      { 
        error: 'Failed to update task', 
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorDetails })
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;

    // Check if task exists
    const existingTask = await (prisma as any).task.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user can delete this task (creator only)
    if (existingTask.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await (prisma as any).task.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
