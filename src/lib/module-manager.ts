import { prisma } from "@/lib/prisma";
import type { ModuleDefinition } from "@/modules/types";
import { getModules } from "@/modules/registry";

/**
 * ModuleManager - Centralized module management system
 * Inspired by ThriveERP's Module class
 */
export class ModuleManager {
  /**
   * Get all modules from database
   */
  static async getAll(): Promise<Module[]> {
    try {
      const modules = await prisma.module.findMany({
        orderBy: { priority: "asc" },
        include: {
          childModules: true,
          parentModule: true,
        },
      });
      return modules as unknown as Module[];
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn("Modules table not found, returning empty array");
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all enabled modules
   */
  static async getEnabled(): Promise<Module[]> {
    const modules = await prisma.module.findMany({
      where: { isEnabled: true },
      orderBy: { priority: "asc" },
      include: {
        childModules: {
          where: { isEnabled: true },
        },
        parentModule: true,
      },
    });
    return modules as unknown as Module[];
  }

  /**
   * Find a module by slug
   */
  static async findBySlug(slug: string): Promise<Module | null> {
    const module = await prisma.module.findUnique({
      where: { slug },
      include: {
        childModules: true,
        parentModule: true,
      },
    });
    return module as unknown as Module | null;
  }

  /**
   * Check if a module is enabled
   */
  static async isEnabled(slug: string): Promise<boolean> {
    const module = await prisma.module.findUnique({
      where: { slug },
      select: { isEnabled: true },
    });
    return module?.isEnabled ?? false;
  }

  /**
   * Enable a module
   * Auto-registers the module if it doesn't exist in the database
   */
  static async enable(slug: string, userId?: string): Promise<Module> {
    let module = await prisma.module.findUnique({ where: { slug } });
    
    // If module doesn't exist in database, try to register it from code
    if (!module) {
      const codeModules = getModules();
      const moduleDefinition = codeModules.find((m) => m.slug === slug);
      
      if (!moduleDefinition) {
        throw new Error(`Module ${slug} not found in code or database`);
      }
      
      // Register the module first
      const registeredModule = await this.register(moduleDefinition);
      module = registeredModule as any;
    }
    
    if (!module) {
      throw new Error(`Module ${slug} not found`);
    }
    
    if (module.isSystem) {
      throw new Error(`System module ${slug} cannot be disabled`);
    }

    const updated = await prisma.module.update({
      where: { slug },
      data: { isEnabled: true },
    });
    return updated as unknown as Module;
  }

  /**
   * Disable a module
   * Auto-registers the module if it doesn't exist in the database
   */
  static async disable(slug: string, userId?: string): Promise<Module> {
    let module = await prisma.module.findUnique({ where: { slug } });
    
    // If module doesn't exist in database, try to register it from code
    if (!module) {
      const codeModules = getModules();
      const moduleDefinition = codeModules.find((m) => m.slug === slug);
      
      if (!moduleDefinition) {
        throw new Error(`Module ${slug} not found in code or database`);
      }
      
      // Register the module first (will be created as enabled, then we'll disable it)
      const registeredModule = await this.register(moduleDefinition);
      module = registeredModule as any;
    }
    
    if (!module) {
      throw new Error(`Module ${slug} not found`);
    }
    
    if (module.isSystem) {
      throw new Error(`System module ${slug} cannot be disabled`);
    }

    const updated = await prisma.module.update({
      where: { slug },
      data: { isEnabled: false },
    });
    return updated as unknown as Module;
  }

  /**
   * Register a module from code definition
   * This syncs module definitions from code to database
   */
  static async register(definition: ModuleDefinition): Promise<Module> {
    // Convert featureFlags array to JSON string (or null if empty)
    const featureFlagsArray = definition.featureFlags || [];
    const featureFlagsString = featureFlagsArray.length > 0 
      ? JSON.stringify(featureFlagsArray) 
      : null;

    const module = await prisma.module.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.displayName,
        description: definition.description,
        version: definition.version || "1.0.0",
        priority: definition.priority ?? 1000,
        category: definition.category,
        featureFlags: featureFlagsString,
      },
      create: {
        slug: definition.slug,
        name: definition.displayName,
        description: definition.description,
        version: definition.version || "1.0.0",
        priority: definition.priority ?? 1000,
        category: definition.category,
        featureFlags: featureFlagsString,
        isEnabled: true,
        isSystem: definition.slug === "core", // Core is always system
      },
    });
    return module as unknown as Module;
  }

  /**
   * Register multiple modules at once
   */
  static async registerAll(definitions: ModuleDefinition[]): Promise<Module[]> {
    return Promise.all(definitions.map((def) => this.register(def)));
  }

  /**
   * Get modules for a specific user (with user-specific activations)
   */
  static async getForUser(userId: string): Promise<Module[]> {
    const activations = await prisma.userModuleActivation.findMany({
      where: { userId, isActive: true },
      include: { module: true },
    });

    // Get all enabled modules
    const enabledModules = await this.getEnabled();

    // Filter by user activations if any exist
    if (activations.length > 0) {
      const activatedModuleIds = new Set(activations.map((a) => a.moduleId));
      return enabledModules.filter((m) => activatedModuleIds.has(m.id));
    }

    // If no specific activations, return all enabled modules
    return enabledModules;
  }

  /**
   * Activate a module for a specific user
   */
  static async activateForUser(
    userId: string,
    moduleSlug: string,
    activatedBy?: string
  ): Promise<void> {
    const module = await this.findBySlug(moduleSlug);
    if (!module) {
      throw new Error(`Module ${moduleSlug} not found`);
    }

    await prisma.userModuleActivation.upsert({
      where: {
        userId_moduleId: {
          userId,
          moduleId: module.id,
        },
      },
      update: {
        isActive: true,
        activatedBy,
      },
      create: {
        userId,
        moduleId: module.id,
        isActive: true,
        activatedBy,
      },
    });
  }

  /**
   * Deactivate a module for a specific user
   */
  static async deactivateForUser(
    userId: string,
    moduleSlug: string
  ): Promise<void> {
    const module = await this.findBySlug(moduleSlug);
    if (!module) {
      throw new Error(`Module ${moduleSlug} not found`);
    }

    await prisma.userModuleActivation.updateMany({
      where: {
        userId,
        moduleId: module.id,
      },
      data: {
        isActive: false,
      },
    });
  }
}

// Type for database Module
export type Module = {
  id: string;
  slug: string;
  name: string;
  alias: string | null;
  description: string | null;
  version: string;
  priority: number;
  category: string | null;
  isEnabled: boolean;
  isSystem: boolean;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  packageName: string | null;
  image: string | null;
  featureFlags: string | null; // JSON array stored as string
  parentModuleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  childModules?: Module[];
  parentModule?: Module | null;
};

