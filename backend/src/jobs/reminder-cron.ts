import cron from 'node-cron';
import prisma from '../config/database';
import { notificationService } from '../services/notification.service';
import { addHours, isWithinInterval } from 'date-fns';

export function startReminderCron() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      const oneHourFromNow = addHours(now, 1);
      const twentyFourHoursFromNow = addHours(now, 24);

      // Find classes starting within 24 hours
      const upcomingClasses = await prisma.class.findMany({
        where: {
          status: 'PUBLISHED',
          startDatetime: {
            gte: now,
            lte: twentyFourHoursFromNow,
          },
        },
        include: {
          registrations: {
            include: {
              student: {
                include: {
                  parent: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const classItem of upcomingClasses) {
        const classStartTime = new Date(classItem.startDatetime);
        const isWithin24h = isWithinInterval(classStartTime, {
          start: now,
          end: twentyFourHoursFromNow,
        });
        const isWithin1h = isWithinInterval(classStartTime, {
          start: now,
          end: oneHourFromNow,
        });

        for (const registration of classItem.registrations) {
          const email = registration.student.parent.user.email;
          const templateKey24h = 'class_reminder_24h';
          const templateKey1h = 'class_reminder_1h';

          // Send 24h reminder if not already sent
          if (isWithin24h && !isWithin1h) {
            // Check if 24h reminder was already sent by checking notification logs
            const existingReminder = await prisma.notificationLog.findFirst({
              where: {
                type: 'EMAIL',
                toAddress: email,
                templateKey: templateKey24h,
                status: 'SUCCESS',
                sentAt: {
                  gte: new Date(Date.now() - 12 * 60 * 60 * 1000), // Within last 12 hours
                },
              },
            });

            if (!existingReminder) {
              await notificationService.sendClassReminder(
                email,
                registration.student.parent.user.name,
                registration.student.name,
                classItem.title,
                classItem.startDatetime,
                classItem.meetingLink || undefined,
                '24h'
              );
            }
          }

          // Send 1h reminder if not already sent
          if (isWithin1h) {
            // Check if 1h reminder was already sent by checking notification logs
            const existingReminder = await prisma.notificationLog.findFirst({
              where: {
                type: 'EMAIL',
                toAddress: email,
                templateKey: templateKey1h,
                status: 'SUCCESS',
                sentAt: {
                  gte: new Date(Date.now() - 30 * 60 * 1000), // Within last 30 minutes
                },
              },
            });

            if (!existingReminder) {
              await notificationService.sendClassReminder(
                email,
                registration.student.parent.user.name,
                registration.student.name,
                classItem.title,
                classItem.startDatetime,
                classItem.meetingLink || undefined,
                '1h'
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in reminder cron job:', error);
    }
  });
}

