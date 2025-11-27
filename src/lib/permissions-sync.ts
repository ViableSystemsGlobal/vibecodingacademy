import { prisma } from "@/lib/prisma";
import { ABILITIES, ROLE_ABILITIES } from "@/lib/permissions";

type SyncSummary = {
  created: number;
  updated: number;
  skipped: number;
  missing?: string[];
};

const ROLE_METADATA: Record<
  keyof typeof ROLE_ABILITIES,
  { displayName: string; description: string }
> = {
  SUPER_ADMIN: {
    displayName: "Super Admin",
    description: "Full system access with the ability to manage every module.",
  },
  ADMIN: {
    displayName: "Admin",
    description: "Manage core business modules and settings.",
  },
  SALES_MANAGER: {
    displayName: "Sales Manager",
    description: "Oversee sales pipelines, quotations, and related workflows.",
  },
  SALES_REP: {
    displayName: "Sales Representative",
    description: "Work daily leads, opportunities, and customer follow-ups.",
  },
  INVENTORY_MANAGER: {
    displayName: "Inventory Manager",
    description: "Manage stock levels, warehouses, and product availability.",
  },
  FINANCE_OFFICER: {
    displayName: "Finance Officer",
    description: "Handle invoicing, payments, credit notes, and financial reports.",
  },
  EXECUTIVE_VIEWER: {
    displayName: "Executive Viewer",
    description: "Read-only access to dashboards and analytics.",
  },
};

function deriveMetadataFromKey(roleKey: string): {
  displayName: string;
  description: string;
} {
  const friendlyName = roleKey
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

  return {
    displayName: friendlyName,
    description: `${friendlyName} role`,
  };
}

function parseAbilityKey(abilityKey: string): {
  resource: string;
  action: string;
} {
  const segments = abilityKey.split(".");
  if (segments.length === 1) {
    return {
      resource: segments[0],
      action: "view",
    };
  }

  const [resource, ...rest] = segments;
  return {
    resource,
    action: rest.join(".") || "view",
  };
}

async function syncAbilities() {
  const summary: SyncSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  const abilityIdMap = new Map<string, string>();
  
  let existingAbilities;
  try {
    existingAbilities = await prisma.ability.findMany({
      select: { id: true, name: true, resource: true, action: true, description: true },
    });
  } catch (error: any) {
    // If table doesn't exist, start with empty array
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.warn("Abilities table not found, will create all abilities");
      existingAbilities = [];
    } else {
      throw error;
    }
  }

  const existingMap = new Map(
    existingAbilities.map((ability) => [ability.name, ability])
  );

  for (const [abilityKey, description] of Object.entries(ABILITIES)) {
    const { resource, action } = parseAbilityKey(abilityKey);
    const existing = existingMap.get(abilityKey);

    if (!existing) {
      const created = await prisma.ability.create({
        data: {
          name: abilityKey,
          resource,
          action,
          description,
        },
      });
      abilityIdMap.set(abilityKey, created.id);
      summary.created += 1;
      continue;
    }

    const needsUpdate =
      existing.resource !== resource ||
      existing.action !== action ||
      existing.description !== description;

    if (needsUpdate) {
      const updated = await prisma.ability.update({
        where: { id: existing.id },
        data: {
          resource,
          action,
          description,
        },
      });
      abilityIdMap.set(abilityKey, updated.id);
      summary.updated += 1;
    } else {
      abilityIdMap.set(abilityKey, existing.id);
      summary.skipped += 1;
    }
  }

  return { summary, abilityIdMap };
}

async function syncRoles(abilityIdMap: Map<string, string>) {
  const summary: SyncSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    missing: [],
  };

  for (const [roleKey, abilityKeys] of Object.entries(ROLE_ABILITIES)) {
    const metadata =
      ROLE_METADATA[roleKey as keyof typeof ROLE_ABILITIES] ??
      deriveMetadataFromKey(roleKey);

    let existingRole;
    try {
      existingRole = await prisma.role.findUnique({
        where: { name: roleKey },
      });
    } catch (error: any) {
      // If table doesn't exist, treat as new role
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn(`Roles table not found for role ${roleKey}, will create it`);
        existingRole = null;
      } else {
        throw error;
      }
    }

    let role;
    try {
      role = existingRole
        ? await prisma.role.update({
            where: { id: existingRole.id },
            data: {
              description: metadata.description,
              isSystem: true,
              isActive: true,
            },
          })
        : await prisma.role.create({
            data: {
              name: roleKey,
              description: metadata.description,
              isSystem: true,
              isActive: true,
            },
          });
    } catch (error: any) {
      console.error(`Error creating/updating role ${roleKey}:`, error);
      throw new Error(`Failed to sync role ${roleKey}: ${error.message}`);
    }

    summary[existingRole ? "updated" : "created"] += 1;

    const abilityRecords = abilityKeys
      .map((abilityKey) => {
        const abilityId = abilityIdMap.get(abilityKey);
        if (!abilityId) {
          summary.missing?.push(abilityKey);
          return null;
        }
        return abilityId;
      })
      .filter((value): value is string => Boolean(value));

    try {
      await prisma.roleAbility.deleteMany({
        where: { roleId: role.id },
      });

      if (abilityRecords.length > 0) {
        await prisma.roleAbility.createMany({
          data: abilityRecords.map((abilityId) => ({
            roleId: role.id,
            abilityId,
          })),
          skipDuplicates: true,
        });
      }
    } catch (error: any) {
      console.error(`Error syncing role abilities for ${roleKey}:`, error);
      throw new Error(`Failed to sync role abilities for ${roleKey}: ${error.message}`);
    }
  }

  return summary;
}

export async function syncPermissions() {
  try {
    console.log("Starting permissions sync...");
    const abilityResult = await syncAbilities();
    console.log("Abilities synced:", abilityResult.summary);
    
    const roleResult = await syncRoles(abilityResult.abilityIdMap);
    console.log("Roles synced:", roleResult);

    return {
      abilities: abilityResult.summary,
      roles: roleResult,
    };
  } catch (error: any) {
    console.error("Error in syncPermissions:", error);
    throw new Error(
      `Permission sync failed: ${error.message || "Unknown error"}. ` +
      `Code: ${error.code || "N/A"}. ` +
      `Check server logs for details.`
    );
  }
}

