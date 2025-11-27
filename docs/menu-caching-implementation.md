# Menu Caching Implementation

## Overview
Implemented a user-specific menu caching system to improve sidebar performance by avoiding repeated permission checks and menu filtering on every render.

## Implementation Details

### Files Created/Modified

1. **`src/lib/menu-cache.ts`** (NEW)
   - Core menu caching utility
   - Functions:
     - `getCachedMenu()` - Get cached or generate new menu
     - `invalidateMenuCache()` - Invalidate cache for a user
     - `clearAllMenuCache()` - Clear all cached menus
   - Features:
     - 5-minute cache expiry
     - Cache key based on userId + abilities hash + userRole
     - Automatic cleanup of old cache entries (keeps last 5)
     - Handles special cases (tasks, audit-trail modules)

2. **`src/components/layout/sidebar.tsx`** (MODIFIED)
   - Replaced static `navigation` with state-based cached menu
   - Uses `getCachedMenu()` to fetch filtered menu items
   - Removed redundant `.filter()` call (filtering now happens in cache)

### How It Works

1. **Cache Key Generation**:
   - Format: `menu_cache_{userId}_{abilitiesHash}_{userRole}`
   - Abilities hash is a sorted, comma-separated string of all abilities
   - Includes userRole for special module handling

2. **Menu Filtering**:
   - Filters navigation items based on `canAccess()` function
   - Filters children based on permissions
   - Handles special cases:
     - `my-tasks`: All roles can access
     - `tasks`: Only SUPER_ADMIN and ADMIN
     - `audit-trail`: Only SUPER_ADMIN and ADMIN

3. **Cache Lifecycle**:
   - Cache expires after 5 minutes
   - Automatically invalidates when abilities change (different hash)
   - Automatically invalidates when user role changes (for special modules)
   - Manual invalidation available via `invalidateMenuCache()`

4. **Performance Benefits**:
   - Menu filtering happens once per user/abilities combination
   - Subsequent renders use cached menu (no permission checks)
   - Reduces computation on every sidebar render
   - Faster initial load for returning users

### Usage

```typescript
import { getCachedMenu, invalidateMenuCache } from "@/lib/menu-cache";

// Get cached menu
const menu = getCachedMenu(userId, abilities, canAccess, userRole);

// Invalidate cache (e.g., when permissions change)
invalidateMenuCache(userId);

// Clear all cache (e.g., on logout)
clearAllMenuCache();
```

### Cache Invalidation

The cache automatically invalidates when:
- Abilities change (different abilities hash)
- User role changes (for role-based modules)
- Cache expires (5 minutes)
- Manual invalidation via `invalidateMenuCache()`

### Future Enhancements

1. **Server-Side Caching**: Move cache to server-side (Redis/database) for multi-device sync
2. **Cache Warming**: Pre-generate menus for common role/ability combinations
3. **Cache Statistics**: Track cache hit/miss rates
4. **Selective Invalidation**: Invalidate only affected menu items instead of entire cache

## Testing

To test the implementation:

1. **First Load**: Menu should be generated and cached
2. **Subsequent Loads**: Menu should load from cache (check localStorage)
3. **Permission Change**: Menu should regenerate when abilities change
4. **Role Change**: Menu should regenerate when role changes
5. **Cache Expiry**: Menu should regenerate after 5 minutes

## Performance Metrics

Expected improvements:
- **First render**: Same (needs to generate menu)
- **Subsequent renders**: ~50-80% faster (no filtering needed)
- **Memory**: ~5-10KB per cached menu (localStorage)
- **Cache hit rate**: Should be >90% for active users

