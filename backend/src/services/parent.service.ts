import prisma from '../config/database';

export class ParentService {
  async getAllParents(search?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { user: { name: { contains: search, mode: 'insensitive' as const } } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [parents, total] = await Promise.all([
      prisma.parent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          students: {
            select: {
              id: true,
              name: true,
              age: true,
              school: true,
            },
          },
          _count: {
            select: {
              students: true,
              registrations: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.parent.count({ where }),
    ]);

    return {
      parents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getParentById(id: string) {
    const parent = await prisma.parent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        students: {
          include: {
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
          },
        },
        registrations: {
          include: {
            class: true,
            student: true,
            payments: true,
          },
        },
      },
    });

    if (!parent) {
      throw new Error('Parent not found');
    }

    return parent;
  }
}

export const parentService = new ParentService();

