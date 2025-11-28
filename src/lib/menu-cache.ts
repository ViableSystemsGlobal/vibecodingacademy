import type { ModuleNavigationItem } from "@/modules/types";
import { getNavigationItemsSync } from "@/modules/registry";
import { MODULE_ACCESS } from "@/lib/permissions";

const CACHE_KEY_PREFIX = "menu_cache_";
const CACHE_VERSION = "1.0";
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedMenu {
  items: ModuleNavigationItem[];
  userId: string;
  abilitiesHash: string;
  userRole?: string;
  timestamp: number;
  version: string;
}

/**
 * Generate a hash from abilities array for cache invalidation
 */
function hashAbilities(abilities: string[]): string {
  return abilities.sort().join(",");
}

/**
 * Get cache key for a user
 */
function getCacheKey(userId: string, abilitiesHash: string, userRole?: string): string {
  const roleSuffix = userRole ? `_${userRole}` : "";
  return `${CACHE_KEY_PREFIX}${userId}_${abilitiesHash}${roleSuffix}`;
}

/**
 * Reconstruct menu items with icons from original navigation
 * (Icons can't be serialized to JSON, so we need to restore them)
 */
function reconstructMenuItems(
  cachedItems: ModuleNavigationItem[],
  allItems: ModuleNavigationItem[]
): ModuleNavigationItem[] {
  return cachedItems.map((cachedItem) => {
    // Find the original item to get the icon
    const originalItem = allItems.find(item => item.name === cachedItem.name && item.module === cachedItem.module);
    
    if (!originalItem) {
      // If original not found, skip this item
      return null;
    }

    const reconstructed: ModuleNavigationItem = {
      ...cachedItem,
      icon: originalItem.icon, // Restore icon from original
    };

    // Reconstruct children icons if they exist
    if (cachedItem.children && originalItem.children) {
      reconstructed.children = cachedItem.children.map((cachedChild) => {
        const originalChild = originalItem.children!.find(
          child => child.name === cachedChild.name && child.module === cachedChild.module
        );
        if (!originalChild) return null;
        return {
          ...cachedChild,
          icon: originalChild.icon, // Restore icon from original
        };
      }).filter((child): child is NonNullable<ModuleNavigationItem['children']>[0] => child !== null);
    }

    return reconstructed;
  }).filter((item): item is ModuleNavigationItem => item !== null);
}

/**
 * Map navigation module names to actual module slugs
 * This is needed because navigation items use permission module names (e.g., "dashboard")
 * but the actual module slugs are different (e.g., "core")
 */
function getModuleSlugForNavigationModule(navModule: string): string {
  const moduleMapping: Record<string, string> = {
    // Core module
    'dashboard': 'core',
    
    // CRM module
    'crm': 'crm',
    'leads': 'crm',
    'accounts': 'crm',
    'opportunities': 'crm',
    'contacts': 'crm',
    
    // DRM module
    'drm': 'drm',
    'distributor-leads': 'drm',
    'distributors': 'drm',
    'routes-mapping': 'drm',
    'engagement': 'drm',
    'drm-orders': 'drm',
    
    // Sales module
    'sales': 'sales',
    'orders': 'sales',
    'quotations': 'sales',
    'invoices': 'sales',
    'payments': 'sales',
    'returns': 'sales',
    'credit-notes': 'sales',
    'proformas': 'sales',
    
    // Inventory module
    'inventory': 'inventory',
    'products': 'inventory', // Products are part of inventory module
    'price-lists': 'inventory', // Price lists are part of inventory module
    'warehouses': 'inventory', // Warehouses are part of inventory module
    'backorders': 'inventory', // Backorders are part of inventory module
    
    // Ecommerce module
    'ecommerce': 'ecommerce',
    'ecommerce-orders': 'ecommerce',
    'ecommerce-abandoned-carts': 'ecommerce',
    'ecommerce-best-deals': 'ecommerce',
    'ecommerce-customers': 'ecommerce',
    'ecommerce-categories': 'ecommerce',
    'ecommerce-marketing': 'ecommerce',
    'ecommerce-settings': 'ecommerce',
    'ecommerce-cms': 'ecommerce',
    'ecommerce-analytics': 'ecommerce',
    
    // Tasks module
    'tasks': 'tasks',
    'my-tasks': 'tasks',
    'recurring-tasks': 'tasks',
    
    // Agents module
    'agents': 'agents',
    'commissions': 'agents',
    
    // Communication module
    'communication': 'communication',
    'sms': 'communication',
    'email': 'communication',
    'templates': 'communication',
    'communication-logs': 'communication',
    
    // Settings module
    'settings': 'settings',
    'users': 'settings',
    'roles': 'settings',
    'notifications': 'settings',
    'notification-templates': 'settings',
    'notification_templates': 'settings',
    'task-templates': 'settings',
    'task_templates': 'settings', // Task templates are in settings, not tasks module
    'lead-sources': 'settings',
    'lead_sources': 'settings',
    'product-settings': 'settings',
    'currency-settings': 'settings',
    'business-settings': 'settings',
    'google-maps': 'settings',
    'credit-monitoring': 'settings',
    'ai-settings': 'settings',
    'backup-settings': 'settings',
    'system-settings': 'settings',
    'modules': 'settings',
    'audit-trail': 'settings',
    'cron-settings': 'settings',
    
    // AI Analyst module
    'ai_analyst': 'ai-analyst',
    'ai-analyst': 'ai-analyst',
    
    // If no mapping found, assume the navModule is the same as the slug
  };
  return moduleMapping[navModule] || navModule;
}

