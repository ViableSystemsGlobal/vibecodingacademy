import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { getCompanyName } from '@/lib/company-settings';
import nodemailer from 'nodemailer';

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// Helper function to get setting value
async function getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const setting = await (prisma as any).systemSettings.findUnique({
      where: { key }
    });
    return setting?.value || defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
}

// Helper function to send SMS
async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    console.log('📱 Starting SMS send process...');
    const smsUsername = await getSettingValue('SMS_USERNAME');
    const smsPassword = await getSettingValue('SMS_PASSWORD');
    const smsSenderId = await getSettingValue('SMS_SENDER_ID', await getCompanyName());
    
    console.log('📱 SMS Settings:', { 
      hasUsername: !!smsUsername, 
      hasPassword: !!smsPassword, 
      senderId: smsSenderId,
      phone: phone 
    });
    
    if (!smsUsername || !smsPassword) {
      console.error('❌ SMS configuration missing');
      return false;
    }

    // Send SMS using Deywuro API (same as working manual notifications)
    const smsResponse = await fetch('https://deywuro.com/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: smsUsername,
        password: smsPassword,
        destination: phone,
        source: smsSenderId || 'ADPOOLS',
        message: message
      })
    });

    console.log('📱 SMS API Response status:', smsResponse.status);
    const responseText = await smsResponse.text();
    console.log('📱 SMS API Response text:', responseText);
    const result = JSON.parse(responseText);
    console.log('📱 SMS API Result:', result);

    const success = result.code === 0;
    console.log('📱 SMS Send result:', success);
    return success;
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return false;
  }
}

