import { NextRequest, NextResponse } from "next/server";
import IORedis from "ioredis";
import { getQueueSettings } from "@/lib/queue-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const queueSettings = await getQueueSettings();
    const redisUrl = body.redisUrl || queueSettings.redisUrl || process.env.REDIS_URL || "redis://localhost:6379";

    const start = Date.now();
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    await client.ping();
    await client.quit();

    const latency = Date.now() - start;

    return NextResponse.json({
      success: true,
      status: "healthy",
      latency,
      redisUrl,
    });
  } catch (error) {
    console.error("Queue health check failed:", error);
    return NextResponse.json(
      {
        success: false,
        status: "unreachable",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

