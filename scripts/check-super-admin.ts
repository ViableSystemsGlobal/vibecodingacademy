import { ABILITIES, ROLE_ABILITIES } from '../src/lib/permissions';

const allAbilities = Object.keys(ABILITIES);
const superAdminAbilities = new Set(ROLE_ABILITIES.SUPER_ADMIN);

const missingFromSuperAdmin = allAbilities.filter(
  (ability) => !superAdminAbilities.has(ability),
);

console.log(`Total abilities defined: ${allAbilities.length}`);
console.log(`Super Admin abilities: ${superAdminAbilities.size}`);
console.log(
  `Missing abilities (not granted to Super Admin): ${missingFromSuperAdmin.length}`,
);

if (missingFromSuperAdmin.length > 0) {
  missingFromSuperAdmin.forEach((ability) => console.log(` - ${ability}`));
} else {
  console.log('✅ Super Admin has every defined ability.');
}

