import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get branding settings from database
    const settings = await prisma.systemSettings.findMany({
      where: {
        key: {
          in: [
            'company_name',
            'company_logo',
            'favicon',
            'primary_color',
            'secondary_color',
            'company_description',
            'pdf_header_image',
            'pdf_footer_image',
            'chat_button_image',
            'email_template_header',
            'email_template_footer',
            'ecommerce_hero_video',
            'newsletter_popup_image',
            'newsletter_popup_headline',
            'newsletter_popup_description',
            'newsletter_popup_success_message',
            'footer_logo',
            'chat_popup_message',
            'chat_popup_image'
          ]
        }
      }
    });

    // Convert to object format
    const brandingSettings = {
      companyName: settings.find(s => s.key === 'company_name')?.value || 'AdPools Group',
      companyLogo: settings.find(s => s.key === 'company_logo')?.value || '/uploads/branding/company_logo_default.svg',
      favicon: settings.find(s => s.key === 'favicon')?.value || '/uploads/branding/favicon_default.svg',
      primaryColor: settings.find(s => s.key === 'primary_color')?.value || '#dc2626',
      secondaryColor: settings.find(s => s.key === 'secondary_color')?.value || '#b91c1c',
      description: settings.find(s => s.key === 'company_description')?.value || 'A practical, single-tenant system for sales and distribution management',
      pdfHeaderImage: settings.find(s => s.key === 'pdf_header_image')?.value || '',
      pdfFooterImage: settings.find(s => s.key === 'pdf_footer_image')?.value || '',
      chatButtonImage: settings.find(s => s.key === 'chat_button_image')?.value || '',
      emailTemplateHeader: settings.find(s => s.key === 'email_template_header')?.value || '',
      emailTemplateFooter: settings.find(s => s.key === 'email_template_footer')?.value || '',
      heroVideo: settings.find(s => s.key === 'ecommerce_hero_video')?.value || '',
      chatPopupImage: settings.find(s => s.key === 'chat_popup_image')?.value || settings.find(s => s.key === 'chat_button_image')?.value || '',
      chatPopupMessage: settings.find(s => s.key === 'chat_popup_message')?.value || "👋 Hi {firstName}! I'm Kwame, your pool care assistant. I can help you find products, explain features, or check on existing orders. What would you like to know?",
      newsletterPopupImage: settings.find(s => s.key === 'newsletter_popup_image')?.value || '',
      newsletterPopupHeadline: settings.find(s => s.key === 'newsletter_popup_headline')?.value || 'Get 5% off your first order',
      newsletterPopupDescription: settings.find(s => s.key === 'newsletter_popup_description')?.value || 'Join our newsletter for pool care tips, new arrivals, and exclusive deals.',
      newsletterPopupSuccessMessage: settings.find(s => s.key === 'newsletter_popup_success_message')?.value || "You're on the list! Check your inbox for poolside inspiration soon.",
      footerLogo: settings.find(s => s.key === 'footer_logo')?.value || ''
    };

    return NextResponse.json(brandingSettings);

  } catch (error) {
    console.error('Error fetching branding settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyName,
      companyLogo,
      favicon,
      primaryColor,
      secondaryColor,
      description,
      pdfHeaderImage,
      pdfFooterImage,
      chatButtonImage,
      emailTemplateHeader,
      emailTemplateFooter,
      heroVideo,
      chatPopupImage,
      chatPopupMessage,
      newsletterPopupImage,
      newsletterPopupHeadline,
      newsletterPopupDescription,
      newsletterPopupSuccessMessage,
      footerLogo,
    } = body;

    // Validate required fields
    if (!primaryColor) {
      return NextResponse.json(
        { error: 'Primary color is required' },
        { status: 400 }
      );
    }

    // Update or create settings
    const settingsToUpdate = [
      { key: 'company_name', value: companyName || 'AdPools Group' },
      { key: 'company_logo', value: companyLogo || '' },
      { key: 'favicon', value: favicon || '' },
      { key: 'primary_color', value: primaryColor },
      { key: 'secondary_color', value: secondaryColor || primaryColor },
      { key: 'company_description', value: description || 'A practical, single-tenant system for sales and distribution management' },
      { key: 'pdf_header_image', value: pdfHeaderImage || '' },
      { key: 'pdf_footer_image', value: pdfFooterImage || '' },
      { key: 'chat_button_image', value: chatButtonImage || '' },
      { key: 'email_template_header', value: emailTemplateHeader || '' },
      { key: 'email_template_footer', value: emailTemplateFooter || '' },
      { key: 'ecommerce_hero_video', value: heroVideo || '' },
      { key: 'chat_popup_image', value: chatPopupImage || '' },
      { key: 'chat_popup_message', value: chatPopupMessage || "👋 Hi {firstName}! I'm Kwame, your pool care assistant. I can help you find products, explain features, or check on existing orders. What would you like to know?" },
      { key: 'newsletter_popup_image', value: newsletterPopupImage || '' },
      { key: 'newsletter_popup_headline', value: newsletterPopupHeadline || 'Get 5% off your first order' },
      { key: 'newsletter_popup_description', value: newsletterPopupDescription || 'Join our newsletter for pool care tips, new arrivals, and exclusive deals.' },
      { key: 'newsletter_popup_success_message', value: newsletterPopupSuccessMessage || "You're on the list! Check your inbox for poolside inspiration soon." },
      { key: 'footer_logo', value: footerLogo || '' },
    ];

    for (const setting of settingsToUpdate) {
      await prisma.systemSettings.upsert({
        where: { key: setting.key },
        update: { 
          value: String(setting.value || '')
        },
        create: {
          key: setting.key,
          value: String(setting.value || ''),
          category: 'branding'
        }
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error saving branding settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
