# Complete Testing Guide
**End-to-End Testing Checklist for Vibe Coding Academy**

This guide walks you through testing every feature of the platform to ensure everything works correctly before going live.

---

## 🎯 Testing Overview

We'll test these main user journeys:
1. **Public Registration Flow** (New parent registers child)
2. **Payment Processing** (Paystack integration)
3. **Admin Operations** (Managing the platform)
4. **Parent Portal** (Parent viewing their data)
5. **Student Portal** (Student accessing courses)
6. **Notifications** (Email & SMS)
7. **CMS Management** (Content updates)
8. **Class Management** (Creating and managing classes)

---

## 📋 Pre-Testing Setup

### 1. Prepare Test Data

**Admin Account:**
- Email: `admin@test.com`
- Password: (your admin password)

**Test Parent Account:**
- Name: `Test Parent`
- Email: `parent@test.com`
- Phone: `+233241234567`

**Test Student:**
- Name: `Test Student`
- Age: `12`
- School: `Test School`

### 2. Test Payment Setup

**For Paystack Testing:**
- Use **TEST keys** (not live keys)
- Test Public Key: `pk_test_...`
- Test Secret Key: `sk_test_...`
- Use test card: `4084084084084081` (Visa) or `5060666666666666666` (Verve)
- CVV: Any 3 digits
- Expiry: Any future date
- PIN: `0000` (for Nigerian cards) or any 4 digits

---

## 🧪 Test 1: Public Registration Flow

### Step 1.1: Visit Landing Page
- [ ] Open `http://localhost:3004` (or your domain)
- [ ] Verify landing page loads correctly
- [ ] Check logo displays (if uploaded)
- [ ] Verify hero section shows (title, subtitle, video)
- [ ] Check testimonials section displays
- [ ] Verify "Experts" section displays (if configured)
- [ ] Check FAQ section (if configured)
- [ ] Verify featured classes are displayed

### Step 1.2: View Class Details
- [ ] Click on a featured class
- [ ] Verify class details page loads
- [ ] Check class information displays correctly
- [ ] Verify "Register Now" button is visible
- [ ] Go back to landing page

### Step 1.3: Fill Registration Form
- [ ] Scroll to registration form
- [ ] Select registration type: **Bootcamp** or **Free Class**
- [ ] Fill in parent information:
  - [ ] Parent Name: `Test Parent`
  - [ ] Email: `parent@test.com`
  - [ ] Phone: `+233241234567`
  - [ ] City: `Accra`
- [ ] Add child information:
  - [ ] Child Name: `Test Student`
  - [ ] Age: `12`
  - [ ] School: `Test School`
- [ ] If Free Class: Select a class from dropdown
- [ ] Verify form validation works (try submitting empty form)

### Step 1.4: Submit Registration
- [ ] Click "Register Now"
- [ ] If Bootcamp: Should redirect to classes page
- [ ] If Free Class: Should show success message
- [ ] Check email inbox for welcome email (if configured)
- [ ] Verify registration appears in admin panel

**Expected Result:** ✅ Registration created successfully, email sent (if configured)

---

## 💳 Test 2: Payment Processing Flow

### Step 2.1: Register for Paid Bootcamp
- [ ] Complete registration for a **paid bootcamp class**
- [ ] After registration, you should be redirected to payment page
- [ ] Verify payment amount is correct
- [ ] Check class details are displayed

### Step 2.2: Process Test Payment
- [ ] Click "Pay Now" or payment button
- [ ] Paystack popup should open
- [ ] Enter test card details:
  - Card Number: `4084084084084081`
  - CVV: `123`
  - Expiry: `12/25` (any future date)
  - PIN: `0000` (if required)
- [ ] Click "Pay"
- [ ] Verify payment success message
- [ ] Check redirect to success page

### Step 2.3: Verify Payment in Admin
- [ ] Log in to admin panel: `/admin/login`
- [ ] Go to **Payments** page
- [ ] Find the payment you just made
- [ ] Verify payment status is **PAID**
- [ ] Check payment amount is correct
- [ ] Verify payment method shows **PAYSTACK**
- [ ] Check payment date/time is correct

### Step 2.4: Verify Registration Status
- [ ] Go to **Registrations** page
- [ ] Find the registration
- [ ] Verify status is **CONFIRMED** (after payment)
- [ ] Check payment is linked to registration

### Step 2.5: Test Payment Webhook (If Configured)
- [ ] Check backend logs for webhook call
- [ ] Verify webhook signature validation
- [ ] Confirm payment status updated via webhook

