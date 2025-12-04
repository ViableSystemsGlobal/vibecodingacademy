import { Request, Response } from 'express';
import { studentService } from '../services/student.service';

export class StudentController {
  async getAll(req: Request, res: Response) {
    try {
      const search = req.query.search as string | undefined;
      const parentId = req.query.parentId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await studentService.getAllStudents(search, parentId, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch students' },
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const student = await studentService.getStudentById(id);

      res.json({
        success: true,
        data: student,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: { message: error.message || 'Student not found' },
      });
    }
  }
}

export const studentController = new StudentController();

