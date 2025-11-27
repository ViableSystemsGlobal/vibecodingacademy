import { getModules } from '../src/modules/registry';
import { MODULE_ACCESS } from '../src/lib/permissions';

const moduleKeys = new Set(Object.keys(MODULE_ACCESS));
const missing = new Set<string>();

for (const module of getModules()) {
  for (const nav of module.navigation || []) {
    if (!moduleKeys.has(nav.module)) {
      missing.add(nav.module);
    }
    for (const child of nav.children || []) {
      if (!moduleKeys.has(child.module)) {
        missing.add(child.module);
      }
    }
  }
}

if (missing.size > 0) {
  console.log('Modules without MODULE_ACCESS entries:', Array.from(missing).sort());
} else {
  console.log('All modules accounted for in MODULE_ACCESS.');
}

