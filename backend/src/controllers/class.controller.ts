import { Request, Response } from 'express';
import { classService, CreateClassData, UpdateClassData } from '../services/class.service';
import { ClassType, ClassStatus } from '@prisma/client';

export class ClassController {
  async getAll(req: Request, res: Response) {
    try {
      const type = req.query.type as ClassType | undefined;
      const status = req.query.status as ClassStatus | undefined;
      const ageGroup = req.query.ageGroup as string | undefined;
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await classService.getAll(
        { type, status, ageGroup, search },
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
        error: { message: error.message || 'Failed to fetch classes' },
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const classItem = await classService.getById(id);

      res.json({
        success: true,
        data: classItem,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: { message: error.message || 'Class not found' },
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data: CreateClassData = {
        title: req.body.title,
        description: req.body.description,
        type: req.body.type,
        ageGroup: req.body.ageGroup,
        startDatetime: new Date(req.body.startDatetime),
        endDatetime: req.body.endDatetime ? new Date(req.body.endDatetime) : undefined,
        durationMinutes: req.body.durationMinutes,
        capacity: req.body.capacity,
        priceCents: req.body.priceCents || 0,
        currency: req.body.currency,
        meetingLink: req.body.meetingLink,
        status: req.body.status,
      };

      const classItem = await classService.create(data);

      res.status(201).json({
        success: true,
        data: classItem,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create class' },
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: UpdateClassData = { ...req.body };

      if (data.startDatetime) {
        data.startDatetime = new Date(data.startDatetime);
      }
      if (data.endDatetime) {
        data.endDatetime = new Date(data.endDatetime);
      }

      const classItem = await classService.update(id, data);

      res.json({
        success: true,
        data: classItem,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update class' },
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await classService.delete(id);

      res.json({
        success: true,
        data: { message: 'Class deleted successfully' },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to delete class' },
      });
    }
  }

  async getRegistrations(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const registrations = await classService.getRegistrations(id);

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

export const classController = new ClassController();

