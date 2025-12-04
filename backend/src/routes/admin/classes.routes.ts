import { Router } from 'express';
import { body } from 'express-validator';
import { classController } from '../../controllers/class.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', classController.getAll.bind(classController));
router.get('/:id', classController.getById.bind(classController));
router.get('/:id/registrations', classController.getRegistrations.bind(classController));

router.post(
  '/',
  validate([
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('type').isIn(['FREE', 'BOOTCAMP']).withMessage('Type must be FREE or BOOTCAMP'),
    body('startDatetime').isISO8601().withMessage('Valid start datetime is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('priceCents').optional().isInt({ min: 0 }),
  ]),
  classController.create.bind(classController)
);

router.put(
  '/:id',
  validate([
    body('title').optional().trim().notEmpty(),
    body('type').optional().isIn(['FREE', 'BOOTCAMP']),
    body('startDatetime').optional().isISO8601(),
    body('capacity').optional().isInt({ min: 1 }),
    body('priceCents').optional().isInt({ min: 0 }),
  ]),
  classController.update.bind(classController)
);

router.delete('/:id', classController.delete.bind(classController));

export default router;

