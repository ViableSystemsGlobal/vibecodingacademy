import { Router, Request, Response } from 'express';
import { paystackService } from '../services/paystack.service';
import { paymentService } from '../services/payment.service';
import { paymentAttemptService } from '../services/payment-attempt.service';
import { webhookLogService } from '../services/webhook-log.service';
import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';

const router = Router();

router.post('/paystack', async (req: Request, res: Response) => {
  // Paystack webhook handler
  // Note: This route uses express.raw() middleware to get raw body for signature verification
  
  const startTime = Date.now();
  let webhookEvent: string | null = null;
  let webhookReference: string | null = null;

  try {
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      console.error('Paystack webhook: Missing signature header');
      await webhookLogService.logWebhook({
        provider: 'PAYSTACK',
        event: 'unknown',
        status: 'ERROR',
        errorMessage: 'Missing signature header',
      });
      return res.status(400).json({ success: false, error: { message: 'Missing signature' } });
    }

    // Get raw body as string (set by express.raw() middleware)
    // req.body will be a Buffer when using express.raw()
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    // Verify signature and parse webhook data
    const webhookData = await paystackService.handleWebhook(rawBody, signature);

    if (!webhookData) {
      // Unknown event, but signature was valid - return success
      await webhookLogService.logWebhook({
        provider: 'PAYSTACK',
        event: 'unknown',
        status: 'SUCCESS',
        payload: JSON.parse(rawBody),
      });
      return res.json({ success: true, message: 'Event not handled' });
    }

    const { reference, status, event, data } = webhookData;
    webhookEvent = event;
    webhookReference = reference;

    console.log(`[Webhook] ${event} for reference ${reference}, status: ${status}`);

    // Handle successful payment
    if (status === 'success') {
      try {
        // Verify and process payment
        await paymentService.verifyPayment(reference);
        const processingTime = Date.now() - startTime;
        console.log(`[Webhook] Payment verified and processed successfully for reference: ${reference} (${processingTime}ms)`);
        
        await webhookLogService.logWebhook({
          provider: 'PAYSTACK',
          event,
          reference,
          status: 'SUCCESS',
          payload: data,
        });
      } catch (error: any) {
        const processingTime = Date.now() - startTime;
        console.error(`[Webhook] Error processing payment for reference ${reference} (${processingTime}ms):`, error);
        
        await webhookLogService.logWebhook({
          provider: 'PAYSTACK',
          event,
          reference,
          status: 'ERROR',
          errorMessage: error.message || 'Payment processing failed',
          payload: data,
        });
        
        // Don't fail the webhook - Paystack will retry
        // But log the error for manual investigation
        // Return 200 so Paystack doesn't retry immediately
        return res.status(200).json({
          success: false,
          error: { message: error.message || 'Payment processing failed' },
          note: 'Error logged, payment will be retried via verification endpoint',
        });
      }
    } else if (status === 'failed') {
      // Handle failed payment
      try {
        // Find payment attempt by reference
        const paymentAttempt = await prisma.paymentAttempt.findFirst({
          where: { providerReference: reference },
        });

        if (paymentAttempt && paymentAttempt.status === 'PENDING') {
          // Keep attempt as pending for retry, but log the failure
          console.log(`[Webhook] Payment failed for attempt ${paymentAttempt.id}, reference: ${reference}`);
          // We keep it as PENDING so user can retry
        }

        // Also check for legacy payments
        const payment = await prisma.payment.findFirst({
          where: { providerReference: reference },
        });

        if (payment && payment.status === 'PENDING') {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
            },
          });
          console.log(`[Webhook] Payment marked as failed: ${payment.id}`);
        }

        await webhookLogService.logWebhook({
          provider: 'PAYSTACK',
          event,
          reference,
          status: 'SUCCESS', // Webhook processed successfully, even though payment failed
          payload: data,
        });
      } catch (error: any) {
        console.error(`[Webhook] Error handling failed payment for reference ${reference}:`, error);
        await webhookLogService.logWebhook({
          provider: 'PAYSTACK',
          event,
          reference,
          status: 'ERROR',
          errorMessage: error.message || 'Failed payment handling error',
          payload: data,
        });
      }
    }

    // Always return 200 to Paystack to acknowledge receipt
    // Paystack will retry if we return an error status
    const processingTime = Date.now() - startTime;
    res.json({ 
      success: true, 
      message: 'Webhook processed',
      processingTime: `${processingTime}ms`,
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[Webhook] Processing error (${processingTime}ms):`, error);
    
    await webhookLogService.logWebhook({
      provider: 'PAYSTACK',
      event: webhookEvent || 'unknown',
      reference: webhookReference || undefined,
      status: 'ERROR',
      errorMessage: error.message || 'Webhook processing failed',
    });
    
    // Log the error but still return 200 to prevent Paystack retries
    // We'll handle the error manually or through the payment verification endpoint
    res.status(200).json({
      success: false,
      error: { message: error.message || 'Webhook processing failed' },
      note: 'Error logged, but webhook acknowledged to prevent retries',
      processingTime: `${processingTime}ms`,
    });
  }
});

export default router;

