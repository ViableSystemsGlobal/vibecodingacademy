import { Router } from 'express';
import { body } from 'express-validator';
import { cmsController } from '../../controllers/cms.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', cmsController.getAll.bind(cmsController));
router.get('/:slug', cmsController.getBySlug.bind(cmsController));
router.put(
  '/:slug',
  validate([body('content').notEmpty().withMessage('Content is required')]),
  cmsController.update.bind(cmsController)
);

export default router;

