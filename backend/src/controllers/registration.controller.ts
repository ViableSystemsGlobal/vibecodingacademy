import { Request, Response } from 'express';
import { registrationService, CreateRegistrationData } from '../services/registration.service';
import { PaymentStatus } from '@prisma/client';

export class RegistrationController {
  async create(req: Request, res: Response) {
    try {
      const data: CreateRegistrationData = req.body;
      const result = await registrationService.createRegistration(data);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create registration' },
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const classId = req.query.classId as string | undefined;
      const paymentStatus = req.query.paymentStatus as PaymentStatus | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await registrationService.getAllRegistrations(
        { classId, paymentStatus, dateFrom, dateTo },
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
        error: { message: error.message || 'Failed to fetch registrations' },
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const registration = await registrationService.getById(id);

      if (!registration) {
        return res.status(404).json({
          success: false,
          error: { message: 'Registration not found' },
        });
      }

      res.json({
        success: true,
        data: registration,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: { message: error.message || 'Registration not found' },
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { paymentStatus, attendanceStatus } = req.body;

      const registration = await registrationService.update(id, {
        paymentStatus,
        attendanceStatus,
      });

      res.json({
        success: true,
        data: registration,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update registration' },
      });
    }
  }

  async bulkUpdateAttendance(req: Request, res: Response) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Updates array is required and must not be empty' },
        });
      }

      const result = await registrationService.bulkUpdateAttendance(updates);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update attendance' },
      });
    }
  }

  async getByClass(req: Request, res: Response) {
    try {
      const { classId } = req.params;
      const registrations = await registrationService.getRegistrationsByClass(classId);

      res.json({
        success: true,
        data: registrations,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch registrations' },
      });
    }
  }
}

export const registrationController = new RegistrationController();

