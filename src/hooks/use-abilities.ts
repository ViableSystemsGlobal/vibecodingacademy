import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { ROLE_ABILITIES, MODULE_ACCESS, type Role } from '@/lib/permissions';

export interface Ability {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export interface UserAbilities {
  abilities: string[];
  hasAbility: (resource: string, action: string) => boolean;
  canAccess: (module: string) => boolean;
  loading: boolean;
}

// Using centralized module access mappings from permissions.ts

// Using centralized role abilities from permissions.ts

export function useAbilities(): UserAbilities {
  const { data: session } = useSession();
  const [abilities, setAbilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAbilities = async () => {
      // Wait until session is available to avoid flashing no-permission states
      if (!session) {
        setLoading(true);
        return;
      }
      if (!session.user?.id) {
        setLoading(true);
        return;
      }

      try {
        const response = await fetch('/api/user/abilities', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 useAbilities - Session role:', session.user.role);
          console.log('🔍 useAbilities - Fetched abilities from database:', data.abilities?.length || 0, 'abilities');
          console.log('🔍 useAbilities - All abilities:', data.abilities);
          console.log('🔍 useAbilities - Source:', data.source);
          console.log('🔍 useAbilities - Debug info:', data.debug);
          setAbilities(data.abilities || []);
        } else {
          console.error('Failed to fetch abilities:', response.status);
          // Fallback to hardcoded abilities if API fails
          const userRole = session.user.role as Role;
          const userAbilities = [...(ROLE_ABILITIES[userRole] || [])];
          console.log('🔍 useAbilities - Using fallback abilities for role:', userRole, 'count:', userAbilities.length);
          console.log('🔍 useAbilities - Fallback has ai_analyst.access:', userAbilities.includes('ai_analyst.access' as any));
          console.log('🔍 useAbilities - Fallback has agents.view:', userAbilities.includes('agents.view' as any));
          console.log('🔍 useAbilities - Fallback has commissions.view:', userAbilities.includes('commissions.view' as any));
          setAbilities(userAbilities);
        }
      } catch (error) {
        console.error('Error fetching abilities:', error);
        // Fallback to hardcoded abilities if API fails
        const userRole = session.user.role as Role;
        const userAbilities = [...(ROLE_ABILITIES[userRole] || [])];
        console.log('🔍 useAbilities - Using fallback abilities for role:', userRole, 'count:', userAbilities.length);
        console.log('🔍 useAbilities - Fallback has ai_analyst.access:', userAbilities.includes('ai_analyst.access' as any));
        console.log('🔍 useAbilities - Fallback has agents.view:', userAbilities.includes('agents.view' as any));
        console.log('🔍 useAbilities - Fallback has commissions.view:', userAbilities.includes('commissions.view' as any));
        setAbilities(userAbilities);
      } finally {
        setLoading(false);
      }
    };

    fetchAbilities();
  }, [session]);

  const hasAbility = (resource: string, action: string): boolean => {
    const ability = `${resource}.${action}`;
    return abilities.includes(ability);
  };

  const canAccess = (module: string): boolean => {
    const userRole = session?.user?.role as string | undefined;
    
    // SUPER_ADMIN and ADMIN always have access (check both enum and string values)
    // Also check for common variations
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || 
                         userRole === 'ADMIN' || 
                         userRole === 'Super Admin' ||
                         userRole?.toUpperCase() === 'SUPER_ADMIN' ||
                         userRole?.toUpperCase() === 'ADMIN';
    
    if (isSuperAdmin) {
      console.log(`✅ canAccess(${module}): SUPER_ADMIN/ADMIN access granted for role: ${userRole}`);
      return true;
    }
    
    // Log role for debugging
    if (module === 'dashboard' || module === 'distributor-leads') {
      console.log(`🔍 canAccess(${module}): Checking access for role: ${userRole}`);
    }

    // While abilities are loading, return false to prevent showing unauthorized modules
    // The sidebar will wait for abilities to load before calling this
    if (loading) {
      console.log(`⏳ canAccess(${module}): Still loading abilities, returning false`);
      return false;
    }
    
    const moduleAbilities = MODULE_ACCESS[module as keyof typeof MODULE_ACCESS] || [];
    if (moduleAbilities.length === 0) {
      // If no abilities required for this module, deny access by default
      console.log(`⚠️ canAccess(${module}): No abilities defined for module, denying access`);
      return false;
    }
    
    const hasAccess = moduleAbilities.some(ability => abilities.includes(ability));
    
    // Debug logging for all modules (especially CRM and leads)
    if (module === 'crm' || module === 'leads' || module === 'accounts') {
      console.log(`🔍 canAccess(${module}):`, {
        module,
        requiredAbilities: moduleAbilities,
        userAbilities: abilities,
        hasAccess,
        matchingAbilities: moduleAbilities.filter(a => abilities.includes(a)),
      });
    }
    
    if (!hasAccess) {
      console.log(`🚫 canAccess(${module}): DENIED`, {
        module,
        requiredAbilities: moduleAbilities,
        userAbilities: abilities.slice(0, 10), // Show first 10 abilities
        hasRequired: moduleAbilities.some(a => abilities.includes(a)),
      });
    } else {
      console.log(`✅ canAccess(${module}): ALLOWED`, {
        module,
        requiredAbilities: moduleAbilities,
        matchingAbility: moduleAbilities.find(a => abilities.includes(a)),
      });
    }
    
    return hasAccess;
  };

  return {
    abilities,
    hasAbility,
    canAccess,
    loading,
  };
}
