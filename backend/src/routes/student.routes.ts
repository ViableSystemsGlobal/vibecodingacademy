import { Router } from 'express';
import { lmsService } from '../services/lms.service';
import { authenticate } from '../middleware/auth';
import prisma from '../config/database';

const router = Router();

router.use(authenticate);

// Get student dashboard
router.get('/dashboard', async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Find student(s) for this user (via parent)
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: {
        students: {
          include: {
            registrations: {
              include: {
                class: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: { message: 'Parent record not found' },
      });
    }

    // Get upcoming classes
    const upcomingClasses = parent.students.flatMap((student) =>
      student.registrations
        .filter((reg) => new Date(reg.class.startDatetime) > new Date())
        .map((reg) => ({
          ...reg.class,
          studentName: student.name,
        }))
    );

    // Get available courses for first student (or all students)
    const courses = await Promise.all(
      parent.students.map((student) => lmsService.getStudentCourses(student.id))
    );

    res.json({
      success: true,
      data: {
        upcomingClasses,
        courses: courses.flat(),
        students: parent.students,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch dashboard' },
    });
  }
});

router.get('/courses', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { students: true },
    });

    if (!parent || parent.students.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Get courses for first student (or you could allow selecting a student)
    const courses = await lmsService.getStudentCourses(parent.students[0].id);

    res.json({
      success: true,
      data: courses,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch courses' },
    });
  }
});

router.get('/courses/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const course = await lmsService.getCourseById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        error: { message: 'Course not found' },
      });
    }

    res.json({
      success: true,
      data: course,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch course' },
    });
  }
});

router.get('/lessons/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: true,
          },
        },
        resources: true,
      },
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: { message: 'Lesson not found' },
      });
    }

    res.json({
      success: true,
      data: lesson,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch lesson' },
    });
  }
});

router.post('/lessons/:id/progress', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Get student ID from parent
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { students: true },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Student not found' },
      });
    }

    const progress = await lmsService.updateLessonProgress(
      parent.students[0].id,
      id,
      status
    );

    res.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update progress' },
    });
  }
});

export default router;

