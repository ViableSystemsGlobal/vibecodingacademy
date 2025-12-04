import prisma from '../config/database';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { PaymentStatus, AttendanceStatus } from '@prisma/client';

export class DashboardService {
  async getSummary() {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);

    const [
      totalParents,
      totalStudents,
      totalClasses,
      totalRegistrations,
      registrationsLast7Days,
      freeRegistrations,
      paidRegistrations,
      totalRevenue,
      upcomingClasses,
    ] = await Promise.all([
      prisma.parent.count(),
      prisma.student.count(),
      prisma.class.count(),
      prisma.registration.count(),
      prisma.registration.count({
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      prisma.registration.count({
        where: {
          class: {
            type: 'FREE',
          },
        },
      }),
      prisma.registration.count({
        where: {
          class: {
            type: 'BOOTCAMP',
          },
          paymentStatus: 'PAID',
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
        },
        _sum: {
          amountCents: true,
        },
      }),
      prisma.class.findMany({
        where: {
          status: 'PUBLISHED',
          startDatetime: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          },
        },
        include: {
          _count: {
            select: {
              registrations: true,
            },
          },
        },
        orderBy: {
          startDatetime: 'asc',
        },
        take: 10,
      }),
    ]);

    // Get registrations over time (last 30 days) - simplified approach
    const recentRegistrations = await prisma.registration.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by date manually
    const registrationsByDate = new Map<string, number>();
    recentRegistrations.forEach((reg) => {
      const date = reg.createdAt.toISOString().split('T')[0];
      registrationsByDate.set(date, (registrationsByDate.get(date) || 0) + 1);
    });

    const registrationsOverTime = Array.from(registrationsByDate.entries())
      .map(([date, count]) => ({
        date,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Revenue over time (last 30 days)
    const recentPayments = await prisma.payment.findMany({
      where: {
        status: 'PAID',
        paidAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        paidAt: true,
        amountCents: true,
      },
      orderBy: {
        paidAt: 'asc',
      },
    });

    const revenueByDate = new Map<string, number>();
    recentPayments.forEach((payment) => {
      if (payment.paidAt) {
        const date = payment.paidAt.toISOString().split('T')[0];
        revenueByDate.set(date, (revenueByDate.get(date) || 0) + payment.amountCents);
      }
    });

    const revenueOverTime = Array.from(revenueByDate.entries())
      .map(([date, amount]) => ({
        date,
        amount: amount / 100, // Convert to currency units
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Attendance statistics
    const attendanceStats = await prisma.registration.groupBy({
      by: ['attendanceStatus'],
      _count: {
        id: true,
      },
    });

    const attendanceBreakdown = {
      attended: attendanceStats.find((s) => s.attendanceStatus === AttendanceStatus.ATTENDED)?._count.id || 0,
      absent: attendanceStats.find((s) => s.attendanceStatus === AttendanceStatus.ABSENT)?._count.id || 0,
      unknown: attendanceStats.find((s) => s.attendanceStatus === AttendanceStatus.UNKNOWN)?._count.id || 0,
    };

    const totalWithAttendance = attendanceBreakdown.attended + attendanceBreakdown.absent;
    const attendanceRate = totalWithAttendance > 0 
      ? (attendanceBreakdown.attended / totalWithAttendance) * 100 
      : 0;

    // Payment conversion rates
    const bootcampRegistrations = await prisma.registration.count({
      where: {
        class: {
          type: 'BOOTCAMP',
        },
      },
    });

    const paidBootcampRegistrations = await prisma.registration.count({
      where: {
        class: {
          type: 'BOOTCAMP',
        },
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const pendingPayments = await prisma.registration.count({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        class: {
          type: 'BOOTCAMP',
        },
      },
    });

    const paymentConversionRate = bootcampRegistrations > 0
      ? (paidBootcampRegistrations / bootcampRegistrations) * 100
      : 0;

    // Class popularity (top 10 classes by registrations)
    const popularClasses = await prisma.class.findMany({
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: {
        registrations: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    // Revenue by class type
    const revenueByClassType = await prisma.registration.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        class: {
          type: 'BOOTCAMP',
        },
      },
      include: {
        class: {
          select: {
            type: true,
            priceCents: true,
          },
        },
      },
    });

    const bootcampRevenue = revenueByClassType.reduce(
      (sum, reg) => sum + reg.class.priceCents,
      0
    );

    // Monthly revenue (last 3 months)
    const monthlyRevenue = await prisma.payment.findMany({
      where: {
        status: 'PAID',
        paidAt: {
          gte: ninetyDaysAgo,
        },
      },
      select: {
        paidAt: true,
        amountCents: true,
      },
    });

    const revenueByMonth = new Map<string, number>();
    monthlyRevenue.forEach((payment) => {
      if (payment.paidAt) {
        const month = format(payment.paidAt, 'yyyy-MM');
        revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + payment.amountCents);
      }
    });

    const monthlyRevenueData = Array.from(revenueByMonth.entries())
      .map(([month, amount]) => ({
        month,
        amount: amount / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      counts: {
        parents: totalParents,
        students: totalStudents,
        classes: totalClasses,
        registrations: totalRegistrations,
        registrationsLast7Days,
        freeRegistrations,
        paidRegistrations,
        revenue: totalRevenue._sum.amountCents || 0,
        pendingPayments,
      },
      registrationsOverTime,
      revenueOverTime,
      monthlyRevenue: monthlyRevenueData,
      attendance: {
        ...attendanceBreakdown,
        rate: attendanceRate,
      },
      paymentConversion: {
        rate: paymentConversionRate,
        total: bootcampRegistrations,
        paid: paidBootcampRegistrations,
        pending: pendingPayments,
      },
      popularClasses: popularClasses.map((classItem) => ({
        id: classItem.id,
        title: classItem.title,
        type: classItem.type,
        registrations: classItem._count.registrations,
      })),
      revenue: {
        total: (totalRevenue._sum.amountCents || 0) / 100,
        bootcamp: bootcampRevenue / 100,
      },
      upcomingClasses: upcomingClasses.map((classItem) => ({
        id: classItem.id,
        title: classItem.title,
        startDatetime: classItem.startDatetime,
        capacity: classItem.capacity,
        registrations: classItem._count.registrations,
        seatsLeft: classItem.capacity - classItem._count.registrations,
      })),
    };
  }
}

export const dashboardService = new DashboardService();

