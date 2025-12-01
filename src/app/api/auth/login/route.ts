import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { OtpService } from '@/lib/otp-service';
import { LoginNotificationService } from '@/lib/login-notification-service';
import { getCompanyName } from '@/lib/company-settings';
import nodemailer from 'nodemailer';

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
    const body = await request.json();
    const { email, password, otpCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Record failed login
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      
      await LoginNotificationService.recordLoginHistory(
        user.id,
        { ipAddress, userAgent },
        false,
        'Invalid password'
      );

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
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
    
    const has2FA = user.otpEnabled && otpMethodsArray.length > 0;
    if (has2FA) {
      // OTP is required
      if (!otpCode) {
        // Generate OTP for the first method (all methods will receive the same code)
        const { code, expiresAt } = await OtpService.generateOtp(
          user.id,
          otpMethodsArray[0]
        );

        // Send OTP to all selected methods (using same approach as communication system)
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

          if (smtpHost && smtpUsername && smtpPassword && smtpFromAddress) {
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
          } else {
            console.error('SMTP configuration not found, cannot send OTP email');
          }
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
          requiresOtp: true,
          methods: otpMethodsArray,
          message: 'OTP sent. Please enter the code to continue.'
        });
      }

      // Verify OTP
      const verification = await OtpService.verifyOtp(user.id, otpCode);
      if (!verification.valid) {
        return NextResponse.json(
          { error: verification.message || 'Invalid OTP code' },
          { status: 401 }
        );
      }
    }

    // Password (and OTP if required) verified successfully
    // Get login info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Try to get location (optional, can be enhanced with IP geolocation service)
    const location = 'Unknown location'; // Can be enhanced with IP geolocation

    // Record successful login
    await LoginNotificationService.recordLoginHistory(
      user.id,
      { ipAddress, userAgent, location }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Send login notifications (async, don't wait)
    LoginNotificationService.sendLoginNotifications(user, {
      ipAddress,
      userAgent,
      location
    }).catch(err => console.error('Failed to send login notifications:', err));

    // Return success - client will use NextAuth signIn
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      requiresOtp: false
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

