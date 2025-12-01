import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationService, SystemNotificationTriggers } from "@/lib/notification-service";
import { logAuditEvent } from "@/lib/audit-log";
import bcrypt from "bcryptjs";
import { parseTableQuery, buildWhereClause, buildOrderBy } from '@/lib/query-builder';
import { mapRoleNameToUserRole, syncUserRoleAssignments } from "@/lib/user-role-service";
import { getCompanyNameFromSystemSettings } from "@/lib/company-settings";

// GET /api/users - Get all users with pagination
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

      if (filters.role) {
        where.role = filters.role;
      }

      if (filters.status === 'active') {
        where.isActive = true;
      } else if (filters.status === 'inactive') {
        where.isActive = false;
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

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      }),
      prisma.user.count({ where })
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      sort: params.sortBy
        ? {
            field: params.sortBy,
            order: params.sortOrder || 'desc',
          }
        : undefined,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN','SUPER_ADMIN'].includes((session.user as any).role as any)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, phone, password, role, roleIds = [], sendInvitation = true } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { error: "Password is required and must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    if (roleIds && !Array.isArray(roleIds)) {
      return NextResponse.json(
        { error: "roleIds must be an array" },
        { status: 400 }
      );
    }

    const mappedRole = mapRoleNameToUserRole(role) || 'SALES_REP';

    // Hash password (required, validated above)
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed successfully');

    // Create user
    let user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashedPassword,
        role: mappedRole,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      } as any
    });

    if (Array.isArray(roleIds) && roleIds.length > 0) {
      const assignmentResult = await syncUserRoleAssignments(
        user.id,
        roleIds,
        (session.user as any).id
      );

      const primaryAssignedRole = assignmentResult.roles[0]?.name;
      const derivedRole = mapRoleNameToUserRole(primaryAssignedRole);

      if (derivedRole && derivedRole !== user.role) {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { role: derivedRole },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        });
        user = updatedUser;
      }
    }

    // Send notification to the new user
    if (sendInvitation && user.name) {
      const companyName = await getCompanyNameFromSystemSettings();
      const trigger = SystemNotificationTriggers.userInvited(
        user.name,
        session.user.name || session.user.email || 'System Administrator',
        companyName
      );
      await NotificationService.sendToUser(user.id, trigger);
    }

    // Notify admins about new user creation
    const adminTrigger = {
      type: 'SYSTEM_ALERT' as const,
      title: 'New User Created',
      message: `A new user "${user.name || user.email}" has been created with role "${role || 'Sales Rep'}"`,
      channels: ['IN_APP' as const, 'EMAIL' as const],
      data: { 
        newUserId: user.id, 
        newUserName: user.name, 
        newUserEmail: user.email,
        newUserRole: role
      }
    };
    await NotificationService.sendToAdmins(adminTrigger);

    // TODO: Send invitation email if requested
    if (sendInvitation) {
      // await sendUserInvitation(user.email, user.name);
    }

    await logAuditEvent({
      userId: (session.user as any).id,
      action: 'user.created',
      resource: 'User',
      resourceId: user.id,
      newData: user,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
