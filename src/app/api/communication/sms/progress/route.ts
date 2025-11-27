import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJobProgress } from '@/lib/queue-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const progress = await getJobProgress(jobId, 'sms');

    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error('Error getting SMS job progress:', error);
    return NextResponse.json(
      { error: 'Failed to get job progress' },
      { status: 500 }
    );
  }
}

