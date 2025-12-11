import axios from 'axios';
import { config } from '../config/env';
import { settingsService } from './settings.service';

interface InitializeTransactionData {
  email: string;
  amount: number;
  reference: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}

interface VerifyTransactionResponse {
  status: boolean; // Paystack returns boolean at top level
  message?: string;
  data: {
    status: string; // Payment status: 'success' | 'failed' | etc.
    reference: string;
    amount: number;
    customer: {
      email: string;
    };
  };
}

class PaystackService {
  private baseUrl = 'https://api.paystack.co';

  private async getSecretKey(): Promise<string> {
    // Try to get from database settings first, then fall back to env
    try {
      const dbSecretKey = await settingsService.get('paystack_secret_key');
      if (dbSecretKey) {
        return dbSecretKey;
      }
    } catch (error) {
      // Settings service might fail, fall back to env vars
      console.warn('Could not fetch Paystack settings from database, using environment variables');
    }
    return config.paystack.secretKey;
  }

  async initializeTransaction(data: InitializeTransactionData) {
    const secretKey = await this.getSecretKey();
    
    if (!secretKey) {
      throw new Error('Paystack secret key is not configured. Please set it in Admin → Settings → Integrations → Paystack Payment Gateway.');
    }

    try {
      const payload: any = {
        email: data.email,
        amount: data.amount,
        reference: data.reference,
      };
      
      if (data.callback_url) {
        payload.callback_url = data.callback_url;
      }
      
      if (data.metadata) {
        payload.metadata = data.metadata;
      }

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from Paystack');
      }

      return {
        authorization_url: response.data.data.authorization_url,
        reference: response.data.data.reference,
      };
    } catch (error: any) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      
      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error('Invalid Paystack API key. Please check your Paystack secret key configuration.');
      }
      if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || 'Invalid request to Paystack';
        throw new Error(`Paystack validation error: ${errorMessage}`);
      }
      if (error.response?.data?.message) {
        throw new Error(`Paystack error: ${error.response.data.message}`);
      }
      throw new Error(`Failed to initialize payment: ${error.message || 'Unknown error'}`);
    }
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResponse> {
    const secretKey = await this.getSecretKey();
    
    if (!secretKey) {
      throw new Error('Paystack secret key is not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify payment');
    }
  }

  async handleWebhook(rawBody: string, signature: string) {
    // Get webhook secret from settings or env
    let webhookSecret = config.paystack.webhookSecret;
    
    try {
      const { settingsService } = await import('./settings.service');
      const dbWebhookSecret = await settingsService.get('paystack_webhook_secret');
      if (dbWebhookSecret) {
        webhookSecret = dbWebhookSecret;
      }
    } catch (error) {
      // Fall back to env var
      console.warn('Could not fetch webhook secret from settings, using environment variable');
    }

    if (!webhookSecret) {
      throw new Error('Paystack webhook secret is not configured');
    }

    // Verify webhook signature
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('Webhook signature mismatch:', {
        received: signature.substring(0, 20) + '...',
        computed: hash.substring(0, 20) + '...',
      });
      throw new Error('Invalid webhook signature');
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);

    // Handle different webhook events
    switch (payload.event) {
      case 'charge.success':
      case 'transaction.success':
        return {
          reference: payload.data.reference,
          status: 'success',
          event: payload.event,
          data: payload.data,
        };

      case 'charge.failed':
      case 'transaction.failed':
        return {
          reference: payload.data.reference,
          status: 'failed',
          event: payload.event,
          data: payload.data,
        };

      case 'transfer.success':
      case 'transfer.failed':
        // Handle transfer events if needed
        return {
          reference: payload.data.reference,
          status: payload.event.includes('success') ? 'success' : 'failed',
          event: payload.event,
          data: payload.data,
        };

      default:
        // Log unknown events but don't throw error
        console.log('Unhandled webhook event:', payload.event);
        return null;
    }
  }
}

export const paystackService = new PaystackService();

