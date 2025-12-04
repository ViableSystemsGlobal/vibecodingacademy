import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';

export class DashboardController {
  async getSummary(req: Request, res: Response) {
    try {
      const summary = await dashboardService.getSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch dashboard data' },
      });
    }
  }
}

export const dashboardController = new DashboardController();