/**
 * Get enabled module slugs from API
 */
async function getEnabledModuleSlugs(): Promise<Set<string> | null> {
  try {
    // Add cache-busting timestamp to ensure fresh data
    const response = await fetch(`/api/modules/enabled?t=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn('Failed to fetch enabled modules, will show all modules');
      return null; // Return null to indicate we should show all modules
    }
    const data = await response.json();
    const modules = data.modules || [];
    
    // If no modules in database, they haven't been synced yet - show all modules
    if (modules.length === 0) {
      console.log('No modules in database yet, showing all modules');
      return null;
    }
    
    // Only include modules where isEnabled is true
    const enabledSlugs = new Set<string>(
      modules
        .filter((m: { slug: string; isEnabled: boolean }) => m.isEnabled === true)
        .map((m: { slug: string }) => m.slug)
    );
    
    // Always include system modules (core is always enabled)
    enabledSlugs.add('core');
    
    console.log('✅ Enabled module slugs:', Array.from(enabledSlugs));
    
    return enabledSlugs;
  } catch (error) {
    console.warn('Error fetching enabled modules, will show all modules:', error);
    // Return null to show all modules as fallback
    return null;
  }
}

/**
 * Filter navigation items based on user abilities and enabled modules
 */
function filterNavigationItems(
  items: ModuleNavigationItem[],
  abilities: string[],
  canAccess: (module: string) => boolean,
  userRole?: string,
  enabledModuleSlugs?: Set<string> | null
): ModuleNavigationItem[] {
  console.log('🔍 Filtering navigation items:', {
    totalItems: items.length,
    enabledModuleSlugs: enabledModuleSlugs ? Array.from(enabledModuleSlugs) : 'null (showing all)',
    enabledCount: enabledModuleSlugs?.size || 0,
  });
  
  const isSuperAdmin =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'ADMIN' ||
    userRole === 'Super Admin' ||
    userRole === 'Admin' ||
    userRole?.toUpperCase() === 'SUPER_ADMIN' ||
    userRole?.toUpperCase() === 'ADMIN';

  console.log('🔍 Role check:', { userRole, isSuperAdmin, roleType: typeof userRole });

  if (isSuperAdmin) {
    console.log('👑 Super Admin detected - showing all enabled modules');
    return items
      .filter((item) => {
        if (enabledModuleSlugs !== null && enabledModuleSlugs !== undefined && enabledModuleSlugs.size > 0) {
          const moduleSlug = getModuleSlugForNavigationModule(item.module);
          const isEnabled = enabledModuleSlugs.has(moduleSlug);
          if (!isEnabled) {
            console.log(`⚠️ (SUPER_ADMIN) Filtering out ${item.name} - module ${item.module} (slug: ${moduleSlug}) not enabled`);
            return false;
          }
          console.log(`✅ (SUPER_ADMIN) Keeping ${item.name} - module ${item.module} (slug: ${moduleSlug}) is enabled`);
        }
        return true;
      })
      .map((item) => {
        let children = item.children;
        if (children && children.length > 0) {
          children = children.filter((child) => {
            if (enabledModuleSlugs !== null && enabledModuleSlugs !== undefined && enabledModuleSlugs.size > 0) {
              const childModuleSlug = getModuleSlugForNavigationModule(child.module);
              const isChildEnabled = enabledModuleSlugs.has(childModuleSlug);
              if (!isChildEnabled) {
                console.log(`⚠️ (SUPER_ADMIN) Filtering out child ${child.name} - module ${child.module} (slug: ${childModuleSlug}) not enabled`);
                return false;
              }
            }
            return true;
          });
        }
        return {
          ...item,
          children,
        };
      });
  }
  
  return items
    .filter((item) => {
      // Filter children first if they exist
      // This allows us to check if any children are enabled and accessible
      let filteredChildren: typeof item.children = undefined;
      if (item.children && item.children.length > 0) {
        // Check if user is SUPER_ADMIN or ADMIN - they should see all children
        const isSuperAdmin = userRole === 'SUPER_ADMIN' || 
                            userRole === 'ADMIN' || 
                            userRole === 'Super Admin' ||
                            userRole?.toUpperCase() === 'SUPER_ADMIN' ||
                            userRole?.toUpperCase() === 'ADMIN';
        
        filteredChildren = item.children.filter((child) => {
          // SUPER_ADMIN and ADMIN see all enabled children
          if (isSuperAdmin) {
            // Only check if module is enabled, not permissions
            if (enabledModuleSlugs !== null && enabledModuleSlugs !== undefined && enabledModuleSlugs.size > 0) {
              const childModuleSlug = getModuleSlugForNavigationModule(child.module);
              const isChildEnabled = enabledModuleSlugs.has(childModuleSlug);
              if (!isChildEnabled) {
                console.log(`⚠️ Filtering out child ${child.name} - module ${child.module} (slug: ${childModuleSlug}) not enabled`);
                return false;
              }
            }
            return true; // SUPER_ADMIN/ADMIN can see all enabled children
          }
          
          // For non-admin users, check permissions
          // Check if child's module is enabled (if we have enabled modules data)
          if (enabledModuleSlugs !== null && enabledModuleSlugs !== undefined && enabledModuleSlugs.size > 0) {
            const childModuleSlug = getModuleSlugForNavigationModule(child.module);
            const isChildEnabled = enabledModuleSlugs.has(childModuleSlug);
            if (!isChildEnabled) {
              console.log(`⚠️ Filtering out child ${child.name} - module ${child.module} (slug: ${childModuleSlug}) not enabled`);
              return false;
            }
          }
          
          // Special handling for Tasks module
          if (child.module === "tasks" || child.module === "my-tasks") {
            // All roles can access My Tasks
            if (child.module === "my-tasks") {
              return true;
            }
            // Only Super Admin and Admin can access All Tasks
            if (child.module === "tasks") {
              return userRole === "SUPER_ADMIN" || userRole === "ADMIN";
            }
          }
          // Special handling for audit-trail
          if (child.module === "audit-trail") {
            return userRole === "SUPER_ADMIN" || userRole === "ADMIN";
          }
          // Special handling for cron-settings
          if (child.module === "cron-settings") {
            return userRole === "SUPER_ADMIN" || userRole === "ADMIN";
          }
          // Special handling for modules (only SUPER_ADMIN and ADMIN)
          if (child.module === "modules") {
            return userRole === "SUPER_ADMIN" || userRole === "ADMIN";
          }
          // Check if user can access this child module
          return canAccess(child.module);
        });

        // Update children array with filtered children
        if (filteredChildren.length < item.children.length) {
          console.log(`🔍 ${item.name}: Filtered ${item.children.length} children to ${filteredChildren.length}`, {
            original: item.children.map(c => c.name),
            filtered: filteredChildren.map(c => c.name),
          });
        }
        item.children = filteredChildren;
      }

      // Check if parent module is enabled (only filter if we have enabled modules data)
      // BUT: Allow parent if any child is enabled and accessible, even if parent is disabled
      if (enabledModuleSlugs !== null && enabledModuleSlugs !== undefined && enabledModuleSlugs.size > 0) {
        const moduleSlug = getModuleSlugForNavigationModule(item.module);
        const isParentEnabled = enabledModuleSlugs.has(moduleSlug);
        const hasAccessibleChildren = filteredChildren && filteredChildren.length > 0;
        
        // If parent is not enabled, only show it if there are accessible children
        if (!isParentEnabled) {
          if (hasAccessibleChildren) {
            console.log(`✅ Keeping ${item.name} - parent module ${item.module} (slug: ${moduleSlug}) not enabled, but has accessible children`);
          } else {
            console.log(`⚠️ Filtering out ${item.name} - module ${item.module} (slug: ${moduleSlug}) not enabled and no accessible children`);
            return false;
          }
        } else {
          console.log(`✅ Keeping ${item.name} - module ${item.module} (slug: ${moduleSlug}) is enabled`);
        }
      }

      // Check if user can access this module OR if they have access to any children
      const hasParentAccess = canAccess(item.module);
      const hasAccessibleChildren = filteredChildren && filteredChildren.length > 0;
      const hasOwnHref = !!item.href;
      
      // Debug logging for all items
      console.log(`🔍 Checking ${item.name} (module: ${item.module}):`, {
        hasParentAccess,
        hasAccessibleChildren,
        filteredChildrenCount: filteredChildren?.length || 0,
        requiredAbilities: MODULE_ACCESS[item.module as keyof typeof MODULE_ACCESS] || [],
        userAbilities: abilities.slice(0, 10), // Show first 10 abilities for debugging
      });
      
      // CRITICAL: Only show items if user has access OR has accessible children
      // Having an href alone is NOT enough - user must have permission
      // This ensures users only see modules they're authorized to access
      if (!hasParentAccess && !hasAccessibleChildren) {
        console.log(`⚠️ Filtering out ${item.name} - user doesn't have access to module ${item.module} and no accessible children`, {
          module: item.module,
          abilities: abilities.slice(0, 10), // Show first 10 abilities for debugging
          requiredAbilities: MODULE_ACCESS[item.module as keyof typeof MODULE_ACCESS] || [],
          hasAccessibleChildren,
          hasOwnHref,
          hasParentAccess,
        });
        return false;
      }
      
      if (hasAccessibleChildren && !hasParentAccess) {
        console.log(`✅ Keeping ${item.name} - user has access to children even without parent access`, {
          accessibleChildren: filteredChildren?.map(c => c.name) || [],
        });
      } else if (hasParentAccess) {
        console.log(`✅ Keeping ${item.name} - user has access to module ${item.module}`);
      }

      return true;
    })
    .map((item) => ({
      ...item,
      children: item.children ? [...item.children] : undefined,
    }));
}

