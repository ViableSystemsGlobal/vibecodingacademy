import { prisma } from '@/lib/prisma';

interface AuditLogParams {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditEvent({
  userId,
  action,
  resource,
  resourceId = null,
  oldData,
  newData,
  ipAddress,
  userAgent,
}: AuditLogParams) {
  if (!userId) {
    return;
  }

  try {
    const data: Record<string, unknown> = {
      userId,
      action,
      resource,
      resourceId,
    };

    if (oldData !== undefined) {
      data.oldData = oldData;
    }

    if (newData !== undefined) {
      data.newData = newData;
    }

    if (ipAddress) {
      data.ipAddress = ipAddress;
    }

    if (userAgent) {
      data.userAgent = userAgent;
    }

    await prisma.auditLog.create({ data });
  } catch (error) {
    console.error('Failed to write audit log', {
      action,
      resource,
      resourceId,
      error,
    });
  }
}

