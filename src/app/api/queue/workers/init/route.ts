import { NextRequest, NextResponse } from 'next/server';

// Lazy import to avoid build-time Redis connection
async function getWorkerStatus() {
  try {
    const { getWorkerStatus: _getWorkerStatus } = await import('@/lib/queue-workers');
    return await _getWorkerStatus();
  } catch (error) {
    // During build or if Redis is unavailable, return default status
    return {
      email: false,
      sms: false,
    };
  }
}

// Initialize queue workers
// This endpoint should be called on server startup or via a cron job
export async function POST(request: NextRequest) {
  try {
    const workers = await getWorkerStatus();
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
    const workers = await getWorkerStatus();
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

