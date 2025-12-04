import prisma from '../config/database';

export class StudentService {
  async getAllStudents(search?: string, parentId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { school: { contains: search, mode: 'insensitive' as const } },
        { parent: { user: { name: { contains: search, mode: 'insensitive' as const } } } },
      ];
    }

    if (parentId) {
      where.parentId = parentId;
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          parent: {
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
          registrations: {
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
          },
          _count: {
            select: {
              registrations: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentById(id: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parent: {
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
        registrations: {
          include: {
            class: true,
            payments: true,
          },
        },
        lessonProgress: {
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return student;
  }
}

export const studentService = new StudentService();

