import type { ModuleDefinition } from "./types";

export function defineModule<T extends ModuleDefinition>(definition: T): T {
  return definition;
}
