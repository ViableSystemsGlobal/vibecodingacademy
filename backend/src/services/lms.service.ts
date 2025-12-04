import prisma from '../config/database';
import { CourseStatus, LessonProgressStatus, CourseLevel } from '@prisma/client';

export class LmsService {
  // Admin methods
  async getAllCourses(filters?: { status?: CourseStatus }, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          modules: {
            include: {
              _count: {
                select: { lessons: true },
              },
            },
          },
          _count: {
            select: { modules: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.course.count({ where }),
    ]);

    return {
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCourseById(id: string) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            lessons: {
              include: {
                resources: true,
              },
            },
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
        accessRules: true,
      },
    });
  }

  async createCourse(data: {
    title: string;
    slug: string;
    description?: string;
    level: string;
    recommendedAgeMin?: number;
    recommendedAgeMax?: number;
    status?: CourseStatus;
  }) {
    return prisma.course.create({
      data: {
        ...data,
        level: data.level as CourseLevel,
        status: data.status || CourseStatus.DRAFT,
      },
    });
  }

  async updateCourse(id: string, data: any) {
    return prisma.course.update({
      where: { id },
      data,
    });
  }

  async deleteCourse(id: string) {
    return prisma.course.delete({
      where: { id },
    });
  }

  // Student methods - with access rules
  async getStudentCourses(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        registrations: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get all published courses
    const allCourses = await prisma.course.findMany({
      where: { status: CourseStatus.PUBLISHED },
      include: {
        accessRules: true,
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    // Filter courses based on access rules
    const accessibleCourses = allCourses.filter((course) => {
      if (course.accessRules.length === 0) {
        // No access rules = free for all
        return true;
      }

      for (const rule of course.accessRules) {
        if (rule.requiredType === 'ANY_REGISTRATION') {
          if (student.registrations.length > 0) {
            return true;
          }
        } else if (rule.requiredType === 'PAID_BOOTCAMP') {
          const hasPaidBootcamp = student.registrations.some(
            (reg) => reg.class.type === 'BOOTCAMP' && reg.paymentStatus === 'PAID'
          );
          if (hasPaidBootcamp) {
            return true;
          }
        } else if (rule.requiredType === 'SPECIFIC_CLASS' && rule.requiredClassId) {
          const hasSpecificClass = student.registrations.some(
            (reg) => reg.classId === rule.requiredClassId
          );
          if (hasSpecificClass) {
            return true;
          }
        }
      }

      return false;
    });

    return accessibleCourses;
  }

  async getStudentCourseProgress(studentId: string, courseId: string) {
    const progress = await prisma.studentLessonProgress.findMany({
      where: {
        studentId,
        lesson: {
          module: {
            courseId,
          },
        },
      },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    return progress;
  }

  async updateLessonProgress(
    studentId: string,
    lessonId: string,
    status: LessonProgressStatus
  ) {
    const progress = await prisma.studentLessonProgress.upsert({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
      update: {
        status,
        lastViewedAt: new Date(),
        completedAt: status === LessonProgressStatus.COMPLETED ? new Date() : null,
      },
      create: {
        studentId,
        lessonId,
        status,
        lastViewedAt: new Date(),
        completedAt: status === LessonProgressStatus.COMPLETED ? new Date() : null,
      },
    });

    return progress;
  }
}

export const lmsService = new LmsService();

