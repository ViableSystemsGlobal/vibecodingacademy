import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';
import { notificationService } from './notification.service';
import { config } from '../config/env';

export class PaymentReminderService {
  /**
   * Get all registrations with pending payments
   */
  async getPendingPayments(filters?: {
    classId?: string;
    daysSinceRegistration?: number;
  }) {
    const where: any = {
      paymentStatus: PaymentStatus.PENDING,
      class: {
        type: 'BOOTCAMP', // Only bootcamps require payment
      },
    };

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.daysSinceRegistration) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.daysSinceRegistration);
      where.createdAt = {
        lte: cutoffDate,
      };
    }

    return prisma.registration.findMany({
      where,
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
        payments: {
          where: {
            status: PaymentStatus.PENDING,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Send payment reminder for a specific registration
   */
  async sendReminder(registrationId: string) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
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

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.paymentStatus !== PaymentStatus.PENDING) {
      throw new Error('Registration is not pending payment');
    }

    if (registration.class.type !== 'BOOTCAMP') {
      throw new Error('Only bootcamp registrations require payment');
    }

    // Generate payment URL (if payment attempt exists, use it; otherwise create new)
    let paymentUrl: string | undefined;
    try {
      const paymentAttempt = await prisma.paymentAttempt.findFirst({
        where: {
          parentEmail: registration.student.parent.user.email,
          classId: registration.classId,
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (paymentAttempt?.paymentUrl) {
        paymentUrl = paymentAttempt.paymentUrl;
      } else {
        // Create a payment link - in a real scenario, you'd generate a new payment attempt
        paymentUrl = `${config.frontendUrl}/register/${registration.classId}`;
      }
    } catch (error) {
      // If payment attempt lookup fails, just use the registration link
      paymentUrl = `${config.frontendUrl}/register/${registration.classId}`;
    }

    await notificationService.sendPaymentReminder(
      registration.student.parent.user.email,
      registration.student.parent.user.name,
      registration.student.name,
      registration.class.title,
      registration.class.priceCents,
      paymentUrl,
      registration.student.parent.phone || undefined
    );

    return { success: true, message: 'Payment reminder sent successfully' };
  }

  /**
   * Send payment reminders for multiple registrations
   */
  async sendBulkReminders(registrationIds: string[]) {
    const results = [];
    const errors = [];

    for (const registrationId of registrationIds) {
      try {
        const result = await this.sendReminder(registrationId);
        results.push({ registrationId, ...result });
      } catch (error: any) {
        errors.push({
          registrationId,
          error: error.message || 'Failed to send reminder',
        });
      }
    }

    return {
      success: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Get statistics about pending payments
   */
  async getPendingPaymentStats() {
    const [totalPending, totalAmount, byClass] = await Promise.all([
      prisma.registration.count({
        where: {
          paymentStatus: PaymentStatus.PENDING,
          class: {
            type: 'BOOTCAMP',
          },
        },
      }),
      prisma.registration.aggregate({
        where: {
          paymentStatus: PaymentStatus.PENDING,
          class: {
            type: 'BOOTCAMP',
          },
        },
      }),
      prisma.registration.groupBy({
        by: ['classId'],
        where: {
          paymentStatus: PaymentStatus.PENDING,
          class: {
            type: 'BOOTCAMP',
          },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Calculate total amount from registrations
    const registrations = await prisma.registration.findMany({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        class: {
          type: 'BOOTCAMP',
        },
      },
      include: {
        class: {
          select: {
            priceCents: true,
          },
        },
      },
    });

    const totalAmountCents = registrations.reduce(
      (sum, reg) => sum + reg.class.priceCents,
      0
    );

    return {
      totalPending,
      totalAmountCents,
      totalAmount: totalAmountCents / 100,
      byClass: byClass.length,
    };
  }
}

export const paymentReminderService = new PaymentReminderService();