**Expected Result:** ✅ Payment processed, status updated, registration confirmed

---

## 👨‍💼 Test 3: Admin Operations

### Step 3.1: Admin Login
- [ ] Go to `/admin/login`
- [ ] Enter admin credentials
- [ ] Click "Login"
- [ ] Verify redirect to dashboard
- [ ] Check admin sidebar displays correctly
- [ ] Verify logo shows in sidebar (if uploaded)

### Step 3.2: Dashboard Overview
- [ ] Check dashboard loads
- [ ] Verify KPI cards display:
  - [ ] Total Parents
  - [ ] Total Students
  - [ ] Total Revenue
  - [ ] Total Registrations
- [ ] Check charts display:
  - [ ] Registration trends
  - [ ] Revenue trends
  - [ ] Monthly revenue
  - [ ] Attendance breakdown
  - [ ] Popular classes
- [ ] Verify upcoming classes list

### Step 3.3: Manage Parents
- [ ] Go to **Parents** page
- [ ] Verify parent list loads
- [ ] Check search/filter works
- [ ] Click on a parent to view details
- [ ] Verify parent information displays
- [ ] Check children list for parent
- [ ] Test export to CSV

### Step 3.4: Manage Students
- [ ] Go to **Students** page
- [ ] Verify student list loads
- [ ] Check search/filter works
- [ ] Click on a student to view details
- [ ] Verify student information displays
- [ ] Check registrations for student
- [ ] Test export to CSV

### Step 3.5: Manage Classes
- [ ] Go to **Classes** page
- [ ] Click "Create New Class"
- [ ] Fill in class details:
  - Title: `Test Class`
  - Type: `BOOTCAMP` or `FREE`
  - Start Date/Time: Future date
  - Capacity: `20`
  - Price: `10000` (if bootcamp)
- [ ] Save class
- [ ] Verify class appears in list
- [ ] Click on class to view details
- [ ] Check "Mark Attendance" button (if class has started)

### Step 3.6: Manage Registrations
- [ ] Go to **Registrations** page
- [ ] Verify registration list loads
- [ ] Check filters work (status, class, date)
- [ ] Click on a registration to view details
- [ ] Verify all information displays correctly
- [ ] Test export to CSV
- [ ] Check bulk actions (if available)

### Step 3.7: Manage Payments
- [ ] Go to **Payments** page
- [ ] Verify payment list loads
- [ ] Check filters work (status, method, date)
- [ ] Click on a payment to view details
- [ ] Verify payment information displays
- [ ] Test export to CSV

### Step 3.8: Payment Reminders
- [ ] Go to **Payment Reminders** page
- [ ] Verify pending payments list loads
- [ ] Check statistics display correctly
- [ ] Select a payment
- [ ] Click "Send Reminder"
- [ ] Verify reminder sent successfully
- [ ] Check notification logs

### Step 3.9: Attendance Tracking
- [ ] Go to a class detail page
- [ ] Click "Mark Attendance"
- [ ] Verify attendance page loads
- [ ] Check statistics display:
  - [ ] Total registered
  - [ ] Present count
  - [ ] Absent count
- [ ] Mark some students as present
- [ ] Mark some as absent
- [ ] Use bulk actions if available
- [ ] Click "Save Changes"
- [ ] Verify attendance saved
- [ ] Check statistics update

### Step 3.10: CMS Management
- [ ] Go to **CMS** page
- [ ] Select **Hero** tab
- [ ] Update title: `New Test Title`
- [ ] Update subtitle: `New Test Subtitle`
- [ ] Update video URL
- [ ] Click "Save Hero Section"
- [ ] Verify success message
- [ ] Check preview updates
- [ ] Refresh page - verify changes persist
- [ ] Test **Testimonials** tab:
  - [ ] Add a testimonial
  - [ ] Edit a testimonial
  - [ ] Remove a testimonial
  - [ ] Save and verify
- [ ] Test **Experts** tab:
  - [ ] Add an expert
  - [ ] Upload expert image
  - [ ] Save and verify

### Step 3.11: Settings Management
- [ ] Go to **Settings** page
- [ ] Test **App Settings**:
  - [ ] Upload logo
  - [ ] Enter logo URL
  - [ ] Update site name
  - [ ] Update contact email
  - [ ] Update contact phone
  - [ ] Save settings
  - [ ] Verify changes persist
- [ ] Test **Integrations**:
  - [ ] Update Paystack keys
  - [ ] Update SMTP settings
  - [ ] Update SMS settings
  - [ ] Save and verify
