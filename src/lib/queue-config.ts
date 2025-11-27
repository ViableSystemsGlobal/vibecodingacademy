import { prisma } from "@/lib/prisma";

export interface QueueSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  redisUrl: string;
  emailBatchSize: number;
  emailDelayMs: number;
  smsBatchSize: number;
  smsDelayMs: number;
}

const defaultQueueSettings: QueueSettings = {
  emailEnabled: true,
  smsEnabled: true,
  redisUrl: process.env.REDIS_URL || "",
  emailBatchSize: 10,
  emailDelayMs: 1000,
  smsBatchSize: 10,
  smsDelayMs: 2000,
};

export async function getQueueSettings(): Promise<QueueSettings> {
  try {
    const keys = [
      "QUEUE_EMAIL_ENABLED",
      "QUEUE_SMS_ENABLED",
      "QUEUE_REDIS_URL",
      "QUEUE_EMAIL_BATCH_SIZE",
      "QUEUE_EMAIL_DELAY_MS",
      "QUEUE_SMS_BATCH_SIZE",
      "QUEUE_SMS_DELAY_MS",
    ];

    const settings = await prisma.systemSettings.findMany({
      where: {
        key: {
          in: keys,
        },
      },
    });

    const map = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      emailEnabled: (map.get("QUEUE_EMAIL_ENABLED") ?? "true") === "true",
      smsEnabled: (map.get("QUEUE_SMS_ENABLED") ?? "true") === "true",
      redisUrl: map.get("QUEUE_REDIS_URL") || defaultQueueSettings.redisUrl,
      emailBatchSize: parseInt(map.get("QUEUE_EMAIL_BATCH_SIZE") || `${defaultQueueSettings.emailBatchSize}`, 10),
      emailDelayMs: parseInt(map.get("QUEUE_EMAIL_DELAY_MS") || `${defaultQueueSettings.emailDelayMs}`, 10),
      smsBatchSize: parseInt(map.get("QUEUE_SMS_BATCH_SIZE") || `${defaultQueueSettings.smsBatchSize}`, 10),
      smsDelayMs: parseInt(map.get("QUEUE_SMS_DELAY_MS") || `${defaultQueueSettings.smsDelayMs}`, 10),
    };
  } catch (error) {
    console.error("Error loading queue settings:", error);
    return defaultQueueSettings;
  }
}

