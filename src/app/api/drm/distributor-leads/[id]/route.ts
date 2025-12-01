import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCompanyName } from '@/lib/company-settings';
import nodemailer from 'nodemailer';

// Helper function to get setting value
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

// Send SMS notification
async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const smsUsername = await getSettingValue('SMS_USERNAME', '');
    const smsPassword = await getSettingValue('SMS_PASSWORD', '');
    const smsSenderId = await getSettingValue('SMS_SENDER_ID', 'AdPools');

    if (!smsUsername || !smsPassword) {
      console.error('SMS credentials not configured');
      return false;
    }

    const response = await fetch('https://deywuro.com/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: smsUsername,
        password: smsPassword,
        destination: phoneNumber,
        source: smsSenderId,
        message: message
      })
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);
    
    if (result.code === 0) {
      console.log('SMS sent successfully');
      return true;
    } else {
      console.error('SMS failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

// Send Email notification
async function sendEmail(to: string, subject: string, message: string): Promise<boolean> {
  try {
    const smtpHost = await getSettingValue('SMTP_HOST', '');
    const smtpPort = await getSettingValue('SMTP_PORT', '587');
    const smtpUsername = await getSettingValue('SMTP_USERNAME', '');
    const smtpPassword = await getSettingValue('SMTP_PASSWORD', '');
    const smtpFromAddress = await getSettingValue('SMTP_FROM_ADDRESS', '');
    const smtpFromName = await getSettingValue('SMTP_FROM_NAME', 'AdPools Group');
    const smtpEncryption = await getSettingValue('SMTP_ENCRYPTION', 'tls');

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      console.error('Email credentials not configured');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === 'ssl',
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: to,
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
    });

    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('GET /api/drm/distributor-leads/[id] - Requested ID:', id);

    // Check for corrupted ID (filename instead of proper ID) and clean it up
    if (id.includes('.jpg') || id.includes('.png') || id.includes('midnight') || id.length > 50) {
      console.log('🚫 Detected corrupted ID (filename), cleaning up:', id.substring(0, 50) + '...');
      
        // Try to delete the corrupted entry
        try {
          await (prisma as any).distributorLead.delete({
            where: { id }
          });
        console.log('✅ Deleted corrupted entry');
      } catch (deleteError) {
        console.log('Entry already deleted or not found');
      }
      
      return NextResponse.json(
        { success: false, error: 'Corrupted lead entry removed. Please refresh the page.' },
        { status: 404 }
      );
    }

    // Find the distributor lead by ID in database with images
    const lead = await (prisma as any).distributorLead.findUnique({
          where: { id },
          include: {
            images: true,
            interestedProducts: {
              include: {
                product: true
              }
            }
          }
        });

    if (!lead) {
      console.log('Lead not found for ID:', id);
      return NextResponse.json(
        { success: false, error: 'Distributor lead not found' },
        { status: 404 }
      );
    }

    // Clean up corrupted image entries for this lead
    if (lead.images && lead.images.length > 0) {
      const corruptedImages = lead.images.filter((image: any) => 
        image.filePath.includes('.jpg') && !image.filePath.startsWith('/uploads/') ||
        image.fileSize === 0 ||
        image.filePath.includes('midnight')
      );
      
      if (corruptedImages.length > 0) {
        console.log('🧹 Cleaning up', corruptedImages.length, 'corrupted images...');
        for (const corruptedImage of corruptedImages) {
          await (prisma as any).distributorLeadImage.delete({
            where: { id: corruptedImage.id }
          });
        }
        // Refetch the lead after cleanup
        const refreshedLead = await (prisma as any).distributorLead.findUnique({
          where: { id },
          include: {
            images: true,
            interestedProducts: {
              include: {
                product: true
              }
            }
          }
        });
        if (refreshedLead) {
          lead.images = refreshedLead.images;
          lead.interestedProducts = refreshedLead.interestedProducts;
        }
      }
    }

    console.log('📸 Lead data with images and products:', {
      id: lead.id,
      businessName: lead.businessName,
      imagesCount: lead.images?.length || 0,
      images: lead.images?.map((img: any) => ({
        id: img.id,
        imageType: img.imageType,
        filePath: img.filePath,
        originalName: img.originalName
      })) || [],
      interestedProductsCount: lead.interestedProducts?.length || 0,
      interestedProducts: lead.interestedProducts?.map((p: any) => ({
        id: p.id,
        productName: p.product?.name,
        productSku: p.product?.sku,
        interestLevel: p.interestLevel,
        quantity: p.quantity
      })) || [],
      legacyProfileImage: lead.profileImage
    });

    return NextResponse.json({
      success: true,
      data: lead
    });

  } catch (error) {
    console.error('Error fetching distributor lead:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Handle both JSON and FormData requests
    let body: any = {};
    
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('multipart/form-data')) {
      // Handle FormData (file uploads)
      const formData = await request.formData();
      
      // Convert FormData to object
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          // For now, just store the file name - in production, you'd save the file
          body[key] = value.name;
        } else if (key === 'interestedProducts') {
          // Parse JSON string for interested products
          try {
            body[key] = JSON.parse(value as string);
          } catch (error) {
            console.error('Error parsing interestedProducts:', error);
            body[key] = [];
          }
        } else {
          body[key] = value;
        }
      }
    } else {
      // Handle JSON requests
      body = await request.json();
    }

    // Handle interested products update
    if (body.interestedProducts && Array.isArray(body.interestedProducts)) {
      // Delete existing interested products
      await (prisma as any).distributorLeadProduct.deleteMany({
        where: { distributorLeadId: id }
      });

      // Create new interested products
      if (body.interestedProducts.length > 0) {
        await (prisma as any).distributorLeadProduct.createMany({
          data: body.interestedProducts.map((productId: string) => ({
            distributorLeadId: id,
            productId,
            quantity: 1,
            interestLevel: 'MEDIUM',
            addedBy: session.user.id
          }))
        });
      }
    }

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

    // Update the distributor lead in database
    const updatedLead = await (prisma as any).distributorLead.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth || null,
        businessName: body.businessName,
        businessType: body.businessType,
        businessRegistrationNumber: body.businessRegistrationNumber || null,
        yearsInBusiness: body.yearsInBusiness ? parseInt(body.yearsInBusiness) : null,
        address: body.address || null,
        city: body.city,
        region: body.region,
        country: body.country || 'Ghana',
        postalCode: body.postalCode || null,
        latitude: body.latitude ? parseFloat(body.latitude) : null,
        longitude: body.longitude ? parseFloat(body.longitude) : null,
        territory: body.territory || null,
            expectedVolume: body.salesVolume ? parseInt(body.salesVolume) : null,
        experience: body.experience || null,
        investmentCapacity: body.investmentCapacity || null,
        targetMarket: body.targetMarket || null,
        notes: body.notes || null,
        profileImage: body.profilePicture || body.profileImage || null,
        businessLicense: body.businessLicense || null,
        taxCertificate: body.taxCertificate || null,
        status: body.status || undefined
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
        // Ensure session user exists to satisfy FK on approvedBy
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
            approvedBy: ensuredUser.id
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
      const smsMessage = `Congratulations ${contactName}! Your distributor application for ${businessName} has been approved. Welcome to the ${companyName || 'Team'} family! You will receive further instructions via email.`;
      
      // Email Message
      const emailSubject = `Distributor Application Approved - ${businessName}`;
      const emailMessage = `Dear ${contactName},

Congratulations! We are pleased to inform you that your distributor application for ${businessName} has been approved.

Welcome to the ${companyName || 'Team'} family! As an approved distributor, you will have access to our comprehensive product range and support services.

Next Steps:
1. You will receive a welcome package with detailed information about our products and services
2. Our team will contact you within 2 business days to discuss your territory and sales targets
3. You will receive login credentials for our distributor portal
4. Training materials and product catalogs will be provided

If you have any questions, please don't hesitate to contact us.

Best regards,
${companyName || 'Team'}`;

      // Send notifications asynchronously (don't wait for them to complete)
      Promise.all([
        sendSMS(updatedLead.phone, smsMessage),
        sendEmail(updatedLead.email, emailSubject, emailMessage)
      ]).then(([smsSuccess, emailSuccess]) => {
        console.log(`Notifications sent for approved distributor ${id}: SMS=${smsSuccess}, Email=${emailSuccess}`);
      }).catch(error => {
        console.error('Error sending approval notifications:', error);
      });
      } else {
        console.log(`Distributor already exists for ${updatedLead.businessName}, skipping creation`);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedLead
    });

  } catch (error) {
    console.error('Error updating distributor lead:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete the distributor lead from database
        const deletedLead = await (prisma as any).distributorLead.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      data: deletedLead
    });

  } catch (error) {
    console.error('Error deleting distributor lead:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