- [ ] Test **Notifications**:
  - [ ] Send test email
  - [ ] Verify email received
  - [ ] Send test SMS
  - [ ] Verify SMS received (check phone)

### Step 3.12: Email/SMS Templates
- [ ] Go to **Settings → Templates**
- [ ] Test email templates:
  - [ ] View existing templates
  - [ ] Edit a template
  - [ ] Add variables (e.g., `{{parent_name}}`)
  - [ ] Save template
- [ ] Test SMS templates:
  - [ ] View existing templates
  - [ ] Edit a template
  - [ ] Check character count
  - [ ] Save template

### Step 3.13: Notification Logs
- [ ] Go to **Notification Logs** page
- [ ] Verify logs list loads
- [ ] Check filters work (type, status, date)
- [ ] Click on a log to view details
- [ ] Test "Resend" functionality
- [ ] Verify resend works

**Expected Result:** ✅ All admin features work correctly

---

## 👨‍👩‍👧 Test 4: Parent Portal

### Step 4.1: Parent Login
- [ ] Go to `/parent/login`
- [ ] Enter parent email: `parent@test.com`
- [ ] Enter password (set during registration or password reset)
- [ ] Click "Login"
- [ ] Verify redirect to parent dashboard

### Step 4.2: Parent Dashboard
- [ ] Check dashboard loads
- [ ] Verify summary cards display:
  - [ ] Total Children
  - [ ] Active Registrations
  - [ ] Pending Payments
  - [ ] Upcoming Classes
- [ ] Check children list displays
- [ ] Verify upcoming classes table shows

### Step 4.3: Child Filtering
- [ ] Use child filter dropdown
- [ ] Select a specific child
- [ ] Verify summary cards update
- [ ] Check children list filters
- [ ] Verify upcoming classes filter
- [ ] Select "All Children"
- [ ] Verify all data shows

### Step 4.4: View Registrations
- [ ] Go to **Registrations** page
- [ ] Verify registrations list loads
- [ ] Check child filter works
- [ ] Click on a registration
- [ ] Verify registration details display
- [ ] Check class information
- [ ] Verify payment status

### Step 4.5: View Payments
- [ ] Go to **Payments** page
- [ ] Verify payments list loads
- [ ] Check child filter works
- [ ] Click on a payment
- [ ] Verify payment details display
- [ ] Check payment method
- [ ] Verify payment date

### Step 4.6: View Children
- [ ] Go to **Children** page (if available)
- [ ] Verify children list loads
- [ ] Check child information displays
- [ ] Verify registrations per child

**Expected Result:** ✅ Parent can view all their data correctly

---

## 🎓 Test 5: Student Portal

### Step 5.1: Student Login
- [ ] Go to `/student/login`
- [ ] Enter student credentials
- [ ] Click "Login"
- [ ] Verify redirect to student dashboard

### Step 5.2: Student Dashboard
- [ ] Check dashboard loads
- [ ] Verify upcoming classes display
- [ ] Check enrolled courses display
- [ ] Verify progress indicators

### Step 5.3: View Courses
- [ ] Go to **Courses** page
- [ ] Verify accessible courses list
- [ ] Click on a course
- [ ] Verify course details display
- [ ] Check modules and lessons

### Step 5.4: Access Lessons
- [ ] Click on a lesson
- [ ] Verify lesson player loads
- [ ] Check video/content displays
- [ ] Verify resources are accessible
- [ ] Mark lesson as complete
- [ ] Verify progress updates

**Expected Result:** ✅ Student can access courses and track progress

---

## 📧 Test 6: Email Notifications

### Step 6.1: Registration Email
- [ ] Complete a new registration
- [ ] Check email inbox
- [ ] Verify welcome email received
- [ ] Check email content is correct
- [ ] Verify password setup link works (if new user)

### Step 6.2: Payment Confirmation Email
- [ ] Complete a payment
- [ ] Check email inbox
- [ ] Verify payment confirmation email received
- [ ] Check email contains correct details

### Step 6.3: Class Reminder Email
- [ ] Create a class starting in 24 hours
- [ ] Wait for automated reminder (or trigger manually)
- [ ] Check email inbox
- [ ] Verify reminder email received
- [ ] Check email contains class details

### Step 6.4: Payment Reminder Email
- [ ] Create a registration with pending payment
- [ ] Send payment reminder (manual or automated)
- [ ] Check email inbox
- [ ] Verify reminder email received
- [ ] Check email contains payment details

**Expected Result:** ✅ All emails sent and received correctly

---

