import { Request, Response } from 'express';
import { parentService } from '../services/parent.service';

export class ParentController {
  async getAll(req: Request, res: Response) {
    try {
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await parentService.getAllParents(search, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch parents' },
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parent = await parentService.getParentById(id);

      res.json({
        success: true,
        data: parent,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: { message: error.message || 'Parent not found' },
      });
    }
  }
}

export const parentController = new ParentController();

