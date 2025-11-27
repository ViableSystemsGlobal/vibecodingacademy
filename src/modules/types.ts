import type { LucideIcon } from "lucide-react";

export interface ModuleNavigationChild {
  name: string;
  href: string;
  icon: LucideIcon;
  module: string;
  order?: number;
}

export interface ModuleNavigationItem {
  name: string;
  href: string | null;
  icon: LucideIcon;
  module: string;
  badge?: string | null;
  order?: number;
  children?: ModuleNavigationChild[];
}

export interface ModuleDefinition {
  /**
   * Unique slug for the module (used in URLs, flags, etc.)
   */
  slug: string;
  /**
   * Human-friendly name shown in management UIs.
   */
  displayName: string;
  /**
   * Optional short description of the module.
   */
  description?: string;
  /**
   * Semantic version for the module (mirrors Thrive ERP structure).
   */
  version?: string;
  /**
   * Category used for grouping modules in management screens.
   */
  category?: string;
  /**
   * Priority used when ordering modules; lower values appear first.
   */
  priority?: number;
  /**
   * Set of feature flags that gate this module.
   */
  featureFlags?: string[];
  /**
   * Routes and hierarchical navigation contributed by the module.
   */
  navigation?: ModuleNavigationItem[];
}
