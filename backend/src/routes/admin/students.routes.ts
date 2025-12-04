import { Router } from 'express';
import { studentController } from '../../controllers/student.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '@prisma/client';
import { exportService } from '../../services/export.service';
import { CsvExport } from '../../utils/csv-export';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', studentController.getAll.bind(studentController));
router.get('/:id', studentController.getById.bind(studentController));

// Export students to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const parentId = req.query.parentId as string | undefined;
    const csvString = await exportService.exportStudents(search, parentId);

    const csvBuffer = CsvExport.toCSVWithBOM(csvString);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="students-${Date.now()}.csv"`);
    res.send(csvBuffer);
  } catch (error: any) {
    console.error('Error exporting students:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to export students' },
    });
  }
});

export default router;

