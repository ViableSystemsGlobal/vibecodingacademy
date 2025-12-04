import prisma from '../config/database';
import { PaymentProvider, PaymentAttemptStatus } from '@prisma/client';
import { registrationService, CreateRegistrationData } from './registration.service';

export interface CreatePaymentAttemptData {
  classId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  parentCity?: string;
  students: Array<{
    name: string;
    age?: number;
    school?: string;
  }>;
  amountCents: number;
  currency?: string;
}

export class PaymentAttemptService {
  async createPaymentAttempt(data: CreatePaymentAttemptData) {
    const { classId, students, amountCents, currency = 'GHS', ...parentData } = data;

    // Check if class exists
    const classItem = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classItem) {
      throw new Error('Class not found');
    }

    if (classItem.status !== 'PUBLISHED') {
      throw new Error('Class is not available for registration');
    }

    // Check capacity (only count actual registrations, not attempts)
    const currentRegistrations = await prisma.registration.count({
      where: { classId },
    });

    if (currentRegistrations >= classItem.capacity) {
      throw new Error('Class is full');
    }

    // Create payment attempt
    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        classId,
        parentName: parentData.parentName,
        parentEmail: parentData.parentEmail,
        parentPhone: parentData.parentPhone,
        parentCity: parentData.parentCity,
        studentsData: students,
        amountCents,
        currency,
        provider: PaymentProvider.PAYSTACK,
        status: PaymentAttemptStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
      include: {
        class: true,
      },
    });

    return paymentAttempt;
  }

  async updatePaymentAttemptStatus(
    attemptId: string,
    status: PaymentAttemptStatus,
    providerReference?: string,
    paymentUrl?: string
  ) {
    return prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        status,
        providerReference: providerReference || undefined,
        paymentUrl: paymentUrl || undefined,
        completedAt: status === PaymentAttemptStatus.COMPLETED ? new Date() : undefined,
      },
    });
  }

  async completePaymentAttempt(attemptId: string, providerReference: string) {
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      include: { class: true },
    });

    if (!attempt) {
      throw new Error('Payment attempt not found');
    }

    if (attempt.status === PaymentAttemptStatus.COMPLETED) {
      throw new Error('Payment attempt already completed');
    }

    // Create actual registration from payment attempt
    // Skip notifications since payment success email will be sent separately
    const registrationData: CreateRegistrationData = {
      classId: attempt.classId,
      parentName: attempt.parentName,
      parentEmail: attempt.parentEmail,
      parentPhone: attempt.parentPhone || undefined,
      parentCity: attempt.parentCity || undefined,
      students: attempt.studentsData as Array<{ name: string; age?: number; school?: string }>,
      skipNotifications: true, // Skip "pending" email since payment already succeeded
    };

    const registrationResult = await registrationService.createRegistration(registrationData);

    // Mark attempt as completed
    await this.updatePaymentAttemptStatus(
      attemptId,
      PaymentAttemptStatus.COMPLETED,
      providerReference
    );

    return {
      attempt,
      registration: registrationResult,
    };
  }

  async getAllPaymentAttempts(filters?: {
    status?: PaymentAttemptStatus;
    classId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.classId) {
      where.classId = filters.classId;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    const [attempts, total] = await Promise.all([
      prisma.paymentAttempt.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              title: true,
              type: true,
              startDatetime: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.paymentAttempt.count({ where }),
    ]);

    return {
      attempts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentAttemptById(id: string) {
    return prisma.paymentAttempt.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });
  }

  async updatePaymentAttemptNotes(id: string, notes: string) {
    return prisma.paymentAttempt.update({
      where: { id },
      data: { notes },
    });
  }

  async cancelPaymentAttempt(id: string) {
    return prisma.paymentAttempt.update({
      where: { id },
      data: {
        status: PaymentAttemptStatus.CANCELLED,
      },
    });
  }

  // Clean up expired attempts (can be run via cron)
  async cleanupExpiredAttempts() {
    const expired = await prisma.paymentAttempt.updateMany({
      where: {
        status: PaymentAttemptStatus.PENDING,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: PaymentAttemptStatus.EXPIRED,
      },
    });

    return expired.count;
  }
}

export const paymentAttemptService = new PaymentAttemptService();

