import { Router } from 'express';
import parentsRoutes from './parents.routes';
import studentsRoutes from './students.routes';
import classesRoutes from './classes.routes';
import cmsRoutes from './cms.routes';
import registrationsRoutes from './registrations.routes';
import paymentsRoutes from './payments.routes';
import dashboardRoutes from './dashboard.routes';
import coursesRoutes from './courses.routes';
import settingsRoutes from './settings.routes';
import templatesRoutes from './templates.routes';
import paymentAttemptsRoutes from './payment-attempts.routes';
import notificationLogsRoutes from './notification-logs.routes';
import paymentRemindersRoutes from './payment-reminders.routes';

const router = Router();

router.use('/parents', parentsRoutes);
router.use('/students', studentsRoutes);
router.use('/classes', classesRoutes);
router.use('/cms', cmsRoutes);
router.use('/registrations', registrationsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/courses', coursesRoutes);
router.use('/settings', settingsRoutes);
router.use('/templates', templatesRoutes);
router.use('/payment-attempts', paymentAttemptsRoutes);
router.use('/notification-logs', notificationLogsRoutes);
router.use('/payment-reminders', paymentRemindersRoutes);

export default router;

