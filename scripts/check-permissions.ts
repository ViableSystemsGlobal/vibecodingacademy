import { ABILITIES, ROLE_ABILITIES } from '../src/lib/permissions';

const abilityKeys = new Set(Object.keys(ABILITIES));

for (const [role, abilities] of Object.entries(ROLE_ABILITIES)) {
  const missing: string[] = [];
  for (const ability of abilities) {
    if (!abilityKeys.has(ability)) {
      missing.push(ability);
    }
  }
  if (missing.length > 0) {
    console.log(`Role ${role} references ${missing.length} undefined ability(ies):`);
    for (const ability of missing) {
      console.log(`  - ${ability}`);
    }
  }
}

const abilityUsage = new Map<string, string[]>();

for (const [role, abilities] of Object.entries(ROLE_ABILITIES)) {
  for (const ability of abilities) {
    if (!abilityUsage.has(ability)) {
      abilityUsage.set(ability, []);
    }
    abilityUsage.get(ability)!.push(role);
  }
}

const unusedAbilities = Object.keys(ABILITIES).filter(
  (ability) => !abilityUsage.has(ability),
);

if (unusedAbilities.length > 0) {
  console.log(`\nAbilities defined but not assigned to any role (${unusedAbilities.length}):`);
  for (const ability of unusedAbilities) {
    console.log(`  - ${ability}`);
  }
}

