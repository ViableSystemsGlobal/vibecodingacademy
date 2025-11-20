import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabaseInfo, formatBytes, getUploadsSize } from '@/lib/db-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get database file info
    const dbInfo = getDatabaseInfo();
    
    // Get uploads size
    const uploadsInfo = getUploadsSize();
    
    // Get total record counts from main tables
    const [
      totalUsers,
      totalAccounts,
      totalContacts,
      totalLeads,
      totalProducts,
      totalInvoices,
      totalQuotations,
      totalOrders
    ] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.account.count().catch(() => 0),
      prisma.contact.count().catch(() => 0),
      prisma.lead.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.invoice.count().catch(() => 0),
      prisma.quotation.count().catch(() => 0),
      prisma.order.count().catch(() => 0)
    ]);

    const totalRecords = totalUsers + totalAccounts + totalContacts + totalLeads + 
                        totalProducts + totalInvoices + totalQuotations + totalOrders;

    return NextResponse.json({
      databaseSize: dbInfo.exists && dbInfo.size ? formatBytes(dbInfo.size) : 'N/A',
      uploadsSize: formatBytes(uploadsInfo.size),
      uploadsFileCount: uploadsInfo.fileCount,
      totalRecords,
      databaseExists: dbInfo.exists,
      databasePath: dbInfo.path,
      isPostgreSQL: !dbInfo.path, // If no path, likely PostgreSQL
      totalBackupSize: dbInfo.exists && dbInfo.size 
        ? formatBytes(dbInfo.size + uploadsInfo.size) 
        : 'N/A'
    });

  } catch (error) {
    console.error('Error getting backup info:', error);
    return NextResponse.json(
      { error: 'Failed to get backup info' },
      { status: 500 }
    );
  }
}

