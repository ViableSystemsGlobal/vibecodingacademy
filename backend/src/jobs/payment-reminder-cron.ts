import cron from 'node-cron';
import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';
import { paymentReminderService } from '../services/payment-reminder.service';
import { subDays } from 'date-fns';

export function startPaymentReminderCron() {
  // Run every 6 hours (4 times per day)
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('[Payment Reminder Cron] Starting payment reminder check...');
      const now = new Date();

      // Get pending payments
      const pendingPayments = await prisma.registration.findMany({
        where: {
          paymentStatus: PaymentStatus.PENDING,
          class: {
            type: 'BOOTCAMP',
          },
        },
        include: {
          class: true,
          student: {
            include: {
              parent: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let remindersSent = 0;
      let remindersSkipped = 0;

      for (const registration of pendingPayments) {
        const registrationDate = new Date(registration.createdAt);
        const daysSinceRegistration = Math.floor(
          (now.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine which reminder to send based on days since registration
        // 1 day, 3 days, 7 days, 14 days, 30 days
        const reminderDays = [1, 3, 7, 14, 30];
        let shouldSendReminder = false;
        let reminderDay = 0;

        for (const day of reminderDays) {
          // Check if registration is exactly at this reminder day (within 6 hours window)
          // Since cron runs every 6 hours, we check if we're at the day mark ± 3 hours
          const targetTime = registrationDate.getTime() + day * 24 * 60 * 60 * 1000;
          const hoursDiff = Math.abs(now.getTime() - targetTime) / (1000 * 60 * 60);

          if (daysSinceRegistration === day && hoursDiff <= 6) {
            shouldSendReminder = true;
            reminderDay = day;
            break;
          }
        }

        if (!shouldSendReminder) {
          continue;
        }

        // Check if a payment reminder was already sent for this registration recently
        // We check by email and template key, and also check if it was sent for this specific day
        const email = registration.student.parent.user.email;
        const existingReminder = await prisma.notificationLog.findFirst({
          where: {
            type: 'EMAIL',
            toAddress: email,
            templateKey: 'payment_reminder',
            status: 'SUCCESS',
            sentAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
            },
          },
        });

        // Also check if we've sent a reminder for this specific registration in the last 7 days
        // by checking notification logs with similar timing
        if (existingReminder) {
          // Check if the reminder was for a different day (allow multiple reminders at different intervals)
          const reminderPayload = existingReminder.payloadJson as any;
          if (reminderPayload?.reminderDay === reminderDay) {
            remindersSkipped++;
            continue;
          }
        }

        if (existingReminder) {
          remindersSkipped++;
          continue;
        }

        // Send reminder
        try {
          await paymentReminderService.sendReminder(registration.id);

          // Log the reminder with registration ID in payload
          await prisma.notificationLog.create({
            data: {
              type: 'EMAIL',
              toAddress: email,
              templateKey: 'payment_reminder',
              status: 'SUCCESS',
              sentAt: new Date(),
              payloadJson: {
                registrationId: registration.id,
                reminderDay: reminderDay,
                daysSinceRegistration: daysSinceRegistration,
              },
            },
          });

          remindersSent++;
          console.log(
            `[Payment Reminder Cron] Sent reminder for registration ${registration.id} (${daysSinceRegistration} days old)`
          );
        } catch (error: any) {
          console.error(
            `[Payment Reminder Cron] Error sending reminder for registration ${registration.id}:`,
            error.message
          );

          // Log the failure
          await prisma.notificationLog.create({
            data: {
              type: 'EMAIL',
              toAddress: email,
              templateKey: 'payment_reminder',
              status: 'FAILED',
              errorMessage: error.message || 'Unknown error',
              payloadJson: {
                registrationId: registration.id,
                reminderDay: reminderDay,
                daysSinceRegistration: daysSinceRegistration,
              },
            },
          });
        }
      }

      console.log(
        `[Payment Reminder Cron] Completed: ${remindersSent} reminders sent, ${remindersSkipped} skipped (already sent recently)`
      );
    } catch (error) {
      console.error('[Payment Reminder Cron] Error in payment reminder cron job:', error);
    }
  });
}

