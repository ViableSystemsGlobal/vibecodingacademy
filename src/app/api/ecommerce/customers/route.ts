import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const CUSTOMERS_PAGE_SIZE = 20;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function getEcommerceAccountIds(): Promise<string[]> {
  try {
    // First, get all leads with ECOMMERCE source and their account IDs
    const ecommerceLeads = await prisma.lead.findMany({
      where: {
            source: "ECOMMERCE",
            },
      select: {
        id: true,
        },
    });

    const leadIds = ecommerceLeads.map(l => l.id);
    
    if (leadIds.length === 0) {
      return [];
    }

    // Get account IDs from invoices linked to these leads
    const invoiceAccounts = await prisma.invoice.findMany({
      where: {
        accountId: { not: null },
        leadId: { in: leadIds },
      },
      select: { accountId: true },
      distinct: ["accountId"],
    });

    // Get account IDs from sales orders with ECOMMERCE source
    const salesOrderAccounts = await prisma.salesOrder.findMany({
      where: {
        accountId: { not: null },
            source: "ECOMMERCE",
          },
      select: { accountId: true },
      distinct: ["accountId"],
    });

    // Also get account IDs from sales orders linked to invoices from ecommerce leads
    const invoiceIds = await prisma.invoice.findMany({
      where: {
        leadId: { in: leadIds },
      },
      select: { id: true },
    }).then(invoices => invoices.map(inv => inv.id));

    const salesOrderAccountsFromInvoices = invoiceIds.length > 0
      ? await prisma.salesOrder.findMany({
          where: {
            accountId: { not: null },
            invoiceId: { in: invoiceIds },
          },
          select: { accountId: true },
          distinct: ["accountId"],
        })
      : [];

    const uniqueIds = new Set<string>();
    invoiceAccounts.forEach((entry) => {
      if (entry.accountId) uniqueIds.add(entry.accountId);
    });
    salesOrderAccounts.forEach((entry) => {
      if (entry.accountId) uniqueIds.add(entry.accountId);
    });
    salesOrderAccountsFromInvoices.forEach((entry) => {
      if (entry.accountId) uniqueIds.add(entry.accountId);
    });

    return Array.from(uniqueIds);
  } catch (error: any) {
    console.error("❌ Error in getEcommerceAccountIds:", error);
    // Return empty array on error to prevent API crash
    return [];
  }
}

