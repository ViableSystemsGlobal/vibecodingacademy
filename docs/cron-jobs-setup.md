# Cron Jobs Setup Guide

This document describes all available cron jobs and how to set them up.

## Available Cron Jobs

### 1. Task Notifications
**Endpoint:** `POST /api/cron/task-notifications`  
**Frequency:** Every minute (recommended)  
**Purpose:** Sends notifications for tasks that are due soon or overdue

**Setup:**
```bash
# Add to crontab (crontab -e)
* * * * * curl -X POST https://your-domain.com/api/cron/task-notifications -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. Business Reports (AI Analyst Daily Reports)
**Endpoint:** `POST /api/cron/business-report`  
**Frequency:** Daily, Weekly, or Monthly (based on settings)  
**Purpose:** Sends automated business reports via email

**Settings (in System Settings):**
- `ai_business_report_enabled`: Enable/disable reports (true/false)
- `ai_business_report_frequency`: daily, weekly, or monthly
- `ai_business_report_time`: Time to send (e.g., "08:00")
- `ai_business_report_day`: Day of week for weekly reports (e.g., "monday")
- `ai_business_report_recipients`: Comma-separated email addresses
- `ai_business_report_timezone`: Timezone (e.g., "Africa/Accra")

**Setup:**
```bash
# Daily at 8 AM (adjust time based on your timezone)
0 8 * * * curl -X POST https://your-domain.com/api/cron/business-report -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. Quotation Reminders
**Endpoint:** `POST /api/cron/quotation-reminders`  
**Frequency:** Daily (recommended)  
**Purpose:** Sends reminders for quotations that haven't been won (not ACCEPTED)

**Settings (in System Settings):**
- `quotation_reminders_enabled`: Enable/disable reminders (true/false)
- `quotation_reminder_days`: Days after creation to start sending reminders (default: 7)
- `quotation_reminder_interval_days`: Days between reminder sends (default: 7)

**What it does:**
- Finds quotations with status: DRAFT, SENT, REJECTED, or EXPIRED
- Sends reminders to customers via email and SMS
- Tracks reminder count and last reminder sent date

**Setup:**
```bash
# Daily at 9 AM
0 9 * * * curl -X POST https://your-domain.com/api/cron/quotation-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Invoice Payment Reminders
**Endpoint:** `POST /api/cron/invoice-reminders`  
**Frequency:** Daily (recommended)  
**Purpose:** Sends payment reminders for unpaid or partially paid invoices

**Settings (in System Settings):**
- `invoice_reminders_enabled`: Enable/disable reminders (true/false)
- `invoice_reminder_days_after_due`: Days after due date to start sending reminders (default: 7)
- `invoice_reminder_interval_days`: Days between reminder sends (default: 7)

**What it does:**
- Finds invoices with payment status: UNPAID or PARTIALLY_PAID
- Finds invoices with status: SENT or OVERDUE (not DRAFT or VOID)
- Sends reminders to customers via email and SMS
- Tracks reminder count and last reminder sent date

**Setup:**
```bash
# Daily at 10 AM
0 10 * * * curl -X POST https://your-domain.com/api/cron/invoice-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 5. Abandoned Cart Reminders
**Endpoint:** `POST /api/ecommerce/abandoned-carts/remind`  
**Frequency:** Every 6-12 hours (recommended)  
**Purpose:** Sends reminders for abandoned shopping carts

**Settings (in Ecommerce Settings):**
- `ECOMMERCE_SEND_ABANDONED_CART_REMINDERS`: Enable/disable (true/false)
- `ECOMMERCE_ABANDONED_CART_DELAY_HOURS`: Hours after abandonment before sending (default: 24)

**Setup:**
```bash
# Every 6 hours
0 */6 * * * curl -X POST https://your-domain.com/api/ecommerce/abandoned-carts/remind -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Security

All cron endpoints require authentication via `CRON_SECRET` environment variable:

1. Set `CRON_SECRET` in your environment variables
2. Include it in the Authorization header: `Bearer YOUR_CRON_SECRET`

## Recommended Cron Schedule

```bash
# Task notifications - every minute
* * * * * curl -X POST https://your-domain.com/api/cron/task-notifications -H "Authorization: Bearer YOUR_CRON_SECRET"

# Business reports - daily at 8 AM
0 8 * * * curl -X POST https://your-domain.com/api/cron/business-report -H "Authorization: Bearer YOUR_CRON_SECRET"

# Quotation reminders - daily at 9 AM
0 9 * * * curl -X POST https://your-domain.com/api/cron/quotation-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"

# Invoice reminders - daily at 10 AM
0 10 * * * curl -X POST https://your-domain.com/api/cron/invoice-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"

# Abandoned cart reminders - every 6 hours
0 */6 * * * curl -X POST https://your-domain.com/api/ecommerce/abandoned-carts/remind -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Alternative: Using External Cron Services

You can also use external cron services like:
- **EasyCron** (https://www.easycron.com)
- **Cron-job.org** (https://cron-job.org)
- **UptimeRobot** (https://uptimerobot.com)

Simply configure them to call the endpoints with the Authorization header.

## Testing

You can test each endpoint manually:

```bash
# Test quotation reminders
curl -X POST http://localhost:3001/api/cron/quotation-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test invoice reminders
curl -X POST http://localhost:3001/api/cron/invoice-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test business reports
curl -X POST http://localhost:3001/api/cron/business-report \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Health Checks

All cron endpoints have GET endpoints for health checks:

```bash
curl https://your-domain.com/api/cron/quotation-reminders
curl https://your-domain.com/api/cron/invoice-reminders
curl https://your-domain.com/api/cron/business-report
```

