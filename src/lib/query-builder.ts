import { Prisma } from "@prisma/client";

/**
 * Standardized query builder for table endpoints
 * Handles filtering, sorting, and pagination consistently across all API routes
 */

export interface TableQueryParams {
  // Pagination
  page?: number;
  limit?: number;
  
  // Search
  search?: string;
  searchFields?: string[]; // Fields to search in (e.g., ['name', 'email', 'sku'])
  
  // Filtering
  filters?: Record<string, string | string[] | null>;
  
  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  
  // Date range filtering
  dateFrom?: string;
  dateTo?: string;
  dateField?: string; // Field to filter on (default: 'createdAt')
}

export interface TableQueryResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters?: Record<string, unknown>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export interface BuildWhereOptions {
  searchFields?: string[];
  customFilters?: (filters: Record<string, string | string[] | null>) => Prisma.InputJsonValue;
  dateField?: string;
  excludeFilters?: string[]; // Filter keys to exclude from standard processing (for computed fields)
}

/**
 * Builds a Prisma where clause from query parameters
 */
export function buildWhereClause(
  params: TableQueryParams,
  options: BuildWhereOptions = {}
): Prisma.InputJsonValue {
  const where: any = {};
  const { searchFields = [], customFilters, dateField = 'createdAt', excludeFilters = [] } = options;
  const excludeSet = new Set(excludeFilters);

  // Search across multiple fields
  if (params.search && searchFields.length > 0) {
    where.OR = searchFields.map((field) => {
      // Handle nested fields (e.g., 'category.name')
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          [parent]: {
            [child]: { contains: params.search }
          }
        };
      }
      return {
        [field]: { contains: params.search }
      };
    });
  }

  // Date range filtering
  if (params.dateFrom || params.dateTo) {
    where[dateField] = {};
    if (params.dateFrom) {
      where[dateField].gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(params.dateTo);
      endDate.setHours(23, 59, 59, 999);
      where[dateField].lte = endDate;
    }
  }

  // Custom filters (from options)
  if (customFilters && params.filters) {
    const customWhere = customFilters(params.filters);
    Object.assign(where, customWhere);
  }

  // Standard filters (direct field matching)
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      // Skip excluded filters (computed fields handled separately)
      if (excludeSet.has(key)) {
        return;
      }
      
      if (value === null || value === undefined || value === '') {
        return; // Skip empty filters
      }

      // Handle array values (IN clause)
      if (Array.isArray(value)) {
        if (value.length > 0) {
          where[key] = { in: value };
        }
      } else if (typeof value === 'string' && value.includes(',')) {
        // Comma-separated values
        where[key] = { in: value.split(',').map(s => s.trim()) };
      } else {
        where[key] = value;
      }
    });
  }

  return where;
}

/**
 * Builds Prisma orderBy clause from query parameters
 */
export function buildOrderBy(
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.InputJsonValue {
  if (!sortBy) {
    return { createdAt: 'desc' }; // Default sort
  }

  // Handle nested sorting (e.g., 'category.name')
  if (sortBy.includes('.')) {
    const [parent, child] = sortBy.split('.');
    return {
      [parent]: {
        [child]: sortOrder
      }
    };
  }

  return { [sortBy]: sortOrder };
}

/**
 * Parses query parameters from NextRequest
 */
export function parseTableQuery(request: Request): TableQueryParams {
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = searchParams.get('search') || undefined;
  const sortBy = searchParams.get('sortBy') || undefined;
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const dateField = searchParams.get('dateField') || undefined;

  // Extract all filter parameters (exclude known params)
  const knownParams = new Set(['page', 'limit', 'search', 'sortBy', 'sortOrder', 'dateFrom', 'dateTo', 'dateField', 'searchFields']);
  const filters: Record<string, string | string[] | null> = {};
  
  searchParams.forEach((value, key) => {
    if (!knownParams.has(key)) {
      filters[key] = value;
    }
  });

  return {
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    dateFrom,
    dateTo,
    dateField,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

/**
 * Builds a complete table query result
 */
export async function buildTableQuery<T>(
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  params: TableQueryParams,
  options: BuildWhereOptions & {
    include?: Prisma.InputJsonValue;
    select?: Prisma.InputJsonValue;
  } = {}
): Promise<TableQueryResult<T>> {
  const {
    searchFields = [],
    customFilters,
    dateField = 'createdAt',
    include,
    select,
  } = options;

  const where = buildWhereClause(params, { searchFields, customFilters, dateField });
  const orderBy = buildOrderBy(params.sortBy, params.sortOrder);
  
  const page = params.page || 1;
  const limit = params.limit || 10;
  const skip = (page - 1) * limit;

  // Execute query and count in parallel
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      ...(include && { include }),
      ...(select && { select }),
    }),
    model.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    filters: params.filters,
    sort: params.sortBy
      ? {
          field: params.sortBy,
          order: params.sortOrder || 'desc',
        }
      : undefined,
  };
}

