import { Request, Response } from 'express';
import { paymentAttemptService } from '../services/payment-attempt.service';
import { PaymentAttemptStatus } from '@prisma/client';

export class PaymentAttemptController {
  async getAll(req: Request, res: Response) {
    try {
      const status = req.query.status as PaymentAttemptStatus | undefined;
      const classId = req.query.classId as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await paymentAttemptService.getAllPaymentAttempts(
        { status, classId, dateFrom, dateTo },
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
        error: { message: error.message || 'Failed to fetch payment attempts' },
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const attempt = await paymentAttemptService.getPaymentAttemptById(id);

      if (!attempt) {
        return res.status(404).json({
          success: false,
          error: { message: 'Payment attempt not found' },
        });
      }

      res.json({
        success: true,
        data: attempt,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch payment attempt' },
      });
    }
  }

  async updateNotes(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const attempt = await paymentAttemptService.updatePaymentAttemptNotes(id, notes || '');

      res.json({
        success: true,
        data: attempt,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update notes' },
      });
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const attempt = await paymentAttemptService.cancelPaymentAttempt(id);

      res.json({
        success: true,
        data: attempt,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to cancel payment attempt' },
      });
    }
  }
}

export const paymentAttemptController = new PaymentAttemptController();

