Vibe Coding Academy – Full Module Breakdown (with Portals + Simple LMS)
Tech assumptions (same as you said)

Backend: Node (Express/Nest) or Laravel – REST style

DB: Postgres or MySQL

Frontend: React/Next.js (public site + admin + portals)

Infra: EasyPanel on Hostinger VPS (Dockerized)

Email: Hostinger SMTP

SMS: Deywuro

Module 1 – Authentication & Users

Goal: Secure Admin + Parent + (future) Instructor access.

Features

Admin login (email/password)

Parent login (email/password)

(Optional later) Instructor login

Password reset via email

Core Tables

users

id (uuid)

name

email (unique)

password_hash

role (admin, parent, instructor)

created_at, updated_at

password_resets

id

user_id

token

expires_at

Key Endpoints

POST /auth/register-admin (seed once or via script)

POST /auth/login

POST /auth/forgot-password

POST /auth/reset-password

GET /auth/me

Module 2 – Parents & Students

Goal: Treat parents as customers and students as learners.

Features

Store parent contact + context

Store student data linked to a parent

One parent → multiple students

Tables

parents

id

user_id (FK → users.id, role = parent)

phone

whatsapp_number

city

country

how_heard (text/enum)

created_at, updated_at

students

id

parent_id (FK → parents.id)

name

age

school

notes

created_at, updated_at

Key Endpoints

GET /admin/parents

GET /admin/parents/:id

GET /admin/students

GET /admin/students/:id

Admin UI: “Parents” and “Students” tables with search.

Module 3 – Classes & Schedule Management

Goal: Define live sessions: free intro classes + paid bootcamps.

Features

Create/edit/delete classes

Set capacity, price, link, age group

Publish/hide classes from public sales page

Table

classes

id

title

description

type (free, bootcamp)

age_group (9-12, 13-16, etc.)

start_datetime

end_datetime or duration_minutes

capacity

price_cents (0 for free)

currency (GHS, USD, etc.)

meeting_link

status (draft, published, archived)

created_at, updated_at

Key Endpoints

GET /admin/classes

POST /admin/classes

GET /admin/classes/:id

PUT /admin/classes/:id

DELETE /admin/classes/:id

GET /admin/classes/:id/registrations

Admin UI: “Classes” page + detail view with enrolled students.

Module 4 – Public Sales Landing & CMS

Goal: Convert parents into free-class or bootcamp registrations.

Features

Hero with video + CTAs

Upcoming class selector (Free / Bootcamp)

CMS for headlines, FAQ, testimonials

Table

cms_blocks

id

slug (e.g. hero, faq, testimonials)

content (JSON or text)

updated_at

Public Endpoints

GET /public/landing → returns:

hero content

key sections (FAQ, testimonials)

featured classes (from classes where status = published)

GET /public/classes?type=free|bootcamp

GET /public/classes/:id

Admin CMS Endpoints

GET /admin/cms

PUT /admin/cms/:slug

Admin UI: “Site Content” page to edit hero, FAQ, testimonials.

Module 5 – Registration & Enrolment

Goal: When a parent chooses a class, capture data & create enrolment records.

Flow

Parent clicks “Enroll” on a class.

Fills parent details + 1–3 students.

Free class → immediate confirmation.

Bootcamp → create registration + payment pending.

Tables

Already defined: parents, students, classes.

registrations

id

class_id (FK → classes.id)

parent_id (FK → parents.id)

student_id (FK → students.id)

registration_source (landing_page, manual_admin)

payment_status (n/a, pending, paid, failed, refunded)

attendance_status (unknown, attended, absent)

created_at, updated_at

Public Endpoint

POST /public/register

payload: parent info, student(s), class_id

Admin Endpoints

GET /admin/registrations

GET /admin/registrations/:id

PUT /admin/registrations/:id (update payment/attendance)

Admin UI: “Registrations” with filters by class, status, date.

Module 6 – Payments (for Bootcamps)

Goal: Track revenue & payment status, even if you start with manual payments.

Features

Price is stored on classes

Support:

manual payment (MoMo, bank transfer)

later: online payment gateway (Stripe/Paystack/Flutterwave)

Admin can mark as paid

Table

payments

id

registration_id (FK → registrations.id)

amount_cents

currency

provider (manual, stripe, paystack, etc.)

provider_reference (transaction_id / reference)

status (pending, successful, failed, refunded)

paid_at

created_at, updated_at

Endpoints

GET /admin/payments

PUT /admin/registrations/:id/payment-status (manual update)

(If gateway) POST /public/checkout, POST /webhooks/payment

Admin UI: “Payments” page; quick summary in dashboard.

Module 7 – Notifications (Deywuro SMS + Hostinger SMTP)

Goal: Central service for emails + SMS.

Events

Registration created (free class)

Registration created (bootcamp – with pending payment info)

Payment confirmed (bootcamp)

Class reminder (24h before, 1h before)

Class time/meeting link change

Tables

email_templates

id

key (registration_free, bootcamp_payment_success, etc.)

subject

html_body

is_active

sms_templates

id

key

content (e.g. "Hi {{parent_name}}, {{student_name}} is booked for {{class_title}} on {{start_time}}. Link: {{meeting_link}}")

is_active

notification_logs

id

type (email, sms)

to_address (email or phone)

template_key

payload_json

status (success, failed)

error_message

sent_at

Integration

