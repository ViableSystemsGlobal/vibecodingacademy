import prisma from '../config/database';
import { PaymentProvider, PaymentStatus, PaymentAttempt } from '@prisma/client';
import { paystackService } from './paystack.service';
import { notificationService } from './notification.service';
import { paymentAttemptService } from './payment-attempt.service';

export class PaymentService {
  async createPaymentFromAttempt(attempt: PaymentAttempt) {
    // Initialize Paystack payment
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3005'}/payment-success`;
    
    try {
      const reference = `ATTEMPT-${attempt.id}-${Date.now()}`;
      const paystackResponse = await paystackService.initializeTransaction({
        email: attempt.parentEmail,
        amount: attempt.amountCents,
        reference,
        callback_url: callbackUrl,
        metadata: {
          paymentAttemptId: attempt.id,
          classId: attempt.classId,
        },
      });

      // Update attempt with provider reference and payment URL
      await paymentAttemptService.updatePaymentAttemptStatus(
        attempt.id,
        'PENDING' as any,
        paystackResponse.reference,
        paystackResponse.authorization_url
      );

      // Create payment record (without registration yet - will be created on success)
      // We'll use a temporary registration ID that we'll update later
      // For now, we'll create a dummy registration or handle it differently
      // Actually, let's not create payment record yet - create it when payment succeeds
      
      return {
        paymentAttemptId: attempt.id,
        authorizationUrl: paystackResponse.authorization_url,
        reference: paystackResponse.reference,
      };
    } catch (error: any) {
      // Provide more specific error messages
      if (error.message?.includes('Paystack')) {
        throw error;
      }
      if (error.response?.data?.message) {
        throw new Error(`Paystack error: ${error.response.data.message}`);
      }
      throw new Error(`Failed to initialize payment: ${error.message || 'Unknown error'}`);
    }
  }
  async createPayment(registrationId: string, amountCents: number, currency: string) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { class: true, student: { include: { parent: { include: { user: true } } } } },
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Validate amount
    if (!amountCents || amountCents <= 0) {
      throw new Error('Invalid payment amount. Amount must be greater than 0.');
    }

    // Paystack configuration check is done in paystackService.getSecretKey()

    // Initialize Paystack payment
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3005'}/payment-success`;
    
    try {
      const paystackResponse = await paystackService.initializeTransaction({
        email: registration.student.parent.user.email,
        amount: amountCents,
        reference: `REG-${registrationId}-${Date.now()}`,
        callback_url: callbackUrl,
        metadata: {
          registrationId,
          studentId: registration.studentId,
          classId: registration.classId,
        },
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          registrationId,
          amountCents,
          currency,
          provider: PaymentProvider.PAYSTACK,
          providerReference: paystackResponse.reference,
          status: PaymentStatus.PENDING,
        },
      });

      return {
        payment,
        authorizationUrl: paystackResponse.authorization_url,
      };
    } catch (error: any) {
      // Provide more specific error messages
      if (error.message?.includes('Paystack')) {
        throw error;
      }
      if (error.response?.data?.message) {
        throw new Error(`Paystack error: ${error.response.data.message}`);
      }
      throw new Error(`Failed to initialize payment: ${error.message || 'Unknown error'}`);
    }
  }

  async verifyPayment(reference: string) {
    const paystackResponse = await paystackService.verifyTransaction(reference);

    // First check if this is a payment attempt (new flow)
    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: { providerReference: reference },
      include: { class: true },
    });

    if (paymentAttempt) {
      // This is a payment attempt - handle accordingly
      if (paystackResponse.status === 'success') {
        // Complete the payment attempt and create registration
        const result = await paymentAttemptService.completePaymentAttempt(
          paymentAttempt.id,
          reference
        );

        // Create payment record for each registration
        const registrations = result.registration.registrations;
        const payments = [];
        
        for (const registration of registrations) {
          // Calculate amount per student (divide total by number of students)
          const amountPerStudent = Math.floor(paymentAttempt.amountCents / registrations.length);
          
          const payment = await prisma.payment.create({
            data: {
              registrationId: registration.id,
              amountCents: amountPerStudent,
              currency: paymentAttempt.currency,
              provider: PaymentProvider.PAYSTACK,
              providerReference: reference,
              status: PaymentStatus.PAID,
              paidAt: new Date(),
            },
          });
          payments.push(payment);
        }

        // Send confirmation notification for all students
        const studentsData = paymentAttempt.studentsData as Array<{ name: string; age?: number; school?: string }>;
        for (const student of studentsData) {
          await notificationService.sendBootcampPaymentSuccess(
            paymentAttempt.parentEmail,
            paymentAttempt.parentName,
            student.name,
            paymentAttempt.class.title
          );
        }

        return {
          paymentAttempt: result.attempt,
          registration: result.registration,
          payments,
          status: 'success',
        };
      } else {
        // Payment failed - keep attempt as pending for retry
        await paymentAttemptService.updatePaymentAttemptStatus(
          paymentAttempt.id,
          'PENDING' as any,
          reference
        );

        throw new Error('Payment verification failed');
      }
    }

    // Legacy flow - payment with existing registration
    const payment = await prisma.payment.findFirst({
      where: { providerReference: reference },
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
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (paystackResponse.status === 'success') {
      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Update registration payment status
      await prisma.registration.update({
        where: { id: payment.registrationId },
        data: {
          paymentStatus: 'PAID',
        },
      });

      // Send confirmation notification
      await notificationService.sendBootcampPaymentSuccess(
        payment.registration.student.parent.user.email,
        payment.registration.student.parent.user.name,
        payment.registration.student.name,
        payment.registration.class.title
      );
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
    }

    return payment;
  }

  async getAllPayments(filters?: {
    registrationId?: string;
    status?: PaymentStatus;
  }, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.registrationId) {
      where.registrationId = filters.registrationId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          registration: {
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
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updatePaymentStatus(registrationId: string, status: PaymentStatus, amountCents?: number) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Update or create payment record
    const payment = await prisma.payment.upsert({
      where: {
        registrationId,
      },
      update: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
      },
      create: {
        registrationId,
        amountCents: amountCents || registration.class.priceCents,
        currency: 'GHS',
        provider: PaymentProvider.MANUAL,
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
      },
    });

    // Update registration payment status
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        paymentStatus: status === PaymentStatus.PAID ? 'PAID' : 'PENDING',
      },
    });

    return payment;
  }
}

export const paymentService = new PaymentService();

