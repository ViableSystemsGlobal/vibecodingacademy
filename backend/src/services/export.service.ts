import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';
import { CsvExport } from '../utils/csv-export';
import { registrationService } from './registration.service';

export class ExportService {
  /**
   * Export registrations to CSV
   */
  async exportRegistrations(filters?: {
    classId?: string;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    // Fetch all registrations matching filters (no pagination for export)
    const result = await registrationService.getAllRegistrations(filters, 1, 10000);
    
    // Transform data for CSV
    const csvData = result.registrations.map((reg) => {
      const totalPaid = reg.payments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amountCents, 0);

      return {
        'Registration ID': reg.id,
        'Registration Date': CsvExport.formatDateTime(reg.createdAt),
        'Class Title': reg.class.title,
        'Class Type': reg.class.type,
        'Class Start Date': CsvExport.formatDateTime(reg.class.startDatetime),
        'Parent Name': reg.student.parent.user.name,
        'Parent Email': reg.student.parent.user.email,
        'Parent Phone': reg.student.parent.phone || '',
        'Parent City': reg.student.parent.city || '',
        'Student Name': reg.student.name,
        'Student Age': reg.student.age || '',
        'Student School': reg.student.school || '',
        'Payment Status': reg.paymentStatus,
        'Attendance Status': reg.attendanceStatus,
        'Total Paid': CsvExport.formatCurrency(totalPaid, reg.class.currency),
        'Payment Count': reg.payments.length,
        'Registration Source': reg.registrationSource,
      };
    });

    const headers = [
      'Registration ID',
      'Registration Date',
      'Class Title',
      'Class Type',
      'Class Start Date',
      'Parent Name',
      'Parent Email',
      'Parent Phone',
      'Parent City',
      'Student Name',
      'Student Age',
      'Student School',
      'Payment Status',
      'Attendance Status',
      'Total Paid',
      'Payment Count',
      'Registration Source',
    ];

    return CsvExport.toCSV(csvData, headers);
  }

  /**
   * Export payments to CSV
   */
  async exportPayments(filters?: {
    registrationId?: string;
    status?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const where: any = {};

    if (filters?.registrationId) {
      where.registrationId = filters.registrationId;
    }

    if (filters?.status) {
      where.status = filters.status;
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

    const payments = await prisma.payment.findMany({
      where,
      include: {
        registration: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvData = payments.map((payment) => ({
      'Payment ID': payment.id,
      'Payment Date': CsvExport.formatDateTime(payment.createdAt),
      'Paid At': payment.paidAt ? CsvExport.formatDateTime(payment.paidAt) : '',
      'Amount': CsvExport.formatCurrency(payment.amountCents, payment.currency),
      'Status': payment.status,
      'Provider': payment.provider,
      'Provider Reference': payment.providerReference || '',
      'Registration ID': payment.registrationId,
      'Class Title': payment.registration.class.title,
      'Parent Name': payment.registration.student.parent.user.name,
      'Parent Email': payment.registration.student.parent.user.email,
      'Student Name': payment.registration.student.name,
    }));

    const headers = [
      'Payment ID',
      'Payment Date',
      'Paid At',
      'Amount',
      'Status',
      'Provider',
      'Provider Reference',
      'Registration ID',
      'Class Title',
      'Parent Name',
      'Parent Email',
      'Student Name',
    ];

    return CsvExport.toCSV(csvData, headers);
  }

  /**
   * Export parents to CSV
   */
  async exportParents(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' as const } } },
        { user: { email: { contains: search, mode: 'insensitive' as const } } },
        { phone: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const parents = await prisma.parent.findMany({
      where,
      include: {
        user: true,
        students: true,
        registrations: {
          include: {
            class: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvData = parents.map((parent) => ({
      'Parent ID': parent.id,
      'Name': parent.user.name,
      'Email': parent.user.email,
      'Phone': parent.phone || '',
      'WhatsApp': parent.whatsappNumber || '',
      'City': parent.city || '',
      'Country': parent.country || '',
      'How Heard': parent.howHeard || '',
      'Student Count': parent.students.length,
      'Registration Count': parent.registrations.length,
      'Created Date': CsvExport.formatDateTime(parent.createdAt),
    }));

    const headers = [
      'Parent ID',
      'Name',
      'Email',
      'Phone',
      'WhatsApp',
      'City',
      'Country',
      'How Heard',
      'Student Count',
      'Registration Count',
      'Created Date',
    ];

    return CsvExport.toCSV(csvData, headers);
  }

  /**
   * Export students to CSV
   */
  async exportStudents(search?: string, parentId?: string) {
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

    const students = await prisma.student.findMany({
      where,
      include: {
        parent: {
          include: {
            user: true,
          },
        },
        registrations: {
          include: {
            class: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvData = students.map((student) => ({
      'Student ID': student.id,
      'Name': student.name,
      'Age': student.age || '',
      'School': student.school || '',
      'Parent Name': student.parent.user.name,
      'Parent Email': student.parent.user.email,
      'Parent Phone': student.parent.phone || '',
      'Registration Count': student.registrations.length,
      'Created Date': CsvExport.formatDateTime(student.createdAt),
    }));

    const headers = [
      'Student ID',
      'Name',
      'Age',
      'School',
      'Parent Name',
      'Parent Email',
      'Parent Phone',
      'Registration Count',
      'Created Date',
    ];

    return CsvExport.toCSV(csvData, headers);
  }
}

export const exportService = new ExportService();

