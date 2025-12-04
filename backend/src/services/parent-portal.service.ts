import prisma from '../config/database';

export class ParentPortalService {
  async getDashboard(parentId: string) {
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        students: {
          include: {
            registrations: {
              include: {
                class: true,
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new Error('Parent not found');
    }

    return {
      parent: {
        id: parent.id,
        phone: parent.phone,
        whatsappNumber: parent.whatsappNumber,
        city: parent.city,
        country: parent.country,
      },
      children: parent.students.map((student) => ({
        id: student.id,
        name: student.name,
        age: student.age,
        school: student.school,
        registrations: student.registrations.map((reg) => ({
          id: reg.id,
          class: {
            id: reg.class.id,
            title: reg.class.title,
            type: reg.class.type,
            startDatetime: reg.class.startDatetime,
            meetingLink: reg.class.meetingLink,
          },
          paymentStatus: reg.paymentStatus,
          attendanceStatus: reg.attendanceStatus,
          payments: reg.payments,
        })),
      })),
    };
  }

  async getChildren(parentId: string) {
    return prisma.student.findMany({
      where: { parentId },
      orderBy: { name: 'asc' },
    });
  }

  async getRegistrations(parentId: string, studentId?: string) {
    return prisma.registration.findMany({
      where: {
        parentId,
        ...(studentId && { studentId }),
      },
      include: {
        class: true,
        student: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayments(parentId: string, studentId?: string) {
    const registrations = await prisma.registration.findMany({
      where: {
        parentId,
        ...(studentId && { studentId }),
      },
      select: { id: true },
    });

    const registrationIds = registrations.map((r) => r.id);

    return prisma.payment.findMany({
      where: {
        registrationId: {
          in: registrationIds,
        },
      },
      include: {
        registration: {
          include: {
            class: true,
            student: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const parentPortalService = new ParentPortalService();