/**
 * Get cached menu or generate new one
 */
export async function getCachedMenu(
  userId: string | undefined,
  abilities: string[],
  canAccess: (module: string) => boolean,
  userRole?: string
): Promise<ModuleNavigationItem[]> {
  // Only run on client side
  if (typeof window === "undefined") {
    return getNavigationItemsSync();
  }

  // If no user ID, return unfiltered navigation (for public/loading states)
  if (!userId) {
    return getNavigationItemsSync();
  }

  // Store user role in sessionStorage for special module handling
  if (userRole) {
    try {
      sessionStorage.setItem("userRole", userRole);
    } catch (error) {
      // sessionStorage might not be available
      console.warn("Failed to set userRole in sessionStorage:", error);
    }
  }

  // Get enabled modules
  const enabledModuleSlugs = await getEnabledModuleSlugs();

  // Check if user is SUPER_ADMIN - bypass cache to ensure they always see everything
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || 
                      userRole === 'ADMIN' || 
                      userRole === 'Super Admin' ||
                      userRole === 'Admin' ||
                      userRole?.toUpperCase() === 'SUPER_ADMIN' ||
                      userRole?.toUpperCase() === 'ADMIN';

  const abilitiesHash = hashAbilities(abilities);
  const cacheKey = getCacheKey(userId, abilitiesHash, userRole);

  // For SUPER_ADMIN, always regenerate menu to ensure they see all enabled items
  if (!isSuperAdmin) {
    try {
      // Try to get from cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: CachedMenu = JSON.parse(cached);

        // Check if cache is valid
        if (
          parsed.version === CACHE_VERSION &&
          parsed.userId === userId &&
          parsed.abilitiesHash === abilitiesHash &&
          Date.now() - parsed.timestamp < CACHE_EXPIRY_MS
        ) {
          // For special role-based modules, verify role hasn't changed
          const needsRoleCheck = abilities.some(ability => 
            ability.includes('tasks') || ability.includes('audit')
          );
          if (!needsRoleCheck || parsed.userRole === userRole) {
            // Reconstruct icons from original navigation items (icons can't be serialized)
            const allItems = getNavigationItemsSync();
            const reconstructedItems = reconstructMenuItems(parsed.items, allItems);
            // Re-filter by enabled modules in case module status changed
            return filterNavigationItems(reconstructedItems, abilities, canAccess, userRole, enabledModuleSlugs);
          }
        }
      }
    } catch (error) {
      // If cache read fails, continue to generate new menu
      console.warn("Failed to read menu cache:", error);
    }
  } else {
    console.log('👑 SUPER_ADMIN detected - bypassing cache to ensure full menu visibility');
  }

  // Generate new menu
  const allItems = getNavigationItemsSync();
  console.log('🔍 Menu generation:', {
    totalItems: allItems.length,
    enabledModuleSlugs: enabledModuleSlugs ? Array.from(enabledModuleSlugs) : 'null (showing all)',
    itemNames: allItems.map(i => i.name),
  });
  const filteredItems = filterNavigationItems(allItems, abilities, canAccess, userRole, enabledModuleSlugs);
  console.log('✅ Filtered menu:', {
    filteredCount: filteredItems.length,
    filteredNames: filteredItems.map(i => i.name),
  });

  // Ensure we always return a valid array
  if (!Array.isArray(filteredItems)) {
    console.warn("filteredItems is not an array, returning empty array");
    return [];
  }

  // Cache the filtered menu
  try {
    const cacheData: CachedMenu = {
      items: filteredItems,
      userId,
      abilitiesHash,
      userRole,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    // Clean up old cache entries (keep only last 5)
    cleanupOldCacheEntries(userId);
  } catch (error) {
    // If cache write fails, continue without caching
    console.warn("Failed to write menu cache:", error);
  }

  return filteredItems;
}

