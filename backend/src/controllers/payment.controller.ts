import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { paymentAttemptService } from '../services/payment-attempt.service';
import { PaymentStatus } from '@prisma/client';

export class PaymentController {
  async createPaymentAttempt(req: Request, res: Response) {
    try {
      const { classId, parentName, parentEmail, parentPhone, parentCity, students, amountCents, currency } = req.body;
      
      const attempt = await paymentAttemptService.createPaymentAttempt({
        classId,
        parentName,
        parentEmail,
        parentPhone,
        parentCity,
        students,
        amountCents,
        currency,
      });

      res.json({
        success: true,
        data: attempt,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create payment attempt' },
      });
    }
  }

  async createPaymentFromAttempt(req: Request, res: Response) {
    try {
      const { paymentAttemptId } = req.body;
      
      const attempt = await paymentAttemptService.getPaymentAttemptById(paymentAttemptId);
      if (!attempt) {
        return res.status(404).json({
          success: false,
          error: { message: 'Payment attempt not found' },
        });
      }

      // Initialize Paystack payment
      const result = await paymentService.createPaymentFromAttempt(attempt);

      // Update attempt with payment URL and reference
      await paymentAttemptService.updatePaymentAttemptStatus(
        paymentAttemptId,
        attempt.status,
        result.payment.providerReference || undefined,
        result.authorizationUrl
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create payment' },
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { registrationId, amountCents, currency } = req.body;
      const result = await paymentService.createPayment(registrationId, amountCents, currency);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create payment' },
      });
    }
  }

  async verify(req: Request, res: Response) {
    try {
      const { reference } = req.query;
      if (!reference || typeof reference !== 'string') {
        return res.status(400).json({
          success: false,
          error: { message: 'Reference is required' },
        });
      }

      const payment = await paymentService.verifyPayment(reference);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to verify payment' },
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const registrationId = req.query.registrationId as string | undefined;
      const status = req.query.status as PaymentStatus | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await paymentService.getAllPayments(
        { registrationId, status },
        page,
        limit
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch payments' },
      });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, amountCents } = req.body;

      const payment = await paymentService.updatePaymentStatus(id, status, amountCents);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update payment status' },
      });
    }
  }
}

export const paymentController = new PaymentController();

