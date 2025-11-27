import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTableQuery, buildWhereClause, buildOrderBy } from "@/lib/query-builder";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['name', 'email', 'phone'],
      customFilters,
    });

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({
      suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      sort: params.sortBy
        ? {
            field: params.sortBy,
            order: params.sortOrder || 'desc',
          }
        : undefined,
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      city,
      country,
      taxId,
      paymentTerms,
      status,
      notes,
    } = body || {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        country: country || 'Ghana',
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        status: (status as any) || 'ACTIVE',
        notes: notes || null,
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    console.error("Error details:", error?.message);
    console.error("Error code:", error?.code);
    console.error("Error stack:", error?.stack);
    const message = error?.message || 'Failed to create supplier';
    return NextResponse.json({ error: message, details: error?.code }, { status: 500 });
  }
}


