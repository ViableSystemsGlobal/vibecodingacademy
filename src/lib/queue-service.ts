import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { getQueueSettings } from './queue-config';

async function createRedisConnection() {
  try {
    const queueSettings = await getQueueSettings();
    const redisUrl = process.env.REDIS_URL || queueSettings.redisUrl || 'redis://localhost:6379';
    if (!process.env.REDIS_URL && queueSettings.redisUrl) {
      process.env.REDIS_URL = queueSettings.redisUrl;
    }
    return new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } catch (error) {
    console.error('Error creating Redis connection, falling back to default:', error);
    return new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
}

const connection = await createRedisConnection();

// Email queue
export const emailQueue = new Queue('email-queue', { connection });

// SMS queue
export const SMSQueue = new Queue('sms-queue', { connection });

// Queue events for progress tracking
export const emailQueueEvents = new QueueEvents('email-queue', { connection });
export const smsQueueEvents = new QueueEvents('sms-queue', { connection });

export interface EmailJobData {
  recipient: string;
  subject: string;
  message: string;
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
  userId: string;
  campaignId?: string;
  isBulk: boolean;
}

export interface SMSJobData {
  phoneNumber: string;
  message: string;
  userId: string;
  campaignId?: string;
  distributorId?: string;
  isBulk: boolean;
}

export interface BulkEmailJobData {
  recipients: string[];
  subject: string;
  message: string;
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
  userId: string;
  campaignId?: string;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export interface BulkSMSJobData {
  recipients: string[];
  message: string;
  userId: string;
  campaignId?: string;
  distributorId?: string;
  batchSize?: number;
  delayBetweenBatches?: number;
}

/**
 * Add email job to queue
 */
export async function addEmailJob(data: EmailJobData) {
  return await emailQueue.add('send-email', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

/**
 * Add bulk email jobs to queue with batching
 */
export async function addBulkEmailJob(data: BulkEmailJobData) {
  const batchSize = data.batchSize || 10;
  const delayBetweenBatches = data.delayBetweenBatches || 1000; // 1 second default
  
  const batches: string[][] = [];
  for (let i = 0; i < data.recipients.length; i += batchSize) {
    batches.push(data.recipients.slice(i, i + batchSize));
  }

  const jobId = `bulk-email-${Date.now()}`;
  
  // Add jobs for each batch with delays
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await emailQueue.add(
      'send-bulk-email-batch',
      {
        ...data,
        recipients: batch,
        batchNumber: i + 1,
        totalBatches: batches.length,
        jobId,
      },
      {
        delay: i * delayBetweenBatches, // Stagger batches
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        jobId: `${jobId}-batch-${i + 1}`,
      }
    );
  }

  return { jobId, totalBatches: batches.length, totalRecipients: data.recipients.length };
}

/**
 * Add SMS job to queue
 */
export async function addSMSJob(data: SMSJobData) {
  return await SMSQueue.add('send-sms', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

/**
 * Add bulk SMS jobs to queue with batching
 */
export async function addBulkSMSJob(data: BulkSMSJobData) {
  const batchSize = data.batchSize || 10;
  const delayBetweenBatches = data.delayBetweenBatches || 2000; // 2 seconds default for SMS (more conservative)
  
  const batches: string[][] = [];
  for (let i = 0; i < data.recipients.length; i += batchSize) {
    batches.push(data.recipients.slice(i, i + batchSize));
  }

  const jobId = `bulk-sms-${Date.now()}`;
  
  // Add jobs for each batch with delays
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await SMSQueue.add(
      'send-bulk-sms-batch',
      {
        ...data,
        recipients: batch,
        batchNumber: i + 1,
        totalBatches: batches.length,
        jobId,
      },
      {
        delay: i * delayBetweenBatches, // Stagger batches
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        jobId: `${jobId}-batch-${i + 1}`,
      }
    );
  }

  return { jobId, totalBatches: batches.length, totalRecipients: data.recipients.length };
}

/**
 * Get job progress
 */
export async function getJobProgress(jobId: string, queueType: 'email' | 'sms') {
  const queue = queueType === 'email' ? emailQueue : SMSQueue;
  
  const jobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed']);
  const relatedJobs = jobs.filter(job => 
    job.data.jobId === jobId || job.id?.startsWith(jobId)
  );

  const completed = relatedJobs.filter(job => job.finishedOn).length;
  const failed = relatedJobs.filter(job => job.failedReason).length;
  const active = relatedJobs.filter(job => !job.finishedOn && !job.failedReason).length;
  const total = relatedJobs.length;

  return {
    total,
    completed,
    failed,
    active,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Clean up connection
 */
export async function closeQueues() {
  await emailQueue.close();
  await SMSQueue.close();
  await emailQueueEvents.close();
  await smsQueueEvents.close();
  await connection.quit();
}

