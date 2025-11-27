import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ROLE_ABILITIES, type Role } from '@/lib/permissions';

// Using centralized role abilities from permissions.ts

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If no role in session, return empty abilities (shouldn't happen, but be safe)
    if (!session.user.role) {
      console.log('🔍 No role in session, returning empty abilities');
      return NextResponse.json({
        success: true,
        abilities: [],
        source: 'no-role'
      });
    }

    // Try to get user's role assignments from database
    let userRoleAssignments = [];
    try {
      userRoleAssignments = await prisma.userRoleAssignment.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
        include: {
          role: {
            include: {
              roleAbilities: {
                include: {
                  ability: true
                }
              }
            }
          }
        }
      });
    } catch (dbError) {
      console.error('🔍 Database query failed:', dbError);
      // If database query fails, only use fallback for known system roles
      const userRole = session.user.role as Role;
      const knownSystemRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_REP', 'INVENTORY_MANAGER', 'FINANCE_OFFICER', 'EXECUTIVE_VIEWER'];
      if (knownSystemRoles.includes(userRole)) {
        const fallbackAbilities = ROLE_ABILITIES[userRole] || [];
      return NextResponse.json({
        success: true,
        abilities: fallbackAbilities,
          source: 'fallback-db-error-system-role'
        });
      } else {
        // Custom role - return empty abilities
        return NextResponse.json({
          success: true,
          abilities: [],
          source: 'fallback-db-error-custom-role'
      });
      }
    }

    // Extract all abilities from all assigned roles
    const abilities: string[] = [];
    try {
      userRoleAssignments.forEach(assignment => {
        if (assignment?.role?.roleAbilities) {
          assignment.role.roleAbilities.forEach(roleAbility => {
            if (roleAbility?.ability?.name && !abilities.includes(roleAbility.ability.name)) {
              abilities.push(roleAbility.ability.name);
            }
          });
        }
      });
      
      // Always add tasks.view for all users so they can access "My Tasks"
      if (!abilities.includes('tasks.view')) {
        abilities.push('tasks.view');
      }
    } catch (extractError) {
      console.error('🔍 Error extracting abilities:', extractError);
      // Only use fallback for known system roles
      const userRole = session.user.role as Role;
      const knownSystemRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_REP', 'INVENTORY_MANAGER', 'FINANCE_OFFICER', 'EXECUTIVE_VIEWER'];
      if (knownSystemRoles.includes(userRole)) {
        const fallbackAbilities = ROLE_ABILITIES[userRole] || [];
      return NextResponse.json({
        success: true,
        abilities: fallbackAbilities,
          source: 'fallback-extract-error-system-role'
      });
      } else {
        // Custom role - return empty abilities
        return NextResponse.json({
          success: true,
          abilities: [],
          source: 'fallback-extract-error-custom-role'
        });
      }
    }

    // If no abilities found from database, check if it's a known system role
    // Only fall back to hardcoded abilities for known system roles
    // Custom roles without abilities should get NO abilities
    if (abilities.length === 0) {
      console.log('🔍 No database abilities found for user');
      const userRole = session.user.role as Role;
      
      // Only use fallback for known system roles
      const knownSystemRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_REP', 'INVENTORY_MANAGER', 'FINANCE_OFFICER', 'EXECUTIVE_VIEWER'];
      if (knownSystemRoles.includes(userRole)) {
        console.log('🔍 Known system role, using baseline abilities for role:', userRole);
      const fallbackAbilities = ROLE_ABILITIES[userRole] || [];
      console.log('🔍 Fallback abilities count:', fallbackAbilities.length);
      // Ensure tasks.view is included
      const abilitiesWithTasks = fallbackAbilities.includes('tasks.view') 
        ? fallbackAbilities 
        : [...fallbackAbilities, 'tasks.view'];
      return NextResponse.json({
        success: true,
        abilities: abilitiesWithTasks,
          source: 'fallback-system-role'
        });
      } else {
        // Custom role with no abilities - but still give them tasks.view for My Tasks
        console.log('🔍 Custom role with no abilities, returning tasks.view only:', userRole);
        return NextResponse.json({
          success: true,
          abilities: ['tasks.view'],
          source: 'custom-role-no-abilities'
      });
      }
    }

    // Map database abilities to navigation abilities
    // ONLY add navigation abilities if user has the specific required abilities
    // Don't be generous - only grant what's explicitly assigned
    const navigationMapping = {
      'sales.view': ['invoices.view', 'payments.view', 'quotations.view'],
      'crm.view': ['leads.view', 'accounts.view', 'opportunities.view'],
      'drm.view': ['drm.view'], // Only grant if user explicitly has drm.view
      'inventory.view': ['inventory.view'],
      'communication.view': ['communication.view'],
      'agents.view': ['agents.view'],
      'reports.view': ['reports.view'],
      'settings.view': ['settings.view'],
      'tasks.view': ['tasks.view'],
      'dashboard.view': ['dashboard.view'],
      'ai_analyst.access': ['ai_analyst.access'],
      'ai-analyst.view': ['ai_analyst.access'],
    };

    // Add navigation abilities based on database abilities
    // Only add if user has the EXACT required ability, not inferred ones
    const enhancedAbilities = [...abilities];
    
    Object.entries(navigationMapping).forEach(([navAbility, requiredAbilities]) => {
      // User must have ALL required abilities (not just some)
      const hasAllRequired = requiredAbilities.every(required => abilities.includes(required));
      if (hasAllRequired && !enhancedAbilities.includes(navAbility)) {
        console.log(`✅ Adding navigation ability "${navAbility}" based on required abilities:`, requiredAbilities);
        enhancedAbilities.push(navAbility);
      }
    });

    // Add other expected abilities based on database abilities
    const abilityMappings = {
      // Core CRUD abilities
      'products.create': 'products.create',
      'products.edit': 'products.edit', 
      'products.delete': 'products.delete',
      'invoices.create': 'invoices.create',
      'invoices.edit': 'invoices.edit',
      'invoices.delete': 'invoices.delete',
      'payments.create': 'payments.create',
      'payments.edit': 'payments.edit',
      'leads.create': 'leads.create',
      'leads.update': 'leads.edit',
      'leads.delete': 'leads.delete',
      'leads.read': 'leads.view',
      'leads.bulk-delete': 'leads.manage',
      'leads.bulk-export': 'leads.manage',
      'leads.bulk-update': 'leads.manage',
      'accounts.create': 'accounts.create',
      'accounts.edit': 'accounts.edit',
      'accounts.delete': 'accounts.delete',
      'opportunities.create': 'opportunities.create',
      'opportunities.edit': 'opportunities.edit',
      'opportunities.delete': 'opportunities.delete',
      'quotations.create': 'quotations.create',
      'quotations.edit': 'quotations.edit',
      'quotations.delete': 'quotations.delete',
      'warehouses.create': 'warehouses.create',
      'warehouses.edit': 'warehouses.edit',
      'warehouses.delete': 'warehouses.delete',
      'users.create': 'users.create',
      'users.edit': 'users.edit',
      'users.delete': 'users.delete',
      'users.view': 'users.view',
      
      // Communication abilities (grant if user has users.manage)
      'sms.view': 'users.manage',
      'sms.send': 'users.manage',
      'sms.bulk_send': 'users.manage',
      'sms.history': 'users.manage',
      'email.view': 'users.manage',
      'email.send': 'users.manage',
      'email.bulk_send': 'users.manage',
      'email.history': 'users.manage',
      'templates.view': 'users.manage',
      'communication-logs.view': 'users.manage',
      
      // Tasks abilities
      'tasks.create': 'users.manage',
      'tasks.edit': 'users.manage',
      'tasks.delete': 'users.manage',
      'tasks.assign': 'users.manage',
      
      // Agents and commissions
      'agents.view': 'users.manage',
      'agents.create': 'users.manage',
      'agents.update': 'users.manage',
      'agents.delete': 'users.manage',
      'commissions.view': 'users.manage',
      'commissions.create': 'users.manage',
      'commissions.update': 'users.manage',
      'commissions.delete': 'users.manage',
      
      // Inventory abilities
      'stock.view': 'inventory.view',
      'stock.create': 'inventory.manage',
      'stock.edit': 'inventory.manage',
      'stock.delete': 'inventory.manage',
      'backorders.view': 'inventory.view',
      'backorders.create': 'inventory.manage',
      'backorders.edit': 'inventory.manage',
      'backorders.delete': 'inventory.manage',
      'price-lists.view': 'products.view',
      'price-lists.create': 'products.manage',
      'price-lists.edit': 'products.manage',
      'price-lists.delete': 'products.manage',
      
      // DRM abilities
      'distributor-leads.view': 'accounts.view',
      'distributor-leads.create': 'accounts.manage',
      'distributor-leads.edit': 'accounts.manage',
      'distributor-leads.delete': 'accounts.manage',
      'distributors.view': 'accounts.view',
      'distributors.create': 'accounts.manage',
      'distributors.edit': 'accounts.manage',
      'distributors.delete': 'accounts.manage',
      'routes-mapping.view': 'users.manage',
      'routes-mapping.create': 'users.manage',
      'routes-mapping.edit': 'users.manage',
      'routes-mapping.delete': 'users.manage',
      'engagement.view': 'users.manage',
      'engagement.create': 'users.manage',
      'engagement.edit': 'users.manage',
      'engagement.delete': 'users.manage',
      'drm-orders.view': 'accounts.view',
      
      // Sales abilities
      'orders.view': 'invoices.view',
      'proformas.view': 'quotations.view',
      'returns.view': 'invoices.view',
      'credit-notes.view': 'invoices.view',
      'credit-notes.create': 'invoices.manage',
      'credit-notes.edit': 'invoices.manage',
      'credit-notes.delete': 'invoices.manage',
      
      // Settings abilities
      'roles.view': 'roles.manage',
      'product-settings.view': 'settings.manage',
      'currency-settings.view': 'settings.manage',
      'business-settings.view': 'settings.manage',
      'google-maps.view': 'settings.manage',
      'google-maps.config': 'settings.manage',
      'credit-monitoring.view': 'settings.manage',
      'credit-monitoring.manage': 'settings.manage',
      'system-settings.view': 'settings.manage',
      'notifications.view': 'settings.manage',
      'notifications.create': 'settings.manage',
      'notifications.edit': 'settings.manage',
      'notifications.delete': 'settings.manage',
      'notifications.config': 'settings.manage',
      'ai-settings.view': 'settings.manage',
      'ai-settings.manage': 'settings.manage',
      
      // Additional settings abilities
      'notification-templates.view': 'settings.manage',
      'notification-templates.create': 'settings.manage',
      'notification-templates.edit': 'settings.manage',
      'notification-templates.delete': 'settings.manage',
      'task-templates.view': 'settings.manage',
      'task-templates.create': 'settings.manage',
      'task-templates.edit': 'settings.manage',
      'task-templates.delete': 'settings.manage',
      'lead-sources.view': 'settings.manage',
      'lead-sources.create': 'settings.manage',
      'lead-sources.edit': 'settings.manage',
      'lead-sources.delete': 'settings.manage',
      
      // Contact abilities
      'contacts.view': 'accounts.view',
      'contacts.create': 'accounts.manage',
      'contacts.edit': 'accounts.manage',
      'contacts.delete': 'accounts.manage'
    };

    Object.entries(abilityMappings).forEach(([expectedAbility, dbAbility]) => {
      if (abilities.includes(dbAbility) && !enhancedAbilities.includes(expectedAbility)) {
        enhancedAbilities.push(expectedAbility);
      }
    });
    
    // Only add baseline abilities for known system roles
    // Custom roles should only get abilities from their role assignments
    const userRole = session.user.role as Role;
    const knownSystemRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_REP', 'INVENTORY_MANAGER', 'FINANCE_OFFICER', 'EXECUTIVE_VIEWER'];
    
    if (knownSystemRoles.includes(userRole)) {
      // For known system roles, ensure baseline abilities are present
      let baselineAbilities = ROLE_ABILITIES[userRole] || [];
      if (userRole === 'ADMIN') {
        // ADMIN gets ADMIN abilities, not SUPER_ADMIN
        baselineAbilities = ROLE_ABILITIES['ADMIN'] || [];
      }
    baselineAbilities.forEach((ability) => {
      if (!enhancedAbilities.includes(ability)) {
        enhancedAbilities.push(ability);
      }
    });
    }
    // For custom roles, don't add any baseline abilities - only use what's assigned
    
    // Always ensure tasks.view is included for all users so they can access "My Tasks"
    if (!enhancedAbilities.includes('tasks.view')) {
      enhancedAbilities.push('tasks.view');
    }
    
    console.log('🔍 Database abilities found:', abilities.length, 'abilities');
    console.log('🔍 Database abilities:', abilities);
    console.log('🔍 Enhanced abilities count:', enhancedAbilities.length);
    console.log('🔍 Enhanced abilities:', enhancedAbilities);
    console.log('🔍 User role:', session.user.role);
    console.log('🔍 Is known system role:', knownSystemRoles.includes(userRole));

    return NextResponse.json({
      success: true,
      abilities: enhancedAbilities,
      source: 'database-enhanced',
      debug: {
        databaseAbilities: abilities,
        enhancedAbilities: enhancedAbilities,
        userRole: session.user.role,
        isKnownSystemRole: knownSystemRoles.includes(userRole)
      }
    });

  } catch (error) {
    console.error('Error fetching user abilities:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Fallback to hardcoded abilities if database query fails
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.role) {
        const userRole = session.user.role as Role;
        const fallbackAbilities = ROLE_ABILITIES[userRole] || [];
        console.log('🔍 Using fallback abilities due to error, role:', userRole, 'count:', fallbackAbilities.length);
        return NextResponse.json({
          success: true,
          abilities: fallbackAbilities,
          source: 'fallback-error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (fallbackError) {
      console.error('Error in fallback:', fallbackError);
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