## 📱 Test 7: SMS Notifications

### Step 7.1: Registration SMS
- [ ] Complete a new registration (if SMS enabled)
- [ ] Check phone
- [ ] Verify SMS received
- [ ] Check SMS content is correct

### Step 7.2: Class Reminder SMS
- [ ] Create a class starting in 1 hour
- [ ] Wait for automated reminder (or trigger manually)
- [ ] Check phone
- [ ] Verify reminder SMS received
- [ ] Check SMS contains class details

### Step 7.3: Payment Reminder SMS
- [ ] Send payment reminder via SMS
- [ ] Check phone
- [ ] Verify reminder SMS received
- [ ] Check SMS contains payment details

**Expected Result:** ✅ All SMS sent and received correctly

---

## 🔍 Test 8: Mobile Responsiveness

### Step 8.1: Mobile Navigation
- [ ] Open site on mobile device (or resize browser)
- [ ] Check hamburger menu appears
- [ ] Click menu - verify sidebar opens
- [ ] Navigate through pages
- [ ] Verify all pages are accessible

### Step 8.2: Mobile Forms
- [ ] Test registration form on mobile
- [ ] Verify form is usable
- [ ] Check inputs are properly sized
- [ ] Test form submission

### Step 8.3: Mobile Tables
- [ ] View admin tables on mobile
- [ ] Verify horizontal scrolling works
- [ ] Check data is readable
- [ ] Test filters on mobile

### Step 8.4: Mobile Dashboard
- [ ] View dashboards on mobile
- [ ] Verify charts are responsive
- [ ] Check cards stack properly
- [ ] Verify all data is accessible

**Expected Result:** ✅ All features work on mobile devices

---

## 🐛 Test 9: Error Handling

### Step 9.1: Invalid Login
- [ ] Try logging in with wrong password
- [ ] Verify error message displays
- [ ] Check rate limiting works (try 5+ times)

### Step 9.2: Invalid Payment
- [ ] Try processing payment with invalid card
- [ ] Verify error handling
- [ ] Check error message displays

### Step 9.3: Network Errors
- [ ] Disconnect internet
- [ ] Try to submit form
- [ ] Verify error handling
- [ ] Check user-friendly error message

### Step 9.4: Missing Data
- [ ] Try accessing page with invalid ID
- [ ] Verify 404 or error page
- [ ] Check error message is helpful

**Expected Result:** ✅ All errors handled gracefully

---

## ✅ Final Verification Checklist

### Critical Flows
- [ ] Registration → Payment → Confirmation works end-to-end
- [ ] Admin can manage all entities
- [ ] Parent can view their data
- [ ] Student can access courses
- [ ] Email notifications work
- [ ] SMS notifications work
- [ ] CMS updates persist
- [ ] Mobile experience is good

### Data Integrity
- [ ] All data saves correctly
- [ ] Relationships work (parent → children → registrations)
- [ ] Payments link to registrations correctly
- [ ] Attendance tracking works
- [ ] Exports contain correct data

### Security
- [ ] Authentication works
- [ ] Authorization works (users can't access others' data)
- [ ] Rate limiting works
- [ ] CORS configured correctly
- [ ] File uploads are secure

### Performance
- [ ] Pages load quickly
- [ ] Forms submit without delay
- [ ] Charts render correctly
- [ ] Images load properly

---

## 📝 Testing Notes Template

Use this template to document any issues found:

```
Date: ___________
Tester: ___________

Issue #1:
- Page/Feature: ___________
- Steps to Reproduce: ___________
- Expected: ___________
- Actual: ___________
- Screenshot: ___________

Issue #2:
- ...
```

---

## 🚨 Common Issues & Solutions

### Issue: Payment not processing
**Solution:** Check Paystack keys are correct, webhook URL is configured

### Issue: Email not sending
**Solution:** Verify SMTP credentials, check spam folder, test with test email feature

### Issue: SMS not sending
**Solution:** Verify Deywuro credentials, check account balance

### Issue: Logo not displaying
**Solution:** Check CORS settings, verify file exists, check URL is correct

### Issue: Data not persisting
**Solution:** Check database connection, verify migrations run, check logs

---

## 🎯 Success Criteria

Your platform is ready if:
- ✅ All critical flows work end-to-end
- ✅ No critical bugs found
- ✅ All notifications work
- ✅ Mobile experience is good
- ✅ Data integrity is maintained
- ✅ Security measures work
- ✅ Performance is acceptable

---

**Happy Testing! 🚀**

If you find any issues, document them and we can fix them before launch.

