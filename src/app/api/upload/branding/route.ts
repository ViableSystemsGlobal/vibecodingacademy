import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (
      !type ||
      ![
        "companyLogo",
        "favicon",
        "pdfHeaderImage",
        "pdfFooterImage",
        "chatButtonImage",
        "heroVideo",
        "banner",
        "chatPopupImage",
        "footerLogo",
        "newsletterPopupImage",
        "seoOgImage",
      ].includes(type)
    ) {
      return NextResponse.json({ success: false, message: 'Invalid upload type' }, { status: 400 });
    }

    // Create uploads directory - use public/uploads for development, /app/uploads for production
    const isProduction = process.env.NODE_ENV === 'production';
    const folderMap: Record<string, string> = {
      companyLogo: 'branding',
      favicon: 'branding',
      pdfHeaderImage: 'branding',
      pdfFooterImage: 'branding',
      chatButtonImage: 'branding',
      chatPopupImage: 'branding',
      newsletterPopupImage: 'branding',
      heroVideo: 'branding',
      footerLogo: 'branding',
      banner: 'banners',
      seoOgImage: 'branding',
    };
    const uploadsSubDir = folderMap[type] || 'branding'; // Default to 'branding' if type not found
    const uploadsDir = isProduction 
      ? join('/app', 'uploads', uploadsSubDir)
      : join(process.cwd(), 'public', 'uploads', uploadsSubDir);
    console.log('🔍 Branding Upload API - Upload directory:', uploadsDir);
    console.log('🔍 Branding Upload API - Environment:', isProduction ? 'production' : 'development');
    
    if (!existsSync(uploadsDir)) {
      console.log('🔍 Branding Upload API - Creating directory');
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${type}_${Date.now()}${fileExtension}`;
    const filePath = join(uploadsDir, fileName);
    console.log('🔍 Branding Upload API - Saving file to:', filePath);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    console.log('✅ Branding Upload API - File saved successfully');

    // Return the public URL (always use /uploads path for serving)
    const publicUrl = `/uploads/${uploadsSubDir}/${fileName}`;

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      fileName: fileName
    });

  } catch (error) {
    console.error('Error uploading branding asset:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