// Helper function to send email
async function sendEmail(to: string, subject: string, message: string): Promise<boolean> {
  try {
    console.log('📧 Starting Email send process...');
    const smtpHost = await getSettingValue('SMTP_HOST');
    const smtpPort = await getSettingValue('SMTP_PORT', '587');
    const smtpUsername = await getSettingValue('SMTP_USERNAME');
    const smtpPassword = await getSettingValue('SMTP_PASSWORD');
    const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS');
    const smtpFromName = await getSettingValue('SMTP_FROM_NAME', await getCompanyName());
    const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');
    
    console.log('📧 Email Settings:', { 
      hasHost: !!smtpHost, 
      hasUsername: !!smtpUsername, 
      hasPassword: !!smtpPassword, 
      hasFromAddress: !!smtpFromAddress,
      to: to,
      subject: subject
    });
    
    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      console.error('❌ Email configuration missing');
      return false;
    }

    // Create transporter (same as working manual notifications)
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === 'ssl',
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
    });

    // Send email
    const mailOptions = {
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: to,
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
    };

    console.log('📧 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully:', { messageId: info.messageId });
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀🚀🚀 POST /api/drm/distributor-leads - Starting request processing 🚀🚀🚀');
    console.log('🚀🚀🚀 THIS IS A TEST LOG - IF YOU SEE THIS, THE API IS WORKING 🚀🚀🚀');
    
    const session = await getServerSession(authOptions);
    console.log('🔐 Session check:', { hasSession: !!session, userId: session?.user?.id });
    
    if (!session?.user?.id) {
      console.log('❌ Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the session user exists in DB to satisfy FK constraints
    const ensuredUser = await (prisma as any).user.upsert({
      where: { id: session.user.id },
      update: {},
      create: {
        id: session.user.id,
        email: session.user.email || 'admin@adpools.com',
        name: session.user.name || 'System Administrator',
        role: 'SUPER_ADMIN',
        isActive: true
      }
    });

    console.log('📝 Processing form data...');
    const formData = await request.formData();
    console.log('📝 Form data received, extracting fields...');
    
    // Extract form data
    const distributorLeadData = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      dateOfBirth: formData.get('dateOfBirth') as string,
      businessName: formData.get('businessName') as string,
      businessType: formData.get('businessType') as string,
      businessRegistrationNumber: formData.get('businessRegistrationNumber') as string,
      yearsInBusiness: formData.get('yearsInBusiness') as string,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      region: formData.get('region') as string,
      country: formData.get('country') as string,
      latitude: formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null,
      longitude: formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null,
      experience: formData.get('experience') as string,
      investmentCapacity: formData.get('investmentCapacity') as string,
      targetMarket: formData.get('targetMarket') as string,
      territory: formData.get('territory') as string,
      expectedVolume: formData.get('salesVolume') as string,
      notes: formData.get('notes') as string,
      interestedProducts: formData.getAll('interestedProducts') as string[],
      submittedBy: session.user.id,
      status: 'PENDING',
      createdAt: new Date(),
    };

    console.log('📝 Extracted form data:', {
      firstName: distributorLeadData.firstName,
      lastName: distributorLeadData.lastName,
      email: distributorLeadData.email,
      businessName: distributorLeadData.businessName,
      interestedProductsCount: distributorLeadData.interestedProducts?.length || 0
    });

    // Handle file uploads like the working products system
    console.log('📁 Processing file uploads...');
    const imagesToCreate: any[] = [];

    // Handle profile picture upload
    const profilePicture = formData.get('profilePicture') as File;
    if (profilePicture && profilePicture.size > 0) {
      try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = '/app/uploads/distributor-leads';
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = profilePicture.name.split('.').pop();
        const filename = `profile_${timestamp}-${profilePicture.name}`;
        const filepath = join(uploadsDir, filename);

        // Save file
        const bytes = await profilePicture.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);
        
        imagesToCreate.push({
          fileName: filename,
          originalName: profilePicture.name,
          filePath: `/uploads/distributor-leads/${filename}`, // Web-accessible path
          fileType: profilePicture.type,
          fileSize: profilePicture.size,
          imageType: 'PROFILE_PICTURE'
        });
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }

    // Create new distributor lead
    console.log('💾 Creating distributor lead in database...');
    // Create distributor lead in database with images
    const distributorLead = await (prisma as any).distributorLead.create({
      data: {
        firstName: distributorLeadData.firstName,
        lastName: distributorLeadData.lastName,
        email: distributorLeadData.email,
        phone: distributorLeadData.phone,
        dateOfBirth: distributorLeadData.dateOfBirth || null,
        businessName: distributorLeadData.businessName,
        businessType: distributorLeadData.businessType,
        businessRegistrationNumber: distributorLeadData.businessRegistrationNumber || null,
        yearsInBusiness: distributorLeadData.yearsInBusiness ? parseInt(distributorLeadData.yearsInBusiness) : null,
        address: distributorLeadData.address || null,
        city: distributorLeadData.city,
        region: distributorLeadData.region,
        country: distributorLeadData.country || 'Ghana',
        postalCode: formData.get('postalCode') as string || null,
        latitude: distributorLeadData.latitude,
        longitude: distributorLeadData.longitude,
        territory: distributorLeadData.territory || null,
        expectedVolume: distributorLeadData.expectedVolume ? parseInt(distributorLeadData.expectedVolume) : null,
        experience: distributorLeadData.experience || null,
        investmentCapacity: distributorLeadData.investmentCapacity || null,
        targetMarket: distributorLeadData.targetMarket || null,
        notes: distributorLeadData.notes || null,
        submittedBy: ensuredUser.id,
        status: 'PENDING',
        images: {
          create: imagesToCreate
        },
        interestedProducts: {
          create: (distributorLeadData.interestedProducts || []).map((productId: string) => ({
            productId,
            quantity: 1,
            interestLevel: 'MEDIUM',
            addedBy: ensuredUser.id
          }))
        }
      },
      include: {
        images: true
      }
    });

    console.log('✅ New distributor lead application created:', {
      id: distributorLead.id,
      businessName: distributorLead.businessName,
      email: distributorLead.email
    });

    const response = NextResponse.json({
      success: true,
      message: 'Distributor lead application submitted successfully',
      data: distributorLead
    });
    
    console.log('📤 Response being sent:', { status: 200, success: true });
    return response;

  } catch (error: any) {
    console.error('❌ Error creating distributor lead:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      name: error?.name
    });
    
    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        console.log('🔄 Returning P2002 error (duplicate email)');
        return NextResponse.json(
          { error: 'An application with this email already exists. Please use a different email address.' },
          { status: 400 }
        );
      }
    }
    
    console.log('🔄 Returning generic error response');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return distributor leads from database with images
    const leads = await (prisma as any).distributorLead.findMany({
      include: {
        images: true,
        interestedProducts: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({
      success: true,
      data: leads
    });

  } catch (error) {
    console.error('Error fetching distributor leads:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const body = await request.json();
    
    // Get the current lead to check if status is changing to APPROVED
    const currentLead = await (prisma as any).distributorLead.findUnique({
      where: { id },
      select: { 
        status: true, 
        firstName: true, 
        lastName: true, 
        businessName: true, 
        email: true, 
        phone: true,
        interestedProducts: {
          include: {
            product: true
          }
        }
      }
    });

    // Update the distributor lead using Prisma
    const updatedLead = await (prisma as any).distributorLead.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date()
      }
    });

    // Send notifications and create distributor record if status is APPROVED
    console.log('🔍 Approval check - body.status:', body.status, 'updatedLead.status:', updatedLead.status);
    if (body.status === 'APPROVED') {
      console.log('✅ Status is APPROVED, proceeding with distributor creation and notifications');
      // Check if distributor already exists to avoid duplicates
      const existingDistributor = await (prisma as any).distributor.findFirst({
        where: { email: updatedLead.email }
      });

      if (!existingDistributor) {
        const contactName = `${updatedLead.firstName} ${updatedLead.lastName}`;
        const businessName = updatedLead.businessName;
        
        // Create distributor record
        try {
          const distributor = await (prisma as any).distributor.create({
            data: {
              firstName: updatedLead.firstName,
              lastName: updatedLead.lastName,
              email: updatedLead.email,
              phone: updatedLead.phone,
              dateOfBirth: updatedLead.dateOfBirth,
              businessName: updatedLead.businessName,
              businessType: updatedLead.businessType,
              businessRegistrationNumber: updatedLead.businessRegistrationNumber,
              yearsInBusiness: updatedLead.yearsInBusiness,
              address: updatedLead.address,
              city: updatedLead.city,
              region: updatedLead.region,
              country: updatedLead.country,
              postalCode: updatedLead.postalCode,
              latitude: updatedLead.latitude,
              longitude: updatedLead.longitude,
              territory: updatedLead.territory,
              expectedVolume: updatedLead.expectedVolume,
              experience: updatedLead.experience,
              investmentCapacity: updatedLead.investmentCapacity,
              targetMarket: updatedLead.targetMarket,
              notes: updatedLead.notes,
              profileImage: updatedLead.profileImage,
              businessLicense: updatedLead.businessLicense,
              taxCertificate: updatedLead.taxCertificate,
              status: 'ACTIVE',
              approvedBy: session.user.id
            }
          });

          // Copy interested products to distributor
          if (currentLead.interestedProducts && currentLead.interestedProducts.length > 0) {
            await (prisma as any).distributorProduct.createMany({
              data: currentLead.interestedProducts.map((product: any) => ({
                distributorId: distributor.id,
                productId: product.productId,
                quantity: product.quantity || 1,
                interestLevel: product.interestLevel || 'MEDIUM',
                addedBy: session.user.id
              }))
            });
          }

          console.log(`Created distributor record for approved lead ${id}: ${distributor.id}`);
        } catch (error) {
          console.error('Error creating distributor record:', error);
        }
        
        const companyName = await getCompanyName();
        
        // SMS Message
        const smsMessage = `Congratulations ${contactName}! Your distributor application for ${businessName} has been approved. Welcome to the ${companyName || 'Team'} family! You will receive further instructions via email.`
        
        // Email Message
        const emailSubject = `Distributor Application Approved - ${businessName}`;
        const emailMessage = `Dear ${contactName},\n\nCongratulations! We are pleased to inform you that your distributor application for ${businessName} has been approved.\n\nWelcome to the ${companyName || 'Team'} family! As an approved distributor, you will have access to our comprehensive product range and support services.\n\nNext Steps:\n1. You will receive a welcome package with detailed information about our products and services\n2. Our team will contact you within 2 business days to discuss your territory and sales targets\n3. You will receive login credentials for our distributor portal\n4. Training materials and product catalogs will be provided\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\n${companyName || 'Team'}`;

        // Send notifications asynchronously (don't wait for them to complete)
        console.log('🔔 Starting approval notifications...');
        console.log('🔔 SMS Message:', smsMessage);
        console.log('🔔 Email Subject:', emailSubject);
        
        Promise.all([
          sendSMS(updatedLead.phone, smsMessage),
          sendEmail(updatedLead.email, emailSubject, emailMessage)
        ]).then(([smsSuccess, emailSuccess]) => {
          console.log(`✅ Notifications sent for approved distributor ${id}: SMS=${smsSuccess}, Email=${emailSuccess}`);
        }).catch(error => {
          console.error('❌ Error sending approval notifications:', error);
        });
      } else {
        console.log(`Distributor already exists for ${updatedLead.businessName}, skipping creation`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Distributor lead updated successfully',
      data: updatedLead
    });

  } catch (error) {
    console.error('Error updating distributor lead:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Delete the distributor lead using Prisma
    const deletedLead = await (prisma as any).distributorLead.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Distributor lead deleted successfully',
      data: deletedLead
    });

  } catch (error) {
    console.error('Error deleting distributor lead:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
