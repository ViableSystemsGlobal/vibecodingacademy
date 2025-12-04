import { Router } from 'express';
import { paymentController } from '../../controllers/payment.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole, PaymentStatus } from '@prisma/client';
import { exportService } from '../../services/export.service';
import { CsvExport } from '../../utils/csv-export';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', paymentController.getAll.bind(paymentController));
router.put('/:id/status', paymentController.updateStatus.bind(paymentController));

// Export payments to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const registrationId = req.query.registrationId as string | undefined;
    const status = req.query.status as PaymentStatus | undefined;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const csvString = await exportService.exportPayments({
      registrationId,
      status,
      dateFrom,
      dateTo,
    });

    const csvBuffer = CsvExport.toCSVWithBOM(csvString);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
    res.send(csvBuffer);
  } catch (error: any) {
    console.error('Error exporting payments:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to export payments' },
    });
  }
});

export default router;

