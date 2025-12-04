import prisma from '../config/database';
import { NotificationType, NotificationStatus } from '@prisma/client';

export interface NotificationLogFilters {
  type?: NotificationType;
  status?: NotificationStatus;
  toAddress?: string;
  templateKey?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class NotificationLogsService {
  async getAll(filters: NotificationLogFilters = {}) {
    const {
      type,
      status,
      toAddress,
      templateKey,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (toAddress) {
      where.toAddress = {
        contains: toAddress,
        mode: 'insensitive',
      };
    }

    if (templateKey) {
      where.templateKey = templateKey;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.notificationLog.findUnique({
      where: { id },
    });
  }

  async getStats() {
    const [total, success, failed, byType, recentFailures] = await Promise.all([
      prisma.notificationLog.count(),
      prisma.notificationLog.count({
        where: { status: 'SUCCESS' },
      }),
      prisma.notificationLog.count({
        where: { status: 'FAILED' },
      }),
      prisma.notificationLog.groupBy({
        by: ['type'],
        _count: {
          id: true,
        },
      }),
      prisma.notificationLog.findMany({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      }),
    ]);

    return {
      total,
      success,
      failed,
      successRate: total > 0 ? ((success / total) * 100).toFixed(2) : '0.00',
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      recentFailures,
    };
  }
}

export const notificationLogsService = new NotificationLogsService();

