# Vibe Coding Academy - Full Stack Platform

A comprehensive coding academy platform with live classes, on-demand courses, parent and student portals, and admin management.

## Architecture

- **Backend**: Express.js REST API with TypeScript
- **Frontend**: Next.js 14+ with App Router and Shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Dockerized for EasyPanel on Hostinger VPS

## Features

### Module 1: Authentication & Users
- Admin and Parent login
- JWT-based authentication
- Password reset via email

### Module 2: Parents & Students
- Parent and student management
- Admin CRUD interfaces

### Module 3: Classes & Schedule Management
- Create/edit/delete classes
- Free classes and paid bootcamps
- Capacity management

### Module 4: Public Sales Landing & CMS
- Public landing page
- CMS for hero, FAQ, testimonials
- Class listing and detail pages

### Module 5: Registration & Enrolment
- Public registration form
- Multi-student registration
- Admin registration management

### Module 6: Payments
- Paystack integration
- Payment webhooks
- Manual payment tracking

### Module 7: Notifications
- Email notifications (Hostinger SMTP)
- SMS notifications (Deywuro)
- Automated class reminders (24h and 1h before)
- Email and SMS templates

### Module 8: Admin Dashboard
- KPI cards (parents, students, revenue, etc.)
- Registration charts
- Upcoming classes overview

### Module 9: Parent Portal
- Dashboard with children overview
- Children management
- Registrations and payments view

### Module 10: LMS Engine
- Course builder (courses → modules → lessons)
- Video lessons with resources
- Student progress tracking

### Module 11: Student Portal
- Dashboard combining live classes and courses
- Course navigation
- Lesson player with progress tracking

### Module 12: Course Access Rules
- Configurable access rules
- Free courses vs. paid bootcamp courses
- Access based on registrations

### Module 13: Settings & Integrations
- SMTP configuration
- Deywuro SMS configuration
- Paystack keys management
- Test email/SMS functionality

### Module 14: Infrastructure
- Dockerfiles for backend and frontend
- Docker Compose setup
- Automated class reminder cron jobs
- Database backup scripts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker (optional, for containerized deployment)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Setup database:
```bash
npx prisma generate
npx prisma migrate dev
```

5. Run development server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. Run development server:
```bash
npm run dev
```

### Docker Setup

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

2. Run database migrations:
```bash
docker-compose exec backend npx prisma migrate deploy
```

## Project Structure

```
vibecodingacademy/
├── backend/
│   ├── src/
│   │   ├── config/         # Database and env config
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Helpers
│   │   └── jobs/           # Cron jobs
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── Dockerfile
├── frontend/
│   ├── app/                # Next.js app router
│   │   ├── (admin)/        # Admin portal
│   │   ├── (parent)/       # Parent portal
│   │   ├── (student)/      # Student portal
│   │   └── (public)/       # Public pages
│   ├── components/         # React components
│   │   ├── ui/             # Shadcn components
│   │   └── providers/      # Context providers
│   └── lib/                # Utilities
└── docker-compose.yml
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register-admin` - Register admin
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `GET /auth/me` - Get current user

### Admin Routes
- `GET /admin/parents` - List parents
- `GET /admin/students` - List students
- `GET /admin/classes` - List classes
- `GET /admin/registrations` - List registrations
- `GET /admin/payments` - List payments
- `GET /admin/dashboard/summary` - Dashboard data
- `GET /admin/courses` - List courses
- `GET /admin/settings` - Get settings

### Public Routes
- `GET /public/landing` - Landing page data
- `GET /public/classes` - List published classes
- `POST /public/register` - Create registration

### Parent Routes
- `GET /parent/dashboard` - Parent dashboard
- `GET /parent/children` - List children
- `GET /parent/registrations` - List registrations
- `GET /parent/payments` - List payments

### Student Routes
- `GET /student/dashboard` - Student dashboard
- `GET /student/courses` - List accessible courses
- `GET /student/lessons/:id` - Get lesson
- `POST /student/lessons/:id/progress` - Update progress

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/vibe_coding_academy
PORT=3001
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
SMTP_HOST=smtp.hostinger.com
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
DEYWURO_API_KEY=your-api-key
PAYSTACK_SECRET_KEY=your-secret-key
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Deployment

The project is configured for deployment on EasyPanel with Hostinger VPS:

1. Build Docker images
2. Configure environment variables
3. Run database migrations
4. Start services with Docker Compose
5. Configure cron jobs for reminders
6. Setup database backups

## License

ISC

