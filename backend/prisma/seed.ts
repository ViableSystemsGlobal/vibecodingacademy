import { PrismaClient, UserRole, ClassType, ClassStatus, CourseStatus, CourseLevel } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vibecoding.com' },
    update: {},
    create: {
      email: 'admin@vibecoding.com',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create parent user
  const parentPassword = await bcrypt.hash('parent123', 10);
  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@example.com' },
    update: {},
    create: {
      email: 'parent@example.com',
      name: 'John Parent',
      passwordHash: parentPassword,
      role: UserRole.PARENT,
    },
  });

  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      phone: '+233241234567',
      whatsappNumber: '+233241234567',
      city: 'Accra',
      country: 'Ghana',
      howHeard: 'Social Media',
    },
  });
  console.log('✅ Created parent user:', parentUser.email);

  // Create students
  const student1 = await prisma.student.create({
    data: {
      parentId: parent.id,
      name: 'Emma Student',
      age: 12,
      school: 'Accra International School',
    },
  });

  const student2 = await prisma.student.create({
    data: {
      parentId: parent.id,
      name: 'David Student',
      age: 14,
      school: 'Accra International School',
    },
  });
  console.log('✅ Created students');

  // Create classes
  const freeClass = await prisma.class.create({
    data: {
      title: 'Introduction to Python',
      description: 'Learn the basics of Python programming in this free introductory class',
      type: ClassType.FREE,
      ageGroup: '9-12',
      startDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
      capacity: 20,
      priceCents: 0,
      currency: 'GHS',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      status: ClassStatus.PUBLISHED,
    },
  });

  const bootcampClass = await prisma.class.create({
    data: {
      title: 'Full Stack Web Development Bootcamp',
      description: 'Comprehensive 8-week bootcamp covering HTML, CSS, JavaScript, React, and Node.js',
      type: ClassType.BOOTCAMP,
      ageGroup: '13-16',
      startDatetime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      endDatetime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
      capacity: 15,
      priceCents: 50000, // GHS 500.00
      currency: 'GHS',
      meetingLink: 'https://meet.google.com/xyz-uvwx-rst',
      status: ClassStatus.PUBLISHED,
    },
  });
  console.log('✅ Created classes');

  // Create registrations
  await prisma.registration.create({
    data: {
      classId: freeClass.id,
      parentId: parent.id,
      studentId: student1.id,
      paymentStatus: 'NA',
      attendanceStatus: 'UNKNOWN',
    },
  });
  console.log('✅ Created registrations');

  // Create CMS blocks
  await prisma.cmsBlock.upsert({
    where: { slug: 'hero' },
    update: {},
    create: {
      slug: 'hero',
      content: {
        title: 'Welcome to Vibe Coding Academy',
        subtitle: 'Empowering the next generation of coders',
        description: 'Learn coding through interactive live classes and comprehensive on-demand courses',
        ctaText: 'Get Started',
        videoUrl: null,
      },
    },
  });

  await prisma.cmsBlock.upsert({
    where: { slug: 'faq' },
    update: {},
    create: {
      slug: 'faq',
      content: {
        items: [
          {
            question: 'What age groups do you teach?',
            answer: 'We offer classes for ages 9-16, with programs tailored to different skill levels.',
          },
          {
            question: 'Are the classes online or in-person?',
            answer: 'All our classes are conducted online via video conferencing, making them accessible from anywhere.',
          },
          {
            question: 'What do I need to participate?',
            answer: 'A computer or laptop with internet connection. We provide all learning materials and resources.',
          },
        ],
      },
    },
  });

  await prisma.cmsBlock.upsert({
    where: { slug: 'testimonials' },
    update: {},
    create: {
      slug: 'testimonials',
      content: {
        items: [
          {
            name: 'Sarah M.',
            role: 'Parent',
            text: 'My daughter loves the classes! The instructors are patient and make coding fun.',
          },
          {
            name: 'Michael K.',
            role: 'Parent',
            text: 'Great value for money. The bootcamp really helped my son develop his coding skills.',
          },
        ],
      },
    },
  });
  console.log('✅ Created CMS blocks');

  // Create a course
  const course = await prisma.course.create({
    data: {
      title: 'Python for Beginners',
      slug: 'python-for-beginners',
      description: 'Learn Python programming from scratch',
      level: CourseLevel.BEGINNER,
      recommendedAgeMin: 10,
      recommendedAgeMax: 14,
      status: CourseStatus.PUBLISHED,
    },
  });

  const module1 = await prisma.courseModule.create({
    data: {
      courseId: course.id,
      title: 'Getting Started with Python',
      orderIndex: 1,
    },
  });

  await prisma.lesson.create({
    data: {
      moduleId: module1.id,
      title: 'Introduction to Python',
      videoUrl: 'https://www.youtube.com/watch?v=demo',
      description: 'Learn what Python is and why it\'s a great first programming language',
      orderIndex: 1,
    },
  });
  console.log('✅ Created course and lessons');

  // Create email templates
  await prisma.emailTemplate.upsert({
    where: { key: 'registration_free' },
    update: {},
    create: {
      key: 'registration_free',
      subject: 'Registration Confirmed - {{class_title}}',
      htmlBody: `
        <h2>Registration Confirmed!</h2>
        <p>Hello {{parent_name}},</p>
        <p>{{student_name}} has been successfully registered for {{class_title}}.</p>
        <p><strong>Class Date:</strong> {{start_time}}</p>
        <p><strong>Meeting Link:</strong> <a href="{{meeting_link}}">{{meeting_link}}</a></p>
        <p>We look forward to seeing you in class!</p>
      `,
      isActive: true,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: 'bootcamp_pending' },
    update: {},
    create: {
      key: 'bootcamp_pending',
      subject: 'Bootcamp Registration - Payment Required',
      htmlBody: `
        <h2>Bootcamp Registration Received</h2>
        <p>Hello {{parent_name}},</p>
        <p>{{student_name}} has been registered for {{class_title}}.</p>
        <p><strong>Amount Due:</strong> GHS {{amount}}</p>
        <p>Please complete payment to confirm your registration.</p>
      `,
      isActive: true,
    },
  });
  console.log('✅ Created email templates');

  console.log('\n🎉 Database seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@vibecoding.com / admin123');
  console.log('   Parent: parent@example.com / parent123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

