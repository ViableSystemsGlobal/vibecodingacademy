import { Router } from 'express';
import { body } from 'express-validator';
import { lmsService } from '../../services/lms.service';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import prisma from '../../config/database';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as any;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await lmsService.getAllCourses({ status }, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch courses' },
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const course = await lmsService.getCourseById(req.params.id);
    res.json({
      success: true,
      data: course,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: { message: error.message || 'Course not found' },
    });
  }
});

router.post(
  '/',
  validate([
    body('title').trim().notEmpty(),
    body('slug').trim().notEmpty(),
    body('level').isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  ]),
  async (req, res) => {
    try {
      const course = await lmsService.createCourse(req.body);
      res.status(201).json({
        success: true,
        data: course,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to create course' },
      });
    }
  }
);

router.put('/:id', async (req, res) => {
  try {
    const course = await lmsService.updateCourse(req.params.id, req.body);
    res.json({
      success: true,
      data: course,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update course' },
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await lmsService.deleteCourse(req.params.id);
    res.json({
      success: true,
      data: { message: 'Course deleted' },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to delete course' },
    });
  }
});

// Module management
router.post('/:id/modules', async (req, res) => {
  try {
    const module = await prisma.courseModule.create({
      data: {
        courseId: req.params.id,
        title: req.body.title,
        orderIndex: req.body.orderIndex || 0,
      },
    });
    res.status(201).json({
      success: true,
      data: module,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to create module' },
    });
  }
});

router.put('/modules/:id', async (req, res) => {
  try {
    const module = await prisma.courseModule.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({
      success: true,
      data: module,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update module' },
    });
  }
});

router.delete('/:courseId/modules/:id', async (req, res) => {
  try {
    await prisma.courseModule.delete({
      where: { id: req.params.id },
    });
    res.json({
      success: true,
      data: { message: 'Module deleted' },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to delete module' },
    });
  }
});

// Lesson management
router.post('/modules/:id/lessons', async (req, res) => {
  try {
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: req.params.id,
        title: req.body.title,
        videoUrl: req.body.videoUrl,
        description: req.body.description,
        orderIndex: req.body.orderIndex || 0,
      },
    });
    res.status(201).json({
      success: true,
      data: lesson,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to create lesson' },
    });
  }
});

router.put('/lessons/:id', async (req, res) => {
  try {
    const lesson = await prisma.lesson.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({
      success: true,
      data: lesson,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update lesson' },
    });
  }
});

router.delete('/lessons/:id', async (req, res) => {
  try {
    await prisma.lesson.delete({
      where: { id: req.params.id },
    });
    res.json({
      success: true,
      data: { message: 'Lesson deleted' },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to delete lesson' },
    });
  }
});

// Lesson resources
router.post('/lessons/:id/resources', async (req, res) => {
  try {
    const resource = await prisma.lessonResource.create({
      data: {
        lessonId: req.params.id,
        type: req.body.type,
        label: req.body.label,
        urlOrPath: req.body.urlOrPath,
      },
    });
    res.status(201).json({
      success: true,
      data: resource,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to create resource' },
    });
  }
});

export default router;

