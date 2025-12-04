import { Router } from 'express';
import { paymentAttemptController } from '../../controllers/payment-attempt.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', paymentAttemptController.getAll.bind(paymentAttemptController));
router.get('/:id', paymentAttemptController.getById.bind(paymentAttemptController));
router.put('/:id/notes', paymentAttemptController.updateNotes.bind(paymentAttemptController));
router.put('/:id/cancel', paymentAttemptController.cancel.bind(paymentAttemptController));

export default router;

