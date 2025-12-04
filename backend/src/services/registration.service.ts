import prisma from '../config/database';
import { RegistrationSource, PaymentStatus, AttendanceStatus } from '@prisma/client';
import { notificationService } from './notification.service';
import { authService } from './auth.service';
import { config } from '../config/env';

export interface CreateRegistrationData {
  classId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  parentWhatsapp?: string;
  parentCity?: string;
  parentCountry?: string;
  howHeard?: string;
  students: Array<{
    name: string;
    age?: number;
    school?: string;
  }>;
  skipNotifications?: boolean; // Skip sending notifications (e.g., when payment already succeeded)
}

export class RegistrationService {
  async createRegistration(data: CreateRegistrationData) {
    const { classId, students, ...parentData } = data;

    // Check if class exists and has capacity
    const classItem = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classItem) {
      throw new Error('Class not found');
    }

    if (classItem.status !== 'PUBLISHED') {
      throw new Error('Class is not available for registration');
    }

    // Check capacity
    const currentRegistrations = await prisma.registration.count({
      where: { classId },
    });

    if (currentRegistrations >= classItem.capacity) {
      throw new Error('Class is full');
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: parentData.parentEmail },
    });

    let isNewUser = false;
    if (!user) {
      // Create user with temporary password (parent will need to set password)
      const bcrypt = require('bcrypt');
      const tempPassword = await bcrypt.hash(Math.random().toString(36), 10);
      
      user = await prisma.user.create({
        data: {
          name: parentData.parentName,
          email: parentData.parentEmail,
          passwordHash: tempPassword,
          role: 'PARENT',
        },
      });
      isNewUser = true;

      // Generate password setup token and send welcome email
      try {
        const setupToken = await authService.generatePasswordSetupToken(user.id);
        const setupUrl = `${config.frontendUrl}/reset-password?token=${setupToken}`;
        await notificationService.sendWelcomeEmail(
          parentData.parentEmail,
          parentData.parentName,
          setupUrl
        );
      } catch (error) {
        console.error('Error sending welcome email:', error);
        // Don't fail registration if email fails
      }
    }

    // Find or create parent
    let parent = await prisma.parent.findUnique({
      where: { userId: user.id },
    });

    if (!parent) {
      parent = await prisma.parent.create({
        data: {
          userId: user.id,
          phone: parentData.parentPhone,
          whatsappNumber: parentData.parentWhatsapp,
          city: parentData.parentCity,
          country: parentData.parentCountry,
          howHeard: parentData.howHeard,
        },
      });
    }

    // Create students and registrations
    const createdRegistrations = [];

    for (const studentData of students) {
      // Check if student already exists for this parent
      let student = await prisma.student.findFirst({
        where: {
          parentId: parent.id,
          name: studentData.name,
        },
      });

      if (!student) {
        student = await prisma.student.create({
          data: {
            parentId: parent.id,
            name: studentData.name,
            age: studentData.age,
            school: studentData.school,
          },
        });
      }

      // Create registration
      const registration = await prisma.registration.create({
        data: {
          classId,
          parentId: parent.id,
          studentId: student.id,
          registrationSource: RegistrationSource.LANDING_PAGE,
          paymentStatus: classItem.type === 'FREE' ? PaymentStatus.NA : PaymentStatus.PENDING,
        },
      });

      createdRegistrations.push(registration);

      // Send notification (skip if flag is set, e.g., when payment already succeeded)
      if (!data.skipNotifications) {
        if (classItem.type === 'FREE') {
          await notificationService.sendRegistrationConfirmation(
            parentData.parentEmail,
            parentData.parentName,
            studentData.name,
            classItem.title,
            classItem.startDatetime,
            classItem.meetingLink || undefined,
            (parentData.parentPhone || parent?.phone) || undefined
          );
        } else {
          await notificationService.sendBootcampRegistrationPending(
            parentData.parentEmail,
            parentData.parentName,
            studentData.name,
            classItem.title,
            classItem.priceCents,
            parentData.parentPhone || parent?.phone || undefined
          );
        }
      }
    }

    return {
      parent,
      registrations: createdRegistrations,
    }
  }

  async getAllRegistrations(filters?: {
    classId?: string;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
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

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
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
          payments: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.registration.count({ where }),
    ]);

    return {
      registrations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.registration.findUnique({
      where: { id },
      include: {
        class: true,
        student: {
          include: {
            parent: {
              include: {
                user: true,
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  async update(id: string, data: {
    paymentStatus?: PaymentStatus;
    attendanceStatus?: AttendanceStatus;
  }) {
    return prisma.registration.update({
      where: { id },
      data,
    });
  }

  async bulkUpdateAttendance(updates: Array<{ id: string; attendanceStatus: AttendanceStatus }>) {
    // Use transaction to update all registrations
    return prisma.$transaction(
      updates.map((update) =>
        prisma.registration.update({
          where: { id: update.id },
          data: { attendanceStatus: update.attendanceStatus },
        })
      )
    );
  }

  async getRegistrationsByClass(classId: string) {
    return prisma.registration.findMany({
      where: { classId },
      include: {
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
        payments: true,
      },
      orderBy: [
        { student: { name: 'asc' } },
      ],
    });
  }
}

export const registrationService = new RegistrationService();

