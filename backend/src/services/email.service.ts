import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { settingsService } from './settings.service';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter() {
    // Get SMTP settings from database (with env vars as fallback)
    let smtpHost: string | null = null;
    let smtpPort: number | null = null;
    let smtpSecure: boolean | null = null;
    let smtpUser: string | null = null;
    let smtpPass: string | null = null;
    let smtpFrom: string | null = null;

    try {
      smtpHost = await settingsService.get('smtp_host');
      const port = await settingsService.get('smtp_port');
      smtpPort = port ? parseInt(port) : null;
      smtpSecure = await settingsService.get('smtp_secure');
      smtpUser = await settingsService.get('smtp_user');
      smtpPass = await settingsService.get('smtp_pass');
      smtpFrom = await settingsService.get('smtp_from');
    } catch (error) {
      // Settings service might fail, fall back to env vars
      console.warn('Could not fetch SMTP settings from database, using environment variables');
    }

    // Use database settings if available, otherwise fall back to env vars
    const finalHost = smtpHost || config.smtp.host;
    const finalPort = smtpPort || config.smtp.port;
    const finalSecure = smtpSecure !== null ? smtpSecure : config.smtp.secure;
    const finalUser = smtpUser || config.smtp.user;
    const finalPass = smtpPass || config.smtp.pass;
    const finalFrom = smtpFrom || config.smtp.from;

    if (!finalHost || !finalUser || !finalPass) {
      throw new Error('SMTP is not configured. Please configure in Admin → Settings → Integrations → Email (SMTP) Configuration');
    }

    // Create new transporter with current settings (in case settings changed)
    this.transporter = nodemailer.createTransport({
      host: finalHost,
      port: finalPort,
      secure: finalSecure,
      auth: {
        user: finalUser,
        pass: finalPass,
      },
    });

    return this.transporter;
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string) {
    const transporter = await this.getTransporter();
    
    // Get from address from settings or config
    let fromAddress = config.smtp.from;
    try {
      const dbFrom = await settingsService.get('smtp_from');
      if (dbFrom) {
        fromAddress = dbFrom;
      }
    } catch (error) {
      // Use config default
    }

    const mailOptions = {
      from: fromAddress,
      to,
      subject: 'Password Reset Request - Vibe Coding Academy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>You requested to reset your password. Click the link below to reset it:</p>
          <p><a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, html: string) {
    const transporter = await this.getTransporter();
    
    // Get from address from settings or config
    let fromAddress = config.smtp.from;
    try {
      const dbFrom = await settingsService.get('smtp_from');
      if (dbFrom) {
        fromAddress = dbFrom;
      }
    } catch (error) {
      // Use config default
    }

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      html,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();

