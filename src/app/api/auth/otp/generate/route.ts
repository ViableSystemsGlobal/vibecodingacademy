import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OtpService } from '@/lib/otp-service';
import { getCompanyName } from '@/lib/company-settings';
import nodemailer from 'nodemailer';
type OtpMethod = 'EMAIL' | 'SMS';

// Helper function to get setting value from database (same as communication system)
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

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({ 
        success: true,
        message: 'If an account exists with this email, an OTP has been sent.'
      });
    }

    // Check if 2FA is enabled
    // Support both old otpMethod and new otpMethods array
    const userWithOtp = user as any;
    let otpMethodsArray: ('EMAIL' | 'SMS')[] = [];
    if (userWithOtp.otpMethods && Array.isArray(userWithOtp.otpMethods)) {
      otpMethodsArray = userWithOtp.otpMethods;
    } else if (userWithOtp.otpMethod) {
      otpMethodsArray = [userWithOtp.otpMethod];
    }
    
    if (!userWithOtp.otpEnabled || otpMethodsArray.length === 0) {
      return NextResponse.json({ 
        error: '2FA is not enabled for this account' 
      }, { status: 400 });
    }

    // Generate OTP for the first method (all methods will receive the same code)
    const { code, expiresAt } = await OtpService.generateOtp(
      user.id,
      otpMethodsArray[0] as OtpMethod
    );

    // Send OTP to all selected methods
    if (otpMethodsArray.includes('EMAIL') && user.email) {
      // Get company name using same helper as communication system
      const companyName = await getCompanyName();

      const emailSubject = `Your Login Code - ${companyName}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">🔐 Your Login Code</h2>
          <p>Hello ${user.name || 'User'},</p>
          <p>Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #3b82f6; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="color: #ef4444; font-weight: bold;">
            ⚠️ If you didn't request this code, please ignore this email.
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated security message from ${companyName}.
          </p>
        </div>
      `;

      // Get SMTP configuration using same helper as communication system
      const smtpHost = await getSettingValue('SMTP_HOST', '');
      const smtpPort = await getSettingValue('SMTP_PORT', '587');
      const smtpUsername = await getSettingValue('SMTP_USERNAME', '');
      const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
      const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS', '');
      const smtpFromName = await getSettingValue('SMTP_FROM_NAME', companyName);
      const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');

      if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
        console.error('SMTP configuration not found, cannot send OTP email');
        return NextResponse.json(
          { error: 'Email configuration not found. Please configure SMTP settings.' },
          { status: 500 }
        );
      }

      console.log('Sending OTP email to:', user.email);
      console.log('SMTP Config:', { smtpHost, smtpPort, smtpUsername, smtpFromAddress });

      // Create transporter (same as communication system)
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpEncryption === 'ssl',
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
      });

      // Convert message to HTML if it's plain text (same as communication system)
      const messageHtml = emailBody.includes('<') && emailBody.includes('>') 
        ? emailBody 
        : emailBody.replace(/\n/g, '<br>');
      
      // Generate email template with theme colors (same as communication system)
      const { generateEmailTemplate, generatePlainText } = await import('@/lib/email-template');
      const htmlContent = await generateEmailTemplate(messageHtml);
      
      // Generate plain text version (same as communication system)
      const plainText = generatePlainText(`Your ${companyName} login code is: ${code}. Valid for 5 minutes. Do not share this code.`);

      // Send email (same format as communication system)
      const result = await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpFromAddress}>`,
        to: user.email,
        subject: emailSubject,
        text: plainText,
        html: htmlContent,
      });

      console.log('✅ OTP email sent successfully:', result.messageId);
    }
    
    // Send SMS if SMS is selected
    if (otpMethodsArray.includes('SMS') && user.phone) {
      // Get company name using same helper as communication system
      const companyName = await getCompanyName();
      const smsMessage = `Your ${companyName} login code is: ${code}. Valid for 5 minutes. Do not share this code.`;

      // Send SMS directly (using same approach as communication system)
      const smsUsername = await getSettingValue('SMS_USERNAME', '');
      const smsPassword = await getSettingValue('SMS_PASSWORD', '');
      const smsSenderId = await getSettingValue('SMS_SENDER_ID', 'AdPools');

      if (smsUsername && smsPassword) {
        const smsResponse = await fetch('https://deywuro.com/api/sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            username: smsUsername,
            password: smsPassword,
            destination: user.phone,
            source: smsSenderId,
            message: smsMessage
          })
        });

        const responseText = await smsResponse.text();
        const result = JSON.parse(responseText);

        if (result.code !== 0) {
          console.error(`Failed to send OTP SMS: ${result.message}`);
        } else {
          console.log(`✅ OTP SMS sent successfully to ${user.phone}`);
        }
      } else {
        console.error('SMS configuration not found, cannot send OTP SMS');
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'OTP sent successfully',
      methods: otpMethodsArray,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error generating OTP:', error);
    return NextResponse.json(
      { error: 'Failed to generate OTP' },
      { status: 500 }
    );
  }
}

