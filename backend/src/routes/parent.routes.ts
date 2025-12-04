import { Router } from 'express';
import { parentPortalService } from '../services/parent-portal.service';
import { authenticate } from '../middleware/auth';
import { requireParent } from '../middleware/parent-scope';

const router = Router();

router.use(authenticate);
router.use(requireParent);

router.get('/dashboard', async (req: any, res) => {
  try {
    const parentId = req.parentId;
    const dashboard = await parentPortalService.getDashboard(parentId);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch dashboard' },
    });
  }
});

router.get('/children', async (req: any, res) => {
  try {
    const parentId = req.parentId;
    const children = await parentPortalService.getChildren(parentId);

    res.json({
      success: true,
      data: children,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch children' },
    });
  }
});

router.get('/registrations', async (req: any, res) => {
  try {
    const parentId = req.parentId;
    const studentId = req.query.studentId as string | undefined;
    const registrations = await parentPortalService.getRegistrations(parentId, studentId);

    res.json({
      success: true,
      data: registrations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch registrations' },
    });
  }
});

router.get('/payments', async (req: any, res) => {
  try {
    const parentId = req.parentId;
    const studentId = req.query.studentId as string | undefined;
    const payments = await parentPortalService.getPayments(parentId, studentId);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch payments' },
    });
  }
});

export default router;