/**
 * Invalidate menu cache for a user
 */
export function invalidateMenuCache(userId: string | undefined): void {
  if (!userId) return;

  try {
    // Remove all cache entries for this user
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(`${CACHE_KEY_PREFIX}${userId}_`)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Failed to invalidate menu cache:", error);
  }
}

/**
 * Clean up old cache entries, keeping only the most recent ones
 */
function cleanupOldCacheEntries(userId: string): void {
  try {
    const keys = Object.keys(localStorage);
    const userCacheKeys = keys.filter((key) =>
      key.startsWith(`${CACHE_KEY_PREFIX}${userId}_`)
    );

    if (userCacheKeys.length <= 5) {
      return; // Keep last 5 entries
    }

    // Sort by timestamp (newest first) and remove oldest
    const entries = userCacheKeys
      .map((key) => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed: CachedMenu = JSON.parse(cached);
            return { key, timestamp: parsed.timestamp };
          }
        } catch {
          // Invalid entry, mark for removal
        }
        return { key, timestamp: 0 };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    // Remove oldest entries (keep 5 most recent)
    entries.slice(5).forEach(({ key }) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn("Failed to cleanup menu cache:", error);
  }
}

/**
 * Clear all menu cache entries (useful for logout or cache reset)
 */
export function clearAllMenuCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Failed to clear menu cache:", error);
  }
}

