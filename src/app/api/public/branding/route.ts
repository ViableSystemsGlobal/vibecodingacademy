import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get branding settings from database (public endpoint for login page)
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
            'chat_button_image',
            'hero_video',
            'chat_popup_image',
            'chat_popup_message',
            'newsletter_popup_image',
            'newsletter_popup_headline',
            'newsletter_popup_description',
            'newsletter_popup_success_message',
            'footer_logo',
          ]
        }
      }
    });

    // Convert to object format
    const brandingSettings = {
      companyName: settings.find(s => s.key === 'company_name')?.value || 'AdPools Group',
      companyLogo: settings.find(s => s.key === 'company_logo')?.value || '',
      favicon: settings.find(s => s.key === 'favicon')?.value || '/uploads/branding/favicon_default.svg',
      primaryColor: settings.find(s => s.key === 'primary_color')?.value || '#dc2626',
      secondaryColor: settings.find(s => s.key === 'secondary_color')?.value || '#b91c1c',
      description: settings.find(s => s.key === 'company_description')?.value || 'A practical, single-tenant system for sales and distribution management',
      chatButtonImage: settings.find(s => s.key === 'chat_button_image')?.value || '',
      chatPopupImage: settings.find(s => s.key === 'chat_popup_image')?.value || settings.find(s => s.key === 'chat_button_image')?.value || '',
      chatPopupMessage: settings.find(s => s.key === 'chat_popup_message')?.value || "👋 Hi {firstName}! I'm Kwame, your pool care assistant. I can help you find products, explain features, or check on existing orders. What would you like to know?",
      heroVideo: settings.find(s => s.key === 'ecommerce_hero_video')?.value || '',
      newsletterPopupImage: settings.find(s => s.key === 'newsletter_popup_image')?.value || '',
      newsletterPopupHeadline: settings.find(s => s.key === 'newsletter_popup_headline')?.value || 'Get 5% off your first order',
      newsletterPopupDescription: settings.find(s => s.key === 'newsletter_popup_description')?.value || 'Join our newsletter for pool care tips, new arrivals, and exclusive deals.',
      newsletterPopupSuccessMessage: settings.find(s => s.key === 'newsletter_popup_success_message')?.value || "You're on the list! Check your inbox for poolside inspiration soon.",
      footerLogo: settings.find(s => s.key === 'footer_logo')?.value || '',
    };

    return NextResponse.json(brandingSettings);

  } catch (error) {
    console.error('Error fetching public branding settings:', error);
    // Return default settings if database error
    return NextResponse.json({
      companyName: 'AdPools Group',
      companyLogo: '',
      favicon: '/uploads/branding/favicon_default.svg',
      primaryColor: '#dc2626',
      secondaryColor: '#b91c1c',
      description: 'A practical, single-tenant system for sales and distribution management',
      chatButtonImage: '',
      chatPopupImage: '',
      chatPopupMessage: "👋 Hi {firstName}! I'm Kwame, your pool care assistant. I can help you find products, explain features, or check on existing orders. What would you like to know?",
      heroVideo: '',
      newsletterPopupImage: '',
      newsletterPopupHeadline: 'Get 5% off your first order',
      newsletterPopupDescription: 'Join our newsletter for pool care tips, new arrivals, and exclusive deals.',
      newsletterPopupSuccessMessage: "You're on the list! Check your inbox for poolside inspiration soon.",
      footerLogo: '',
    });
  }
}
