import { PrismaClient } from '@prisma/client';
import { ABILITIES, ROLE_ABILITIES } from '../src/lib/permissions';

const prisma = new PrismaClient();

const ROLE_METADATA: Record<
  keyof typeof ROLE_ABILITIES,
  { description: string; displayName: string }
> = {
  SUPER_ADMIN: {
    displayName: 'Super Admin',
    description: 'Full system access with the ability to manage every module.',
  },
  ADMIN: {
    displayName: 'Admin',
    description: 'Manage core business modules and settings.',
  },
  SALES_MANAGER: {
    displayName: 'Sales Manager',
    description: 'Oversee sales pipelines, quotations, and related workflows.',
  },
  SALES_REP: {
    displayName: 'Sales Representative',
    description: 'Work daily leads, opportunities, and customer follow-ups.',
  },
  INVENTORY_MANAGER: {
    displayName: 'Inventory Manager',
    description: 'Manage stock levels, warehouses, and product availability.',
  },
  FINANCE_OFFICER: {
    displayName: 'Finance Officer',
    description: 'Handle invoicing, payments, credit notes, and financial reports.',
  },
  EXECUTIVE_VIEWER: {
    displayName: 'Executive Viewer',
    description: 'Read-only access to dashboards and analytics.',
  },
};

async function seedAbilities() {
  for (const [abilityName, description] of Object.entries(ABILITIES)) {
    const [resource, action] = abilityName.split('.');

    await prisma.ability.upsert({
      where: { name: abilityName },
      update: {
        resource,
        action,
        description,
      },
      create: {
        name: abilityName,
        resource,
        action,
        description,
      },
    });
  }
}

async function seedRolesAndAbilities() {
  for (const [roleName, abilities] of Object.entries(ROLE_ABILITIES)) {
    const metadata = ROLE_METADATA[roleName as keyof typeof ROLE_ABILITIES] ?? {
      displayName: roleName
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' '),
      description: `${roleName} role`,
    };

    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: metadata.description,
        isSystem: true,
        isActive: true,
      },
      create: {
        name: roleName,
        description: metadata.description,
        isSystem: true,
        isActive: true,
      },
    });

    for (const abilityName of abilities) {
      const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
      });

      if (!ability) {
        console.warn(
          `⚠️  Ability "${abilityName}" referenced by role "${roleName}" was not found. Skipping.`,
        );
        continue;
      }

      await prisma.roleAbility.upsert({
        where: {
          roleId_abilityId: {
            roleId: role.id,
            abilityId: ability.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          abilityId: ability.id,
        },
      });
    }
  }
}

async function assignAdminUser() {
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@adpools.com' },
  });

  if (!adminUser) {
    console.warn('⚠️  No user with email admin@adpools.com found. Skipping assignment.');
    return;
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
  });

  if (!superAdminRole) {
    console.warn('⚠️  SUPER_ADMIN role not found. Skipping assignment.');
    return;
  }

  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
      isActive: true,
      assignedBy: 'system',
    },
  });
}

async function main() {
  console.log('🌱 Seeding abilities...');
  await seedAbilities();
  console.log('🌱 Seeding roles and role abilities...');
  await seedRolesAndAbilities();
  console.log('🌱 Assigning SUPER_ADMIN role to admin@adpools.com...');
  await assignAdminUser();
  console.log('✅ Seeding complete.');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

