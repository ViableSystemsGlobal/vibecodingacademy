import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public endpoint for fetching active banners (max 3)
export async function GET() {
  try {
    // Use type assertion to access Banner model if Prisma client doesn't recognize it
    const bannerModel = (prisma as any).banner;
    
    if (!bannerModel) {
      // If Banner model doesn't exist, return empty array
      return NextResponse.json({ banners: [] });
    }

    const banners = await bannerModel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      take: 3, // Maximum 3 banners
    });

    return NextResponse.json({ banners: banners || [] });
  } catch (error) {
    console.error('Error fetching banners:', error);
    // Return empty array on error instead of failing
    return NextResponse.json({ banners: [] });
  }
}

