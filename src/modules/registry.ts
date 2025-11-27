import type { ModuleDefinition, ModuleNavigationItem } from "./types";
import { ModuleManager } from "@/lib/module-manager";

import agents from "./agents/module";
import ai from "./ai/module";
import communication from "./communication/module";
import core from "./core/module";
import crm from "./crm/module";
import drm from "./drm/module";
import ecommerce from "./ecommerce/module";
import inventory from "./inventory/module";
import projects from "./projects/module";
import reports from "./reports/module";
import sales from "./sales/module";
import settings from "./settings/module";
import tasks from "./tasks/module";

const DEFAULT_PRIORITY = 1000;

const registeredModules: ModuleDefinition[] = [
  core,
  crm,
  drm,
  projects,
  sales,
  inventory,
  ecommerce,
  communication,
  agents,
  tasks,
  reports,
  ai,
  settings,
];

const sortedModules = [...registeredModules].sort((a, b) => {
  const priorityA = a.priority ?? DEFAULT_PRIORITY;
  const priorityB = b.priority ?? DEFAULT_PRIORITY;
  return priorityA - priorityB;
});

const sortedNavigation: ModuleNavigationItem[] = sortedModules
  .flatMap((module, moduleIndex) => {
    if (!module.navigation) {
      return [];
    }

    const baseOrder = module.priority ?? (moduleIndex + 1) * DEFAULT_PRIORITY;

    return module.navigation.map((item, itemIndex) => {
      const computedOrder = item.order ?? baseOrder + itemIndex;
      const children = item.children
        ? [...item.children]
            .map((child, childIndex) => ({
              ...child,
              order: child.order ?? (childIndex + 1) * 10,
            }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : undefined;

      return {
        ...item,
        order: computedOrder,
        children,
      };
    });
  })
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/**
 * Get all module definitions (from code)
 * This is the source of truth for module definitions
 */
export function getModules(): ModuleDefinition[] {
  return sortedModules.map((module) => ({
    ...module,
    navigation: module.navigation
      ? module.navigation.map((item) => ({
          ...item,
          children: item.children ? [...item.children] : undefined,
        }))
      : undefined,
  }));
}

/**
 * Get navigation items, optionally filtered by enabled modules from database
 * @param useDatabase - If true, filter by enabled modules in database
 * @param userId - Optional user ID for user-specific module activations
 */
export async function getNavigationItems(
  useDatabase: boolean = false,
  userId?: string
): Promise<ModuleNavigationItem[]> {
  let modulesToUse = sortedModules;

  // If using database, filter by enabled modules
  if (useDatabase && typeof window === "undefined") {
    // Server-side: Check database
    try {
      const enabledModules = userId
        ? await ModuleManager.getForUser(userId)
        : await ModuleManager.getEnabled();

      const enabledSlugs = new Set(enabledModules.map((m) => m.slug));
      modulesToUse = sortedModules.filter((m) => enabledSlugs.has(m.slug));
    } catch (error) {
      console.warn("Failed to load modules from database, using all modules:", error);
      // Fallback to all modules on error
    }
  }

  const filteredNavigation: ModuleNavigationItem[] = modulesToUse
    .flatMap((module, moduleIndex) => {
      if (!module.navigation) {
        return [];
      }

      const baseOrder = module.priority ?? (moduleIndex + 1) * DEFAULT_PRIORITY;

      return module.navigation.map((item, itemIndex) => {
        const computedOrder = item.order ?? baseOrder + itemIndex;
        const children = item.children
          ? [...item.children]
              .map((child, childIndex) => ({
                ...child,
                order: child.order ?? (childIndex + 1) * 10,
              }))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : undefined;

        return {
          ...item,
          order: computedOrder,
          children,
        };
      });
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return filteredNavigation.map((item) => ({
    ...item,
    children: item.children ? item.children.map((child) => ({ ...child })) : undefined,
  }));
}

/**
 * Synchronous version for client-side (uses static definitions)
 * For server-side with database filtering, use the async version
 */
export function getNavigationItemsSync(): ModuleNavigationItem[] {
  return sortedNavigation.map((item) => ({
    ...item,
    children: item.children ? item.children.map((child) => ({ ...child })) : undefined,
  }));
}
