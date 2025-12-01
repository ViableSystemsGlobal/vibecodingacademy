import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

type OtpMethod = 'EMAIL' | 'SMS';

export class OtpService {
  private static OTP_LENGTH = 6;
  private static OTP_EXPIRY_MINUTES = 5;

  /**
   * Generate a 6-digit OTP code
   */
  static generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate and store OTP for a user
   */
  static async generateOtp(
    userId: string,
    method: OtpMethod
  ): Promise<{ code: string; expiresAt: Date }> {
    // Delete any existing unused OTPs for this user
    await (prisma as any).otpCode.deleteMany({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    await (prisma as any).otpCode.create({
      data: {
        userId,
        code,
        method,
        expiresAt
      }
    });

    return { code, expiresAt };
  }

  /**
   * Verify OTP code
   */
  static async verifyOtp(
    userId: string,
    code: string
  ): Promise<{ valid: boolean; message?: string }> {
    const otp = await (prisma as any).otpCode.findFirst({
      where: {
        userId,
        code,
        used: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!otp) {
      return { valid: false, message: 'Invalid OTP code' };
    }

    if (otp.expiresAt < new Date()) {
      // Mark as used even though expired
      await (prisma as any).otpCode.update({
        where: { id: otp.id },
        data: { used: true }
      });
      return { valid: false, message: 'OTP code has expired' };
    }

    // Mark as used
    await (prisma as any).otpCode.update({
      where: { id: otp.id },
      data: { used: true }
    });

    return { valid: true };
  }

  /**
   * Clean up expired OTPs (can be called periodically)
   */
  static async cleanupExpiredOtps(): Promise<number> {
    const result = await (prisma as any).otpCode.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    return result.count;
  }
}

