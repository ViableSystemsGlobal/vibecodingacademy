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
  console.log('🔐 Creating abilities...');
  let created = 0;
  let updated = 0;

  for (const [abilityName, description] of Object.entries(ABILITIES)) {
    const [resource, action] = abilityName.split('.');

    const result = await prisma.ability.upsert({
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

    if (result) {
      // Check if it was created or updated by checking if it exists
      const existing = await prisma.ability.findUnique({ where: { name: abilityName } });
      if (existing) {
        // This is a simple check - in reality upsert doesn't tell us
        // But we can count total abilities
      }
    }
  }

  const totalAbilities = await prisma.ability.count();
  console.log(`✅ Abilities ready (${totalAbilities} total)`);
}

async function seedRolesAndAbilities() {
  console.log('👔 Creating roles and assigning abilities...');
  
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

    console.log(`  ✓ ${metadata.displayName} (${abilities.length} abilities)`);

    // Assign abilities to role
    let assignedCount = 0;
    for (const abilityName of abilities) {
      const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
      });

      if (!ability) {
        console.warn(
          `    ⚠️  Ability "${abilityName}" not found. Skipping.`,
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
      assignedCount++;
    }

    console.log(`    → Assigned ${assignedCount} abilities`);
  }
}

async function assignAdminUser() {
  console.log('👤 Assigning SUPER_ADMIN role to admin user...');
  
  const adminUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@adpools.com' },
        { role: 'SUPER_ADMIN' }
      ]
    },
  });

  if (!adminUser) {
    console.warn('⚠️  No admin user found. Skipping role assignment.');
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

  console.log(`✅ Assigned SUPER_ADMIN role to ${adminUser.email}`);
}

async function main() {
  console.log('🚀 Starting roles migration...\n');

  try {
    await seedAbilities();
    console.log('');
    await seedRolesAndAbilities();
    console.log('');
    await assignAdminUser();
    console.log('\n✅ Roles migration complete!');
    console.log('\n📋 Summary:');
    const roleCount = await prisma.role.count();
    const abilityCount = await prisma.ability.count();
    console.log(`   - ${roleCount} roles created`);
    console.log(`   - ${abilityCount} abilities available`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

