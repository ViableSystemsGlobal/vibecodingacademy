import prisma from '../config/database';
import { ClassType, ClassStatus } from '@prisma/client';

export interface CreateClassData {
  title: string;
  description?: string;
  type: ClassType;
  ageGroup?: string;
  startDatetime: Date;
  endDatetime?: Date;
  durationMinutes?: number;
  capacity: number;
  priceCents: number;
  currency?: string;
  meetingLink?: string;
  status?: ClassStatus;
}

export interface UpdateClassData extends Partial<CreateClassData> {}

export class ClassService {
  async getAll(filters?: {
    type?: ClassType;
    status?: ClassStatus;
    ageGroup?: string;
    search?: string;
  }, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.ageGroup) {
      where.ageGroup = filters.ageGroup;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' as const } },
        { description: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          _count: {
            select: {
              registrations: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { startDatetime: 'asc' },
      }),
      prisma.class.count({ where }),
    ]);

    return {
      classes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const classItem = await prisma.class.findUnique({
      where: { id },
      include: {
        registrations: {
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
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (!classItem) {
      throw new Error('Class not found');
    }

    return classItem;
  }

  async create(data: CreateClassData) {
    return prisma.class.create({
      data: {
        ...data,
        currency: data.currency || 'GHS',
        status: data.status || ClassStatus.DRAFT,
      },
    });
  }

  async update(id: string, data: UpdateClassData) {
    return prisma.class.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Check if class has registrations
    const registrations = await prisma.registration.count({
      where: { classId: id },
    });

    if (registrations > 0) {
      throw new Error('Cannot delete class with existing registrations');
    }

    return prisma.class.delete({
      where: { id },
    });
  }

  async getRegistrations(classId: string) {
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
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const classService = new ClassService();

