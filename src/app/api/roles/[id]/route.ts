import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/roles/[id] - Get a specific role
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        roleAbilities: {
          include: {
            ability: true
          }
        },
        _count: {
          select: {
            userRoles: true
          }
        }
      }
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      { error: "Failed to fetch role" },
      { status: 500 }
    );
  }
}

// PUT /api/roles/[id] - Update a role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, abilities } = body;

    // Get current role data for audit trail
    const currentRole = await prisma.role.findUnique({
      where: { id },
      include: {
        roleAbilities: {
          include: {
            ability: true
          }
        }
      }
    });

    if (!currentRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if trying to update a system role
    if (currentRole.isSystem) {
      // Allow ability updates for Super Admin role, but block other modifications
      if (currentRole.name === 'Super Admin' && abilities && !name && description === undefined) {
        // Allow ability updates for Super Admin
      } else if (currentRole.name === 'Super Admin' && (name || description !== undefined)) {
        return NextResponse.json(
          { error: "Cannot modify Super Admin role name or description" },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: "Cannot modify system roles" },
          { status: 400 }
        );
      }
    }

    // Check if name already exists (if name is being changed)
    if (name && name !== currentRole.name) {
      const existingRole = await prisma.role.findUnique({
        where: { name }
      });

      if (existingRole) {
        return NextResponse.json(
          { error: "Role with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Update role
    const updateData: any = {};
    
    // For Super Admin, only allow ability updates
    if (currentRole.name === 'Super Admin') {
      if (abilities) {
        updateData.roleAbilities = {
          deleteMany: {}, // Remove all existing abilities
          create: abilities.map((abilityId: string) => ({
            abilityId
          }))
        };
      }
    } else {
      // For other roles, allow all updates
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (abilities) {
        updateData.roleAbilities = {
          deleteMany: {}, // Remove all existing abilities
          create: abilities.map((abilityId: string) => ({
            abilityId
          }))
        };
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: updateData,
      include: {
        roleAbilities: {
          include: {
            ability: true
          }
        },
        _count: {
          select: {
            userRoles: true
          }
        }
      }
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'role.updated',
        resource: 'Role',
        resourceId: id,
        oldData: currentRole,
        newData: updatedRole
      }
    });

    return NextResponse.json({ role: updatedRole });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}

// DELETE /api/roles/[id] - Delete a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Get role data for audit trail
    const roleToDelete = await prisma.role.findUnique({
      where: { id },
      include: {
        roleAbilities: {
          include: {
            ability: true
          }
        },
        _count: {
          select: {
            userRoles: true
          }
        }
      }
    });

    if (!roleToDelete) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if trying to delete a system role
    if (roleToDelete.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system roles" },
        { status: 400 }
      );
    }

    // Check if role is assigned to any users
    if (roleToDelete._count.userRoles > 0) {
      return NextResponse.json(
        { error: "Cannot delete role that is assigned to users" },
        { status: 400 }
      );
    }

    await prisma.role.delete({
      where: { id }
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'role.deleted',
        resource: 'Role',
        resourceId: id,
        oldData: roleToDelete
      }
    });

    return NextResponse.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    );
  }
}
