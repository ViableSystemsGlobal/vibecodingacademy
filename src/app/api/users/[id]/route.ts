import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";
import { mapRoleNameToUserRole, syncUserRoleAssignments } from "@/lib/user-role-service";

// GET /api/users/[id] - Get a specific user
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
    const user = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN','SUPER_ADMIN'].includes((session.user as any).role as any)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { name, email, phone, role, roleIds, isActive } = body;

    if (roleIds && !Array.isArray(roleIds)) {
      return NextResponse.json(
        { error: "roleIds must be an array" },
        { status: 400 }
      );
    }

    const mappedRole = role ? mapRoleNameToUserRole(role) : undefined;

    // Get current user data for audit trail
    const currentUser = await prisma.user.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let updatedUser = await prisma.user.update({
      where: { id: resolvedParams.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(mappedRole !== undefined && { role: mappedRole }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true
      }
    });

    if (Array.isArray(roleIds)) {
      const assignmentResult = await syncUserRoleAssignments(
        resolvedParams.id,
        roleIds,
        (session.user as any).id
      );

      const primaryAssignedRole = assignmentResult.roles[0]?.name;
      const derivedRole = mapRoleNameToUserRole(primaryAssignedRole);

      // Always try to update User.role if we have a valid enum mapping
      // If it's a custom role that doesn't map, User.role will remain unchanged
      // but the session will use the role from UserRoleAssignment
      if (derivedRole && derivedRole !== updatedUser.role) {
        updatedUser = await prisma.user.update({
          where: { id: resolvedParams.id },
          data: { role: derivedRole },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true
          }
        });
      } else if (!derivedRole && primaryAssignedRole) {
        // Custom role that doesn't map to enum - log it but don't update User.role
        // The JWT callback will use UserRoleAssignment to get the role name
        console.log(`Custom role "${primaryAssignedRole}" assigned to user ${resolvedParams.id} - User.role field not updated (not a valid enum value)`);
      }
    }

    await logAuditEvent({
      userId: (session.user as any).id,
      action: 'user.updated',
      resource: 'User',
      resourceId: resolvedParams.id,
      oldData: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        phone: currentUser.phone,
        role: currentUser.role,
        isActive: currentUser.isActive,
      },
      newData: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN','SUPER_ADMIN'].includes((session.user as any).role as any)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;

    // Prevent deleting yourself
    if (resolvedParams.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Get user data for audit trail
    const userToDelete = await prisma.user.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (!userToDelete) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for the most critical foreign key constraints before deletion
    try {
      // Check the most common relationships that would prevent deletion
      const criticalRelations = await Promise.all([
        (prisma as any).task.count({ where: { createdBy: resolvedParams.id } }),
        (prisma as any).task.count({ where: { assignedTo: resolvedParams.id } }),
        (prisma as any).account.count({ where: { ownerId: resolvedParams.id } }),
        (prisma as any).lead.count({ where: { ownerId: resolvedParams.id } })
      ]);

      const [tasksCreated, tasksAssigned, accounts, leads] = criticalRelations;
      
      // If there are critical relationships, show a helpful message
      if (tasksCreated > 0 || tasksAssigned > 0 || accounts > 0 || leads > 0) {
        return NextResponse.json(
          { 
            error: "Cannot delete user. User has associated data. Please reassign or delete these items first.",
            details: {
              tasksCreated,
              tasksAssigned,
              accounts,
              leads,
              message: "User has tasks, accounts, or leads that must be reassigned before deletion."
            }
          },
          { status: 400 }
        );
      }
    } catch (constraintError) {
      console.error('Error checking user constraints:', constraintError);
      // Don't fail here - let the database handle the constraint checking
    }

    // Delete user and all related data manually
    console.log('Starting manual cleanup of user data...');
    
    try {
      // Delete in the correct order to avoid foreign key constraint violations
      // First, delete records that reference this user but don't have cascade
      
      // Delete notifications (these are just logs, safe to delete)
      await (prisma as any).notification.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      // Delete audit logs (these are just logs, safe to delete)
      await (prisma as any).auditLog.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      // Delete email and SMS messages (these are just logs, safe to delete)
      await (prisma as any).emailMessage.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      await (prisma as any).smsMessage.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      // Delete email and SMS campaigns
      await (prisma as any).emailCampaign.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      await (prisma as any).smsCampaign.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      // Delete task-related data
      await (prisma as any).taskComment.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      await (prisma as any).taskAttachment.deleteMany({
        where: { uploadedBy: resolvedParams.id }
      });
      
      await (prisma as any).taskChecklistItem.deleteMany({
        where: { completedBy: resolvedParams.id }
      });
      
      await (prisma as any).taskAssignee.deleteMany({
        where: { userId: resolvedParams.id }
      });
      
      // Delete tasks created by this user (this will cascade to comments, attachments, etc.)
      await (prisma as any).task.deleteMany({
        where: { createdBy: resolvedParams.id }
      });
      
      // Reassign tasks assigned to this user to null
      await (prisma as any).task.updateMany({
        where: { assignedTo: resolvedParams.id },
        data: { assignedTo: null }
      });
      
      // Delete recurring tasks
      await (prisma as any).recurringTask.deleteMany({
        where: { 
          OR: [
            { createdBy: resolvedParams.id },
            { assignedTo: resolvedParams.id }
          ]
        }
      });
      
      // Delete task templates
      await (prisma as any).taskTemplate.deleteMany({
        where: { createdBy: resolvedParams.id }
      });
      
      // Delete CRM data
      await (prisma as any).backorder.deleteMany({
        where: { ownerId: resolvedParams.id }
      });
      
      await (prisma as any).proforma.deleteMany({
        where: { ownerId: resolvedParams.id }
      });
      
      await (prisma as any).quotation.deleteMany({
        where: { ownerId: resolvedParams.id }
      });
      
      await (prisma as any).lead.deleteMany({
        where: { ownerId: resolvedParams.id }
      });
      
      await (prisma as any).account.deleteMany({
        where: { ownerId: resolvedParams.id }
      });
      
      // Finally, delete the user
      await prisma.user.delete({
        where: { id: resolvedParams.id }
      });
      
      console.log('User and all related data deleted successfully');
      
    } catch (deleteError) {
      console.error('Error during user cleanup:', deleteError);
      return NextResponse.json(
        { 
          error: "Failed to delete user and related data. Please contact support.",
          details: deleteError instanceof Error ? deleteError.message : 'Unknown error occurred'
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error('Error deleting user:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: "Failed to delete user",
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
