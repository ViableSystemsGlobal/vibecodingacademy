import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';

export async function GET(request: NextRequest) {
  try {
    const params = parseTableQuery(request);

    // Custom filter handler
    const customFilters = (filters: Record<string, string | string[] | null>) => {
      const where: any = {};

      // Default to active only if no status filter
      if (!filters.status || filters.status === 'active') {
        where.isActive = true;
      } else if (filters.status === 'inactive') {
        where.isActive = false;
      }

      return where;
    };

    const where = buildWhereClause(params, {
      searchFields: ['name', 'code', 'address', 'city', 'country'],
      customFilters,
    });

    // Ensure isActive filter is applied if not explicitly set
    if (!params.filters?.status) {
      where.isActive = true;
    }

    const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.warehouse.count({ where }),
    ]);

    return NextResponse.json({
      warehouses,
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
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating warehouse...');
    
    // Check if request is FormData (for image upload) or JSON
    const contentType = request.headers.get('content-type') || '';
    let name, code, address, city, country, image: File | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (with potential image upload)
      const formData = await request.formData();
      name = formData.get('name') as string;
      code = formData.get('code') as string;
      address = formData.get('address') as string;
      city = formData.get('city') as string;
      country = formData.get('country') as string;
      image = formData.get('image') as File | null;
    } else {
      // Handle JSON (backward compatibility)
    const body = await request.json();
      ({ name, code, address, city, country } = body);
    }

    console.log('Warehouse data:', { name, code, address, city, country });

    // Validate required fields
    if (!name || !code) {
      console.log('Validation failed: Missing name or code');
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Check if warehouse with same code already exists
    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { code },
    });

    if (existingWarehouse) {
      console.log(`Warehouse with code ${code} already exists:`, existingWarehouse);
      return NextResponse.json(
        { error: `Warehouse with code "${code}" already exists. Please use a different code.` },
        { status: 400 }
      );
    }

    // Handle image upload
    let imagePath: string | undefined = undefined;
    if (image && image.size > 0) {
      try {
        // Save to public/uploads/warehouses for development, or /app/uploads/warehouses for production
        const isProduction = process.env.NODE_ENV === 'production';
        const uploadsDir = isProduction 
          ? join('/app', 'uploads', 'warehouses')
          : join(process.cwd(), 'public', 'uploads', 'warehouses');
        await mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = image.name.split('.').pop();
        const uniqueId = randomUUID().substring(0, 8);
        const filename = `${code}-${timestamp}-${uniqueId}.${fileExtension}`;
        const filepath = join(uploadsDir, filename);

        // Convert File to Buffer and save
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Update image path (relative to uploads root)
        imagePath = `uploads/warehouses/${filename}`;
        console.log('Image uploaded successfully:', imagePath);
      } catch (error) {
        console.error('Error uploading image:', error);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    console.log('Creating warehouse in database...');
    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        code,
        address: address || null,
        city: city || null,
        country: country || null,
        image: imagePath,
        isActive: true, // Default to active
      },
    });

    console.log('✅ Warehouse created successfully:', warehouse);
    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating warehouse:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: `Failed to create warehouse: ${errorMessage}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
