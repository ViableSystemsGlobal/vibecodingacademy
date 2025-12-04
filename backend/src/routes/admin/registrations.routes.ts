import { Router } from 'express';
import { registrationController } from '../../controllers/registration.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole, PaymentStatus } from '@prisma/client';
import { exportService } from '../../services/export.service';
import { CsvExport } from '../../utils/csv-export';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', registrationController.getAll.bind(registrationController));
router.get('/class/:classId', registrationController.getByClass.bind(registrationController));
router.get('/:id', registrationController.getById.bind(registrationController));
router.put('/:id', registrationController.update.bind(registrationController));
router.put('/attendance/bulk', registrationController.bulkUpdateAttendance.bind(registrationController));

// Export registrations to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const classId = req.query.classId as string | undefined;
    const paymentStatus = req.query.paymentStatus as PaymentStatus | undefined;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const csvString = await exportService.exportRegistrations({
      classId,
      paymentStatus,
      dateFrom,
      dateTo,
    });

    const csvBuffer = CsvExport.toCSVWithBOM(csvString);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registrations-${Date.now()}.csv"`);
    res.send(csvBuffer);
  } catch (error: any) {
    console.error('Error exporting registrations:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to export registrations' },
    });
  }
});

export default router;

