import { NextRequest, NextResponse } from 'next/server';
import { getWorkerStatus } from '@/lib/queue-workers';

// Initialize queue workers
// This endpoint should be called on server startup or via a cron job
export async function POST(request: NextRequest) {
  try {
    const workers = getWorkerStatus();
    return NextResponse.json({
      success: true,
      message: 'Queue workers initialized',
      workers,
    });
  } catch (error) {
    console.error('Error initializing queue workers:', error);
    return NextResponse.json(
      { error: 'Failed to initialize queue workers' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET(request: NextRequest) {
  try {
    const workers = getWorkerStatus();
    return NextResponse.json({
      success: true,
      workers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Queue workers not available' },
      { status: 500 }
    );
  }
}