async function getEcommerceCustomerEmails(): Promise<string[]> {
  try {
    const ordersWithEmails = await prisma.ecommerceOrder.findMany({
      select: { customerEmail: true },
      distinct: ["customerEmail"],
    });
    return ordersWithEmails
      .map((order) => order.customerEmail)
      .filter((email): email is string => Boolean(email));
  } catch (error: any) {
    if (error.code === "P2021" || error.message?.includes("does not exist")) {
      return [];
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Ecommerce Customers API - Request started");
    
    const session = await getServerSession(authOptions);
    console.log("🔍 Session check:", session ? "Authenticated" : "Not authenticated");
    
    if (!session?.user?.id) {
      console.log("❌ Unauthorized - no valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(
      searchParams.get("limit"),
      CUSTOMERS_PAGE_SIZE
    );
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status") || "all";
    
    console.log("🔍 Query params:", { page, limit, search, status });

    const skip = (page - 1) * limit;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log("🔍 Fetching ecommerce account IDs...");
    let allEcommerceAccountIds: string[] = [];
    try {
      allEcommerceAccountIds = await getEcommerceAccountIds();
      console.log("✅ Ecommerce account IDs found:", allEcommerceAccountIds.length);
    } catch (error: any) {
      console.error("❌ Error fetching ecommerce account IDs:", error);
      allEcommerceAccountIds = [];
    }

    console.log("🔍 Fetching ecommerce customer emails...");
    let ecommerceCustomerEmails: string[] = [];
    try {
      ecommerceCustomerEmails = await getEcommerceCustomerEmails();
      console.log("✅ Ecommerce customer emails found:", ecommerceCustomerEmails.length);
    } catch (error: any) {
      console.error("❌ Error fetching ecommerce customer emails:", error);
      ecommerceCustomerEmails = [];
    }

    // Build the base filter using direct ID lookup (much simpler and faster)
    const orConditions: Prisma.AccountWhereInput[] = [];
    if (allEcommerceAccountIds.length > 0) {
      orConditions.push({ id: { in: allEcommerceAccountIds } });
    }
    if (ecommerceCustomerEmails.length > 0) {
      orConditions.push({ email: { in: ecommerceCustomerEmails } });
    }

    // If no ecommerce customers found at all, return empty result early
    if (orConditions.length === 0) {
      console.log("⚠️ No ecommerce customers found in database");
      return NextResponse.json({
        data: [],
        metrics: {
          totalCustomers: 0,
          outstandingCod: 0,
          activeCustomers: 0,
          newCustomers: 0,
        },
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    const ecommerceSourceFilter: Prisma.AccountWhereInput = { OR: orConditions };
    const whereFilters: Prisma.AccountWhereInput[] = [ecommerceSourceFilter];

    if (search) {
      whereFilters.push({
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          {
            contacts: {
              some: {
                OR: [
                  { firstName: { contains: search } },
                  { lastName: { contains: search } },
                  { email: { contains: search } },
                  { phone: { contains: search } },
                ],
              },
            },
          },
        ],
      });
    }

    if (status === "overdue") {
      // Get account IDs with overdue ecommerce invoices
      const overdueAccountIds = await prisma.invoice.findMany({
        where: {
          accountId: { not: null },
            lead: { source: "ECOMMERCE" },
            paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
            dueDate: { lt: now },
          },
        select: { accountId: true },
        distinct: ['accountId'],
      }).then(invoices => invoices.map(inv => inv.accountId!).filter(Boolean));

      if (overdueAccountIds.length > 0) {
        whereFilters.push({
          id: { in: overdueAccountIds },
        });
      } else {
        // No overdue customers - return empty result immediately
        console.log("⚠️ No overdue ecommerce customers found");
        return NextResponse.json({
          data: [],
          metrics: {
            totalCustomers: 0,
            outstandingCod: 0,
            activeCustomers: 0,
            newCustomers: 0,
          },
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
        },
      });
      }
    } else if (status === "inactive") {
      // Get account IDs with recent activity (active in last 30 days)
      const activeAccountIds = await prisma.salesOrder.findMany({
        where: {
          accountId: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { accountId: true },
        distinct: ['accountId'],
      }).then(orders => orders.map(o => o.accountId!).filter(Boolean));

      // Filter to accounts that are NOT in the active list
      const inactiveAccountIds = allEcommerceAccountIds.filter(
        id => !activeAccountIds.includes(id)
      );
      
      if (inactiveAccountIds.length > 0) {
      whereFilters.push({
          id: { in: inactiveAccountIds },
        });
      } else {
        // All customers are active - return empty result immediately
        console.log("⚠️ No inactive ecommerce customers found (all are active)");
        return NextResponse.json({
          data: [],
          metrics: {
            totalCustomers: 0,
            outstandingCod: 0,
            activeCustomers: 0,
            newCustomers: 0,
          },
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
        },
      });
      }
    }

    const where: Prisma.AccountWhereInput =
      whereFilters.length === 1
        ? whereFilters[0]
        : {
            AND: whereFilters,
          };

    console.log("🔍 Querying accounts with filters...");
    const totalCustomers = await prisma.account.count({
      where,
    });
    console.log("✅ Total customers found:", totalCustomers);

    const accountRecords = await prisma.account.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
          select: {
            id: true,
            name: true,
            email: true,
        phone: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        contacts: {
          orderBy: { createdAt: "asc" },
                  take: 3,
                  select: {
                    id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    const accountIds = accountRecords.map((account) => account.id);

    if (accountIds.length === 0) {
      // Return empty result with metrics
      const [globalCustomers, outstandingTotal, activeCustomers, newCustomers] =
        await Promise.all([
          prisma.account.count({ where: ecommerceSourceFilter }),
          prisma.invoice.aggregate({
            _sum: { amountDue: true },
            where: {
              lead: { source: "ECOMMERCE" },
              paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
            },
          }),
          // Count distinct active account IDs (accounts with orders in last 30 days)
          allEcommerceAccountIds.length > 0
            ? prisma.salesOrder.groupBy({
            by: ["accountId"],
            where: {
                  accountId: { in: allEcommerceAccountIds },
              createdAt: { gte: thirtyDaysAgo },
            },
              }).then((groups) => groups.length)
            : Promise.resolve(0),
      prisma.account.count({
        where: {
              AND: [
                ecommerceSourceFilter,
                { createdAt: { gte: startOfMonth } },
              ],
            },
          }),
        ]);

      return NextResponse.json({
        data: [],
        metrics: {
          totalCustomers: globalCustomers,
          outstandingCod: Number(outstandingTotal._sum.amountDue || 0),
          activeCustomers,
          newCustomers,
        },
        pagination: {
          page,
          limit,
          total: totalCustomers,
          pages: Math.ceil(totalCustomers / limit) || 1,
        },
      });
    }

    // Get ecommerce-related invoices and sales orders
    // Since accounts are filtered by ecommerce source, their related orders are ecommerce orders
    const [
      salesAggregates,
      outstandingAggregates,
      recentSalesOrders,
      recentThirtyDayCounts,
      globalCustomers,
      outstandingTotal,
      activeCustomers,
      newCustomers,
    ] = await Promise.all([
      accountIds.length > 0 ? prisma.salesOrder.groupBy({
        by: ["accountId"],
        where: {
          accountId: { in: accountIds },
            },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      }) : Promise.resolve([]),
      accountIds.length > 0 ? prisma.invoice.groupBy({
        by: ["accountId"],
        where: {
          accountId: { in: accountIds },
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
                },
        _sum: { amountDue: true },
      }) : Promise.resolve([]),
      accountIds.length > 0 ? prisma.salesOrder.findMany({
        where: {
          accountId: { in: accountIds },
        },
        orderBy: { createdAt: "desc" },
        include: {
          invoice: {
            select: {
              paymentStatus: true,
              amountDue: true,
              amountPaid: true,
              number: true,
            },
          },
        },
        take: accountIds.length * 5,
      }) : Promise.resolve([]),
      accountIds.length > 0 ? prisma.salesOrder.groupBy({
        by: ["accountId"],
        where: {
          accountId: { in: accountIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { _all: true },
      }) : Promise.resolve([]),
      prisma.account.count({ where: ecommerceSourceFilter }),
      prisma.invoice.aggregate({
        _sum: { amountDue: true },
        where: {
          lead: { source: "ECOMMERCE" },
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
      }),
      allEcommerceAccountIds.length > 0
        ? prisma.salesOrder.count({
        where: {
              accountId: { in: allEcommerceAccountIds },
          createdAt: { gte: thirtyDaysAgo },
          },
        distinct: ["accountId"],
          })
        : Promise.resolve(0),
      prisma.account.count({
        where: {
          AND: [ecommerceSourceFilter, { createdAt: { gte: startOfMonth } }],
        },
      }),
    ]);

    const salesAggregateMap = new Map<
      string,
      {
        totalOrders: number;
        totalValue: number;
        lastOrderAt: Date | null;
      }
    >();

    salesAggregates.forEach((entry) => {
      salesAggregateMap.set(entry.accountId, {
        totalOrders: entry._count._all,
        totalValue: Number(entry._sum.total || 0),
        lastOrderAt: entry._max.createdAt,
      });
    });

    const outstandingMap = new Map<string, number>();
    outstandingAggregates.forEach((entry) => {
      outstandingMap.set(entry.accountId, Number(entry._sum.amountDue || 0));
    });

    const recentOrderMap = new Map<
      string,
      Array<{
        id: string;
        number: string;
        status: string;
        createdAt: string;
        total: number;
        paymentStatus: string | null;
        amountDue: number;
        amountPaid: number;
      }>
    >();

    const lastOrderSnapshot = new Map<
      string,
      {
        id: string;
        number: string;
        status: string;
        createdAt: string;
        total: number;
        paymentStatus: string | null;
        amountDue: number;
        amountPaid: number;
      }
    >();

    for (const order of recentSalesOrders) {
      const bucket = recentOrderMap.get(order.accountId) || [];
      if (bucket.length < 3) {
        bucket.push({
          id: order.id,
          number: order.number,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          total: Number(order.total),
          paymentStatus: order.invoice?.paymentStatus ?? null,
          amountDue: Number(order.invoice?.amountDue || 0),
          amountPaid: Number(order.invoice?.amountPaid || 0),
        });
        recentOrderMap.set(order.accountId, bucket);
        }

      if (!lastOrderSnapshot.has(order.accountId)) {
        lastOrderSnapshot.set(order.accountId, {
          id: order.id,
          number: order.number,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          total: Number(order.total),
          paymentStatus: order.invoice?.paymentStatus ?? null,
          amountDue: Number(order.invoice?.amountDue || 0),
          amountPaid: Number(order.invoice?.amountPaid || 0),
        });
      }
    }

    const recentActivityMap = new Map<string, number>();
    recentThirtyDayCounts.forEach((entry) => {
      recentActivityMap.set(entry.accountId, entry._count._all);
    });

    const customers = accountRecords.map((account) => {
      const aggregate = salesAggregateMap.get(account.id);
      const outstanding = outstandingMap.get(account.id) || 0;
      const latestOrder = lastOrderSnapshot.get(account.id) || null;
      const recentOrders = recentOrderMap.get(account.id) || [];

      const recentOrderCount =
        recentActivityMap.get(account.id) && aggregate
          ? recentActivityMap.get(account.id)!
          : recentActivityMap.get(account.id) || 0;

      const codStatus =
        outstanding > 0
          ? "OUTSTANDING"
          : latestOrder?.paymentStatus === "PAID"
          ? "CLEAR"
          : "CLEAR";

      return {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        type: account.type,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        owner: account.owner,
        contacts: account.contacts.map((contact) => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          role: contact.role,
        })),
        metrics: {
          totalOrders: aggregate?.totalOrders || 0,
          totalValue: aggregate?.totalValue || 0,
          outstandingBalance: outstanding,
          lastOrderDate: aggregate?.lastOrderAt
            ? aggregate.lastOrderAt.toISOString()
            : null,
          ordersLast30Days: recentOrderCount,
        },
        latestOrder,
        recentOrders,
        status: codStatus,
      };
    });

    console.log("✅ Successfully fetched", customers.length, "ecommerce customers");

    return NextResponse.json({
      data: customers,
      metrics: {
        totalCustomers: globalCustomers,
        outstandingCod: Number(outstandingTotal._sum.amountDue || 0),
        activeCustomers,
        newCustomers,
      },
      pagination: {
        page,
        limit,
        total: totalCustomers,
        pages: Math.ceil(totalCustomers / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR in ecommerce customers API:", error);
    console.error("❌ Error type:", error?.constructor?.name || typeof error);
    console.error("❌ Error message:", error?.message || String(error));
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("❌ Error code:", error?.code);
    console.error("❌ Error meta:", error?.meta);
    
    return NextResponse.json(
      {
        error: "Failed to fetch ecommerce customers",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? `${error.message}${error.code ? ` (Code: ${error.code})` : ''}`
            : undefined,
        stack:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}


