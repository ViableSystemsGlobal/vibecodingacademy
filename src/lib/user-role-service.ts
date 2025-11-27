import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

const ROLE_NAME_TO_ENUM: Record<string, UserRole> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  SALES_MANAGER: "SALES_MANAGER",
  SALES_REP: "SALES_REP",
  INVENTORY_MANAGER: "INVENTORY_MANAGER",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  EXECUTIVE_VIEWER: "EXECUTIVE_VIEWER",
};

export function mapRoleNameToUserRole(roleName?: string | null): UserRole | undefined {
  if (!roleName) return undefined;
  const normalized = roleName.trim();
  if (!normalized) return undefined;

  const upperKey = normalized.replace(/\s+/g, "_").toUpperCase();
  if (ROLE_NAME_TO_ENUM[upperKey]) {
    return ROLE_NAME_TO_ENUM[upperKey];
  }

  return ROLE_NAME_TO_ENUM[normalized.toUpperCase()];
}

export async function syncUserRoleAssignments(
  userId: string,
  roleIds: string[],
  assignedBy?: string
) {
  const uniqueRoleIds = Array.from(new Set(roleIds)).filter(Boolean);

  if (!uniqueRoleIds.length) {
    await prisma.userRoleAssignment.deleteMany({
      where: { userId },
    });
    return { assigned: 0, validRoleIds: [] as string[] };
  }

  const validRoles = await prisma.role.findMany({
    where: {
      id: {
        in: uniqueRoleIds,
      },
    },
    select: { id: true, name: true },
  });

  const validRoleIds = validRoles.map((role) => role.id);

  await prisma.$transaction([
    prisma.userRoleAssignment.deleteMany({
      where: { userId },
    }),
    prisma.userRoleAssignment.createMany({
      data: validRoleIds.map((roleId) => ({
        userId,
        roleId,
        assignedBy,
      })),
    }),
  ]);

  return {
    assigned: validRoleIds.length,
    validRoleIds,
    roles: validRoles,
  };
}

