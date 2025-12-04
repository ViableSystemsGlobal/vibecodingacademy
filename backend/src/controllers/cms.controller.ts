import { Request, Response } from 'express';
import { cmsService } from '../services/cms.service';

export class CmsController {
  async getAll(req: Request, res: Response) {
    try {
      const blocks = await cmsService.getAllBlocks();
      res.json({
        success: true,
        data: blocks,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch CMS blocks' },
      });
    }
  }

  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const block = await cmsService.getBlock(slug);
      
      if (!block) {
        return res.status(404).json({
          success: false,
          error: { message: 'CMS block not found' },
        });
      }

      res.json({
        success: true,
        data: block,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch CMS block' },
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const { content } = req.body;

      const block = await cmsService.upsertBlock(slug, content);

      res.json({
        success: true,
        data: block,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to update CMS block' },
      });
    }
  }
}

export const cmsController = new CmsController();

