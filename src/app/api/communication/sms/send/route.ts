import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addBulkSMSJob, addSMSJob } from '@/lib/queue-service';
import { getQueueSettings } from '@/lib/queue-config';

async function getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key },
      select: { value: true }
    });
    return setting?.value || defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
}

async function sendSmsViaDeywuro(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
  try {
    // Get SMS configuration from database - use same approach as working test SMS
    const username = await getSettingValue('SMS_USERNAME', '');
    const password = await getSettingValue('SMS_PASSWORD', '');
    const senderId = await getSettingValue('SMS_SENDER_ID', 'AdPools');

    if (!username || !password) {
      throw new Error('SMS configuration not found. Please configure SMS settings.');
    }

    console.log('Sending SMS to:', phoneNumber);
    console.log('SMS Config:', { username, senderId, messageLength: message.length });

    // Use the same working endpoint as the test SMS
    const response = await fetch('https://deywuro.com/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: username,
        password: password,
        destination: phoneNumber,
        source: senderId,
        message: message
      })
    });

    const responseText = await response.text();
    console.log('Deywuro SMS Response Status:', response.status);
    console.log('Deywuro SMS Response Text:', responseText);

    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // If it's not JSON, it might be an HTML error page
      return {
        success: false,
        error: `SMS provider returned non-JSON response: ${response.status} - ${responseText.substring(0, 100)}...`
      };
    }

    if (result.code === 0) {
      return {
        success: true,
        messageId: result.id || `deywuro_${Date.now()}`, // Use provider ID if available
        cost: 0.05 // Approximate cost per SMS
      };
    } else {
      return {
        success: false,
        error: `Deywuro SMS failed: ${result.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('Error sending SMS via Deywuro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipients, message, isBulk, distributorId } = await request.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Recipients array is required' }, { status: 400 });
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 160) {
      return NextResponse.json({ error: 'Message too long (max 160 characters)' }, { status: 400 });
    }

    // Check SMS configuration first
    const smsUsername = await getSettingValue('SMS_USERNAME', '');
    const smsPassword = await getSettingValue('SMS_PASSWORD', '');
    const smsSenderId = await getSettingValue('SMS_SENDER_ID', 'AdPools');

    if (!smsUsername || !smsPassword) {
      return NextResponse.json({ 
        error: 'SMS configuration not found. Please configure SMS settings in Settings → Notifications first.' 
      }, { status: 400 });
    }

    // Use queue for bulk sends (10+ recipients) or if explicitly requested
    const queueSettings = await getQueueSettings();

    const useQueue =
      queueSettings.smsEnabled &&
      (isBulk || recipients.length >= queueSettings.smsBatchSize);

    if (useQueue) {
      // Create campaign if it's a bulk message
      let campaignId = null;
      if (isBulk && recipients.length > 1) {
        const campaign = await prisma.smsCampaign.create({
          data: {
            name: `Bulk SMS - ${new Date().toLocaleDateString()}`,
            description: `Bulk SMS sent to ${recipients.length} recipients`,
            recipients: recipients,
            message: message,
            status: 'SENDING',
            userId: session.user.id,
            sentAt: new Date()
          }
        });
        campaignId = campaign.id;
      }

      // Add to queue with batching
      const { jobId, totalBatches, totalRecipients } = await addBulkSMSJob({
        recipients,
        message,
        userId: session.user.id,
        campaignId: campaignId || undefined,
        distributorId: distributorId || undefined,
        batchSize: queueSettings.smsBatchSize,
        delayBetweenBatches: queueSettings.smsDelayMs,
      });

      return NextResponse.json({
        success: true,
        message: `SMS job queued successfully. ${totalRecipients} SMS will be sent in ${totalBatches} batches.`,
        jobId,
        totalRecipients,
        totalBatches,
        queued: true,
      });
    } else {
      // For small batches, send directly (synchronous)
      const results = [];
      let totalCost = 0;
      let successCount = 0;
      let failureCount = 0;

      // Create campaign if it's a bulk message
      let campaignId = null;
      if (isBulk && recipients.length > 1) {
        const campaign = await prisma.smsCampaign.create({
          data: {
            name: `Bulk SMS - ${new Date().toLocaleDateString()}`,
            description: `Bulk SMS sent to ${recipients.length} recipients`,
            recipients: recipients,
            message: message,
            status: 'SENDING',
            userId: session.user.id,
            sentAt: new Date()
          }
        });
        campaignId = campaign.id;
      }

      // Send SMS to each recipient
      for (const phoneNumber of recipients) {
      try {
        // Validate phone number format
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          results.push({
            phoneNumber,
            success: false,
            error: 'Invalid phone number format'
          });
          failureCount++;
          continue;
        }

        // Send SMS via Deywuro
        const smsResult = await sendSmsViaDeywuro(phoneNumber, message);
        
        if (smsResult.success) {
          // Save successful SMS to database
          if (distributorId) {
            // Save to distributor SMS table
            await prisma.distributorSMS.create({
              data: {
                distributorId: distributorId,
                to: phoneNumber,
                message: message,
                status: 'SENT',
                sentBy: session.user.id,
                sentAt: new Date()
              }
            });
          } else {
            // Save to general SMS table
            await prisma.smsMessage.create({
              data: {
                recipient: phoneNumber,
                message: message,
                status: 'SENT',
                sentAt: new Date(),
                cost: smsResult.cost || 0.05,
                provider: 'deywuro',
                providerId: smsResult.messageId,
                userId: session.user.id,
                campaignId: campaignId,
                isBulk: isBulk
              }
            });
          }

          results.push({
            phoneNumber,
            success: true,
            messageId: smsResult.messageId,
            cost: smsResult.cost
          });
          successCount++;
          totalCost += smsResult.cost || 0.05;
        } else {
          // Save failed SMS to database
          if (distributorId) {
            // Save to distributor SMS table
            await prisma.distributorSMS.create({
              data: {
                distributorId: distributorId,
                to: phoneNumber,
                message: message,
                status: 'FAILED',
                sentBy: session.user.id,
                sentAt: new Date(),
                errorMessage: smsResult.error
              }
            });
          } else {
            // Save to general SMS table
            await prisma.smsMessage.create({
              data: {
                recipient: phoneNumber,
                message: message,
                status: 'FAILED',
                failedAt: new Date(),
                errorMessage: smsResult.error,
                userId: session.user.id,
                campaignId: campaignId,
                isBulk: isBulk
              }
            });
          }

          results.push({
            phoneNumber,
            success: false,
            error: smsResult.error
          });
          failureCount++;
        }
      } catch (error) {
        console.error(`Error sending SMS to ${phoneNumber}:`, error);
        
        // Save failed SMS to database
        if (distributorId) {
          // Save to distributor SMS table
          await prisma.distributorSMS.create({
            data: {
              distributorId: distributorId,
              to: phoneNumber,
              message: message,
              status: 'FAILED',
              sentBy: session.user.id,
              sentAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        } else {
          // Save to general SMS table
          await prisma.smsMessage.create({
            data: {
              recipient: phoneNumber,
              message: message,
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              userId: session.user.id,
              campaignId: campaignId,
              isBulk: isBulk
            }
          });
        }

        results.push({
          phoneNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
        failureCount++;
      }
    }

      // Update campaign status if it was a bulk message
      if (campaignId) {
        await prisma.smsCampaign.update({
          where: { id: campaignId },
          data: {
            status: successCount > 0 ? 'COMPLETED' : 'FAILED',
            totalSent: successCount,
            totalFailed: failureCount,
            completedAt: new Date()
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: `SMS sent to ${successCount} recipients successfully`,
        results: {
          total: recipients.length,
          successful: successCount,
          failed: failureCount,
          totalCost: totalCost.toFixed(4)
        },
        details: results
      });
    }

  } catch (error) {
    console.error('Error in SMS send API:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
