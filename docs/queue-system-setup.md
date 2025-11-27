# Queue-Based Bulk Sending System

## Overview

The system now uses a queue-based approach for bulk email and SMS sending, providing:
- **Batching**: Sends messages in batches to avoid overwhelming providers
- **Rate Limiting**: Respects provider rate limits (5 emails/sec, 3 SMS/sec)
- **Background Processing**: Messages are processed asynchronously
- **Progress Tracking**: Real-time progress updates for bulk sends
- **Automatic Retries**: Failed sends are retried up to 3 times
- **No Timeouts**: Large batches won't timeout API requests

## Setup

### 1. Install Redis

The queue system requires Redis. You can install it locally or use a cloud service.

**Local Installation (macOS):**
```bash
brew install redis
brew services start redis
```

**Local Installation (Linux):**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

### 2. Environment Variables

Add to your `.env` file (optional, defaults to localhost):
```
REDIS_URL=redis://localhost:6379
```

For production, use a Redis cloud service:
```
REDIS_URL=redis://username:password@your-redis-host:6379
```

### 3. Initialize Workers

Workers are automatically initialized when the queue service is imported. You can verify they're running by calling:

```
GET /api/queue/workers/init
```

## Usage

### Email Sending

**Small batches (< 10 recipients):**
- Sends synchronously (immediate response)
- Returns results immediately

**Large batches (10+ recipients):**
- Automatically uses queue system
- Returns job ID for progress tracking
- Processes in background

**Example:**
```typescript
const response = await fetch('/api/communication/email/send', {
  method: 'POST',
  body: JSON.stringify({
    recipients: ['email1@example.com', 'email2@example.com', ...],
    subject: 'Your Subject',
    message: 'Your HTML message',
    isBulk: true, // Force queue usage even for small batches
  }),
});

const data = await response.json();
if (data.queued) {
  // Track progress using jobId
  const progress = await fetch(`/api/communication/email/progress?jobId=${data.jobId}`);
}
```

### SMS Sending

Same behavior as email:
- Small batches: synchronous
- Large batches: queued

**Example:**
```typescript
const response = await fetch('/api/communication/sms/send', {
  method: 'POST',
  body: JSON.stringify({
    recipients: ['+233123456789', '+233987654321', ...],
    message: 'Your SMS message',
    isBulk: true,
  }),
});
```

### Best Deals Email

Automatically uses queue for 10+ recipients:
```typescript
const response = await fetch('/api/ecommerce/best-deals/send-email', {
  method: 'POST',
  body: JSON.stringify({
    customerIds: [...], // or sendToAll: true
    manualEmails: ['email@example.com'],
  }),
});
```

## Progress Tracking

Track the progress of queued jobs:

```typescript
// Email progress
const progress = await fetch(`/api/communication/email/progress?jobId=${jobId}`);
const data = await progress.json();
// Returns: { total, completed, failed, active, progress: 0-100 }

// SMS progress
const progress = await fetch(`/api/communication/sms/progress?jobId=${jobId}`);
```

## Configuration

### Batch Sizes

Default batch sizes (can be customized):
- **Email**: 10 per batch, 1 second delay between batches
- **SMS**: 10 per batch, 2 seconds delay between batches

### Rate Limits

- **Email**: 5 per second
- **SMS**: 3 per second (more conservative)

These are automatically enforced by the queue workers.

## Monitoring

Check worker status:
```
GET /api/queue/workers/init
```

Returns:
```json
{
  "success": true,
  "workers": {
    "email": true,
    "sms": true
  }
}
```

## Troubleshooting

### Workers Not Running

1. Check Redis is running: `redis-cli ping` (should return `PONG`)
2. Check environment variables
3. Restart the Next.js server

### Jobs Stuck

1. Check Redis connection
2. Verify workers are running
3. Check server logs for errors

### High Memory Usage

- Reduce batch sizes
- Increase delay between batches
- Monitor Redis memory usage

## Benefits

✅ **No Timeouts**: Large batches process in background  
✅ **Better Performance**: Parallel processing with rate limiting  
✅ **Reliability**: Automatic retries for failed sends  
✅ **Scalability**: Can handle thousands of recipients  
✅ **Progress Tracking**: Real-time status updates  
✅ **Provider-Friendly**: Respects rate limits automatically

