import { ROLE_ABILITIES } from '../src/lib/permissions';

const unique = new Set<string>();

for (const abilities of Object.values(ROLE_ABILITIES)) {
  for (const ability of abilities) {
    unique.add(ability);
  }
}

console.log('Total unique ability references across roles:', unique.size);

