import prisma from '../config/database';

export interface WebhookLogData {
  provider: string;
  event: string;
  reference?: string;
  status: 'SUCCESS' | 'FAILED' | 'ERROR';
  payload?: any;
  errorMessage?: string;
}

export class WebhookLogService {
  async logWebhook(data: WebhookLogData) {
    try {
      // Store webhook logs in notification_logs table or create a dedicated table
      // For now, we'll use console logging and could extend to database logging
      console.log('Webhook Log:', {
        provider: data.provider,
        event: data.event,
        reference: data.reference,
        status: data.status,
        timestamp: new Date().toISOString(),
        error: data.errorMessage,
      });

      // Future: Store in database for audit trail
      // await prisma.webhookLog.create({ data: {...} });
    } catch (error) {
      console.error('Error logging webhook:', error);
    }
  }
}

export const webhookLogService = new WebhookLogService();

