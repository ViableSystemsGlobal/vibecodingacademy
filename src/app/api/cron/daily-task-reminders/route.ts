import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmailViaSMTP, sendSmsViaDeywuro, getCompanyName } from '@/lib/payment-order-notifications';

// POST /api/cron/daily-task-reminders - Cron job endpoint for daily task reminders
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron service
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('📋 Daily Task Reminders Cron: Processing reminders...');
    
    // Check if daily task reminders are enabled
    const remindersEnabled = await prisma.systemSettings.findUnique({
      where: { key: 'daily_task_reminders_enabled' },
      select: { value: true }
    });

    if (remindersEnabled?.value !== 'true') {
      console.log('📋 Daily Task Reminders Cron: Reminders are disabled');
      return NextResponse.json({ 
        message: "Daily task reminders are disabled",
        timestamp: new Date().toISOString()
      });
    }

    // Get all users who have tasks assigned
    // Find tasks that are not completed (PENDING or IN_PROGRESS)
    const tasks = await (prisma as any).task.findMany({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS'] // Not completed
        },
        OR: [
          { assignedTo: { not: null } }, // Has direct assignee
          { assignees: { some: {} } } // Has assignees in array
        ]
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`📋 Found ${tasks.length} incomplete tasks`);

    if (tasks.length === 0) {
      return NextResponse.json({ 
        message: "No incomplete tasks found",
        timestamp: new Date().toISOString(),
        count: 0
      });
    }

    // Group tasks by assigned user
    const tasksByUser = new Map<string, {
      user: { id: string; name: string; email: string; phone: string | null };
      tasks: any[];
    }>();

    for (const task of tasks) {
      // Handle direct assignee (legacy)
      if (task.assignedTo && task.assignee) {
        const userId = task.assignee.id;
        if (!tasksByUser.has(userId)) {
          tasksByUser.set(userId, {
            user: {
              id: task.assignee.id,
              name: task.assignee.name,
              email: task.assignee.email,
              phone: task.assignee.phone
            },
            tasks: []
          });
        }
        tasksByUser.get(userId)!.tasks.push(task);
      }

      // Handle multiple assignees (new system)
      if (task.assignees && task.assignees.length > 0) {
        for (const assignee of task.assignees) {
          const userId = assignee.user.id;
          if (!tasksByUser.has(userId)) {
            tasksByUser.set(userId, {
              user: {
                id: assignee.user.id,
                name: assignee.user.name,
                email: assignee.user.email,
                phone: assignee.user.phone
              },
              tasks: []
            });
          }
          // Only add task once per user (avoid duplicates if user is both direct assignee and in assignees array)
          const userTasks = tasksByUser.get(userId)!.tasks;
          if (!userTasks.find((t: any) => t.id === task.id)) {
            userTasks.push(task);
          }
        }
      }
    }

    console.log(`📋 Found ${tasksByUser.size} users with incomplete tasks`);

    const companyName = await getCompanyName();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Send reminder to each user
    for (const [userId, userData] of tasksByUser) {
      try {
        const { user, tasks: userTasks } = userData;

        if (!user.email && !user.phone) {
          console.log(`⚠️ Skipping user ${user.name}: No email or phone`);
          continue;
        }

        // Categorize tasks
        const overdueTasks = userTasks.filter((t: any) => 
          t.dueDate && new Date(t.dueDate) < new Date()
        );
        const dueTodayTasks = userTasks.filter((t: any) => {
          if (!t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          const today = new Date();
          return dueDate.toDateString() === today.toDateString();
        });
        const upcomingTasks = userTasks.filter((t: any) => {
          if (!t.dueDate) return true; // Tasks without due dates are considered upcoming
          const dueDate = new Date(t.dueDate);
          const today = new Date();
          return dueDate > today;
        });

        // Build task list for email
        let taskListHtml = '';
        let taskListText = '';

        if (overdueTasks.length > 0) {
          taskListHtml += '<h3 style="color: #dc2626; margin-top: 20px;">🚨 Overdue Tasks</h3><ul>';
          taskListText += '\n\n🚨 OVERDUE TASKS:\n';
          overdueTasks.forEach((t: any) => {
            const dueDate = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date';
            const daysOverdue = t.dueDate ? Math.floor((new Date().getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            taskListHtml += `<li><strong>${t.title}</strong> - Due: ${dueDate} (${daysOverdue} days overdue) - Priority: ${t.priority}</li>`;
            taskListText += `- ${t.title} - Due: ${dueDate} (${daysOverdue} days overdue) - Priority: ${t.priority}\n`;
          });
          taskListHtml += '</ul>';
        }

        if (dueTodayTasks.length > 0) {
          taskListHtml += '<h3 style="color: #f59e0b; margin-top: 20px;">⏰ Due Today</h3><ul>';
          taskListText += '\n\n⏰ DUE TODAY:\n';
          dueTodayTasks.forEach((t: any) => {
            taskListHtml += `<li><strong>${t.title}</strong> - Priority: ${t.priority}</li>`;
            taskListText += `- ${t.title} - Priority: ${t.priority}\n`;
          });
          taskListHtml += '</ul>';
        }

        if (upcomingTasks.length > 0) {
          taskListHtml += '<h3 style="color: #3b82f6; margin-top: 20px;">📅 Upcoming Tasks</h3><ul>';
          taskListText += '\n\n📅 UPCOMING TASKS:\n';
          upcomingTasks.forEach((t: any) => {
            const dueDate = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date';
            taskListHtml += `<li><strong>${t.title}</strong> - Due: ${dueDate} - Priority: ${t.priority}</li>`;
            taskListText += `- ${t.title} - Due: ${dueDate} - Priority: ${t.priority}\n`;
          });
          taskListHtml += '</ul>';
        }

        // Prepare email and SMS messages
        const emailSubject = `Daily Task Reminder - ${userTasks.length} Incomplete Task${userTasks.length > 1 ? 's' : ''}`;
        const emailMessage = `Dear ${user.name},

This is your daily reminder of tasks that are assigned to you and have not been completed.

You have ${userTasks.length} incomplete task${userTasks.length > 1 ? 's' : ''}:
${overdueTasks.length > 0 ? `- ${overdueTasks.length} overdue` : ''}${dueTodayTasks.length > 0 ? `- ${dueTodayTasks.length} due today` : ''}${upcomingTasks.length > 0 ? `- ${upcomingTasks.length} upcoming` : ''}

${taskListText}

Please review and complete these tasks at your earliest convenience. If you have any questions or need assistance, please don't hesitate to reach out.

Best regards,
${companyName || 'AdPools Group'}`;

        const emailMessageHtml = `<p>Dear ${user.name},</p>

<p>This is your daily reminder of tasks that are assigned to you and have not been completed.</p>

<p>You have <strong>${userTasks.length}</strong> incomplete task${userTasks.length > 1 ? 's' : ''}:</p>
<ul>
${overdueTasks.length > 0 ? `<li>${overdueTasks.length} overdue</li>` : ''}
${dueTodayTasks.length > 0 ? `<li>${dueTodayTasks.length} due today</li>` : ''}
${upcomingTasks.length > 0 ? `<li>${upcomingTasks.length} upcoming</li>` : ''}
</ul>

${taskListHtml}

<p>Please review and complete these tasks at your earliest convenience. If you have any questions or need assistance, please don't hesitate to reach out.</p>

<p>Best regards,<br>
${companyName || 'AdPools Group'}</p>`;

        const smsMessage = `Hi ${user.name}, you have ${userTasks.length} incomplete task${userTasks.length > 1 ? 's' : ''}${overdueTasks.length > 0 ? ` (${overdueTasks.length} overdue)` : ''}. Please check your tasks. ${companyName || 'AdPools Group'}`;

        // Send notifications
        const results = await Promise.allSettled([
          user.email ? sendEmailViaSMTP(user.email, emailSubject, emailMessageHtml) : Promise.resolve({ success: false, error: 'No email' }),
          user.phone ? sendSmsViaDeywuro(user.phone, smsMessage) : Promise.resolve({ success: false, error: 'No phone' })
        ]);

        const emailResult = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Email failed' };
        const smsResult = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'SMS failed' };

        if (emailResult.success || smsResult.success) {
          successCount++;
          console.log(`✅ Daily reminder sent to ${user.name} (${userTasks.length} tasks)`);
        } else {
          errorCount++;
          const errorMsg = `Failed to send reminder to ${user.name}: ${emailResult.error || smsResult.error}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing user ${userData.user.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return NextResponse.json({ 
      message: `Daily task reminders processed: ${successCount} sent, ${errorCount} failed`,
      timestamp: new Date().toISOString(),
      successCount,
      errorCount,
      totalUsers: tasksByUser.size,
      totalTasks: tasks.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Daily Task Reminders Cron Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to process daily task reminders",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/daily-task-reminders - Health check endpoint
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ 
      message: "Daily Task Reminders Cron endpoint is active",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Daily Task Reminders Cron health check error:', error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}

