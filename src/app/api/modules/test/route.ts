import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/modules/test
 * Test endpoint to check if modules table exists
 */
export async function GET(request: NextRequest) {
  try {
    // Try to query the modules table
    const count = await prisma.module.count();
    return NextResponse.json({ 
      success: true, 
      message: "Modules table exists",
      count 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      code: error.code,
      details: error.meta
    }, { status: 500 });
  }
}