SMS: Deywuro API (env: DEYWURO_API_KEY, DEYWURO_SENDER)

Email: Hostinger SMTP (env: SMTP_HOST, SMTP_USER, etc.)

Endpoints (Admin)

GET /admin/templates/email

PUT /admin/templates/email/:id

GET /admin/templates/sms

PUT /admin/templates/sms/:id

GET /admin/notifications/logs (optional)

Admin UI: “Notification Templates” page.

Module 8 – Admin Dashboard & Reporting

Goal: Quick cockpit for you.

Features

KPI cards:

Total parents

Total students

Registrations last 7 days

Free vs Paid registrations

Total revenue

Upcoming classes (next 7 days, with seats left)

Endpoint

GET /admin/dashboard/summary

Returns:

counts (parents, students, classes, registrations, revenue)

registrations_over_time (for chart)

upcoming_classes

Admin UI: simple cards + small chart + upcoming classes list.

Module 9 – Parent Portal

Goal: Let parents see everything related to their kids in one place.

Parent = user with role = parent.

Features

Login / logout

Dashboard:

Children list

Upcoming classes per child

Status (free class booked, bootcamp paid, payment pending)

View registrations and join links

View payments & receipts

Endpoints (Parent-scoped)

GET /parent/dashboard

GET /parent/children

GET /parent/children/:id/registrations

GET /parent/registrations

GET /parent/payments

UI

Sidebar:

Dashboard

My Children

Classes (all registrations)

Payments

Settings (change password, phone, WhatsApp)

Module 10 – LMS Engine (Courses + Lessons + Progress)

Goal: Power on-demand learning; Student Portal will sit on top of this.

Structure

Course → made of Modules → made of Lessons.

Tables

courses

id

title

slug

description

level (beginner, intermediate)

recommended_age_min

recommended_age_max

status (draft, published)

created_at, updated_at

course_modules

id

course_id (FK → courses.id)

title

order_index

lessons

id

module_id (FK → course_modules.id)

title

video_url (YouTube unlisted / Vimeo)

description

order_index

lesson_resources

id

lesson_id (FK)

type (link, file)

label

url_or_path

student_lesson_progress

id

student_id (FK → students.id)

lesson_id (FK → lessons.id)

status (not_started, in_progress, completed)

last_viewed_at

completed_at

Optionally later:

lesson_quizzes with questions JSON.

Admin Endpoints

GET /admin/courses

POST /admin/courses

GET /admin/courses/:id

PUT /admin/courses/:id

DELETE /admin/courses/:id

POST /admin/courses/:id/modules

PUT /admin/modules/:id

POST /admin/modules/:id/lessons

PUT /admin/lessons/:id

Student Endpoints

GET /student/courses (available to that student)

GET /student/courses/:id

GET /student/lessons/:id

POST /student/lessons/:id/progress (e.g. { status: "completed" })

Module 11 – Student Portal (On Top of LMS + Live Classes)

Goal: Give each student a space to see live classes + on-demand courses.

To keep it simple, you can:

Either give students their own login later, or

Let parents “view as student” for v1.

Features

Student Dashboard:

Upcoming live classes (from classes + registrations)

On-demand courses list (from courses via LMS module)

Progress summary (e.g., 20% complete)

Course View:

List of modules & lessons

Selected lesson with video + text + resources

Button: “Mark as complete”

Live Class View:

Next upcoming class, date/time, join link

Brief requirements (e.g. laptop, internet, etc.)

Endpoints (Student-Scoped)

Reusing LMS + registration info:

GET /student/dashboard

Combines:

upcoming classes via registrations

available courses via LMS

GET /student/classes

GET /student/courses

GET /student/courses/:id

GET /student/lessons/:id

POST /student/lessons/:id/progress

UI

Sidebar:

Dashboard

Live Classes

My Courses

Resources (links, docs)

Module 12 – Access Rules for Courses

Goal: Define which student sees which course, without over-complicating.

Simple Strategy

Some courses are free for any registered student.

Some are unlocked by:

Attending a free live class, or

Paying for a bootcamp.

Implementation Options

Option A (Simplest – Logic Only)

In code:

If student has any registration with payment_status = 'paid' and class.type = 'bootcamp' → unlock advanced course(s).

Otherwise show only free/basic course.

Option B (Config Table)
course_access_rules

id

course_id

required_type (any_registration, paid_bootcamp, specific_class)

required_class_id (nullable)

The LMS service checks these rules when returning GET /student/courses.

Module 13 – Settings & Integrations

Goal: Central place to manage keys & platform-wide options.

Table

settings

key (smtp_host, deywuro_api_key, timezone, currency, etc.)

value

type (string, bool, number)

updated_at

Endpoints

GET /admin/settings

PUT /admin/settings

Admin UI:

Tabs: General, Notifications, Payments

“Send test email” / “Send test SMS” actions.

Module 14 – Infrastructure & Automation (EasyPanel + VPS)

Goal: Make this deployable & maintainable.

Components

Dockerfile:

Builds backend + frontend

Env-driven config

DB:

Postgres/MySQL via EasyPanel or Hostinger service

Cron Jobs:

Reminder sender:

Every 10–15 mins:

Find classes within next 24h → send CLASS_REMINDER_24H

Within next 1h → send CLASS_REMINDER_1H

Backups:

Daily DB dump to secured location.

We would integrate Paystack for payments