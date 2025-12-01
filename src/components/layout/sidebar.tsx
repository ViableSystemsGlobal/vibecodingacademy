"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useAbilities } from "@/hooks/use-abilities";
import { useSession } from "next-auth/react";
import { SkeletonSidebar } from "@/components/ui/skeleton";
import {
  Building,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Package,
  LayoutDashboard,
  X,
} from "lucide-react";
import { getCachedMenu, clearAllMenuCache } from "@/lib/menu-cache";
import type { ModuleNavigationItem } from "@/modules/types";

const shortcuts = [
  { name: "Pending Tasks", href: "/tasks?status=PENDING", icon: CheckSquare, badge: "0" },
  { name: "Overdue Invoices", href: "/invoices?status=OVERDUE&paymentStatus=UNPAID", icon: FileText, badge: "0" },
  { name: "Low/No Stock", href: "/inventory/stock?stockStatus=low-stock", icon: Package, badge: "0" },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { getThemeClasses, customLogo, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { canAccess, abilities, loading: abilitiesLoading } = useAbilities();
  const { data: session, status: sessionStatus } = useSession();
  const [shortcutCounts, setShortcutCounts] = useState({
    pendingTasks: 0,
    overdueInvoices: 0,
    lowStock: 0
  });
  const [navigation, setNavigation] = useState<ModuleNavigationItem[]>([]);

  // Function to refresh navigation menu
  const refreshNavigation = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    // Wait for abilities to load before filtering
    if (abilitiesLoading || sessionStatus === 'loading') {
      console.log('⏳ Waiting for abilities/session to load...', { abilitiesLoading, sessionStatus });
      return;
    }

    const userId = (session?.user as any)?.id;
    if (!userId) {
      console.log('⚠️ No user ID, clearing navigation');
      setNavigation([]);
      return;
    }

    const userRole = session?.user?.role as string | undefined;
    
    // Always clear cache to ensure fresh menu (especially after permission changes)
    // This ensures users see the latest navigation based on their current abilities
    clearAllMenuCache();
    console.log('🧹 Cleared menu cache to ensure fresh navigation');
    
    // Create a wrapper for canAccess that ensures it doesn't return true while loading
    const canAccessWrapper = (module: string): boolean => {
      if (abilitiesLoading) {
        return false; // Don't show anything while loading
      }
      return canAccess(module);
    };
    
    try {
      console.log('🔄 Refreshing navigation menu with abilities:', abilities.length, 'abilities', 'role:', userRole);
      const cachedMenu = await getCachedMenu(userId, abilities, canAccessWrapper, userRole);
      setNavigation(Array.isArray(cachedMenu) ? cachedMenu : []);
      console.log('✅ Navigation menu refreshed, items:', cachedMenu.length);
    } catch (error) {
      console.error("Error getting cached menu:", error);
      setNavigation([]);
      setIsInitialLoad(false);
    }
    // Note: canAccess is intentionally not in deps - it's a function that changes on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abilities, abilitiesLoading, sessionStatus, session?.user]);

  // Get cached menu when abilities or user changes
  useEffect(() => {
    refreshNavigation();
  }, [refreshNavigation]);

  // Listen for module toggle events to refresh sidebar
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleModuleToggled = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("Module toggled - refreshing sidebar", customEvent.detail);
      // Clear cache first, then refresh
      clearAllMenuCache();
      // Small delay to ensure cache is cleared
      setTimeout(() => {
        refreshNavigation();
      }, 200);
    };

    window.addEventListener("module-toggled", handleModuleToggled);
    return () => {
      window.removeEventListener("module-toggled", handleModuleToggled);
    };
  }, [refreshNavigation]);

  // Show skeleton loading during initial load, while abilities are loading, or session is loading
  useEffect(() => {
    if (sessionStatus !== 'loading' && !abilitiesLoading) {
      // Add a small delay to ensure skeleton shows during hard refresh
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (sessionStatus === 'loading' || abilitiesLoading) {
      // Reset to loading state if session or abilities start loading again
      setIsInitialLoad(true);
    }
  }, [sessionStatus, abilitiesLoading]);

  // Safety timeout: ensure sidebar always resolves from loading state after 10 seconds
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (isInitialLoad) {
        console.warn('Sidebar loading timeout - forcing render');
        setIsInitialLoad(false);
      }
    }, 10000);
    return () => clearTimeout(safetyTimer);
  }, [isInitialLoad]);

  // Define isActive function before using it in useEffect
  const isActive = (href: string) => {
    if (pathname === href) return true;
    
    // Special case for /tasks routes
    if (href === "/tasks") {
      // Only match if we're exactly on /tasks, not on /tasks/my or other sub-routes
      return pathname === "/tasks";
    }
    
    // Special case for /products - only match exact /products, not /products/labels
    if (href === "/products") {
      return pathname === "/products";
    }
    
    // For other child routes, only match if it's a direct child (not a grandchild)
    if (pathname.startsWith(href + "/")) {
      const remainingPath = pathname.slice(href.length + 1);
      // Only match if there's no additional path segments (direct child)
      return !remainingPath.includes("/");
    }
    
    return false;
  };

  // Fetch shortcut counts
  useEffect(() => {
    const fetchShortcutCounts = async () => {
      try {
        const response = await fetch('/api/shortcuts/counts');
        if (response.ok) {
          const data = await response.json();
          setShortcutCounts(data);
        }
      } catch (error) {
        console.error('Error fetching shortcut counts:', error);
      }
    };

    if (sessionStatus !== 'loading') {
      fetchShortcutCounts();
    }
  }, [sessionStatus]);

  // Auto-expand sections when on child pages
  useEffect(() => {
    if (navigation.length === 0) return;

    const shouldExpandSections: string[] = [];
    
    navigation.forEach(section => {
      if (section.children) {
        const hasActiveChild = section.children.some(child => isActive(child.href));
        if (hasActiveChild) {
          shouldExpandSections.push(section.name);
        }
      }
    });
    
    if (shouldExpandSections.length > 0) {
      setExpandedSections(prev => {
        const newExpanded = [...new Set([...prev, ...shouldExpandSections])];
        return newExpanded;
      });
    }
  }, [pathname, navigation]);

  const dashboardAccessible = !abilitiesLoading && canAccess("dashboard");

  const navigationWithDashboard = useMemo(() => {
    if (!Array.isArray(navigation)) {
      return [];
    }
    if (!dashboardAccessible) {
      return navigation;
    }
    const hasDashboard = navigation.some((item) => item.module === "dashboard");
    if (hasDashboard) {
      return navigation;
    }
    return [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        module: "dashboard",
      },
      ...navigation,
    ];
  }, [navigation, dashboardAccessible]);

  if (isInitialLoad || abilitiesLoading || sessionStatus === 'loading') {
    return <SkeletonSidebar />;
  }

  // Get theme color (hex value) from branding context
  const themeColorHex = getThemeColor();

  // Check if color is a custom hex color or preset Tailwind class
  const isCustomColor = theme.primary?.startsWith('#');

  // Helper function to get proper background classes or styles
  const getBackgroundClasses = (isActive: boolean, isHover: boolean = false) => {
    if (isCustomColor) {
      // For custom colors, return empty string and use inline styles
      return '';
    }
    const prefix = isHover ? 'hover:' : '';
    const colorMap: { [key: string]: string } = {
      'purple-600': `${prefix}bg-purple-600`,
      'blue-600': `${prefix}bg-blue-600`,
      'green-600': `${prefix}bg-green-600`,
      'orange-600': `${prefix}bg-orange-600`,
      'red-600': `${prefix}bg-red-600`,
      'indigo-600': `${prefix}bg-indigo-600`,
      'pink-600': `${prefix}bg-pink-600`,
      'teal-600': `${prefix}bg-teal-600`,
    };
    return colorMap[theme.primary] || `${prefix}bg-blue-600`;
  };

  // Helper function to get background style for custom colors
  const getBackgroundStyle = (isActive: boolean, isHover: boolean = false) => {
    if (!isCustomColor || !isActive) return {};
    return {
      backgroundColor: themeColorHex,
    };
  };

  // Helper function to get hover background classes with safelist
  const getHoverBackgroundClasses = () => {
    if (isCustomColor) {
      return '';
    }
    const colorMap: { [key: string]: string } = {
      'purple-600': 'hover:bg-purple-600',
      'blue-600': 'hover:bg-blue-600', 
      'green-600': 'hover:bg-green-600',
      'orange-600': 'hover:bg-orange-600',
      'red-600': 'hover:bg-red-600',
      'indigo-600': 'hover:bg-indigo-600',
      'pink-600': 'hover:bg-pink-600',
      'teal-600': 'hover:bg-teal-600',
    };
    return colorMap[theme.primary] || 'hover:bg-blue-600';
  };

  // Helper function to get hover background style for custom colors
  const getHoverBackgroundStyle = () => {
    if (!isCustomColor) return {};
    return {
      '--hover-bg': themeColorHex,
    } as React.CSSProperties;
  };

  // Helper function to get proper text color classes or styles
  const getTextColorClasses = (isHover: boolean = false) => {
    if (isCustomColor) {
      return '';
    }
    const prefix = isHover ? 'hover:' : '';
    const colorMap: { [key: string]: string } = {
      'purple-600': `${prefix}text-purple-600`,
      'blue-600': `${prefix}text-blue-600`,
      'green-600': `${prefix}text-green-600`,
      'orange-600': `${prefix}text-orange-600`,
      'red-600': `${prefix}text-red-600`,
      'indigo-600': `${prefix}text-indigo-600`,
      'pink-600': `${prefix}text-pink-600`,
      'teal-600': `${prefix}text-teal-600`,
    };
    return colorMap[theme.primary] || `${prefix}text-blue-600`;
  };

  // Helper function to get text color style for custom colors
  const getTextColorStyle = (isHover: boolean = false) => {
    if (!isCustomColor) return {};
    return {
      color: themeColorHex,
    };
  };

  // Helper function to get proper focus ring classes
  const getFocusRingClasses = () => {
    const colorMap: { [key: string]: string } = {
      'purple-600': 'focus:ring-purple-500',
      'blue-600': 'focus:ring-blue-500',
      'green-600': 'focus:ring-green-500',
      'orange-600': 'focus:ring-orange-500',
      'red-600': 'focus:ring-red-500',
      'indigo-600': 'focus:ring-indigo-500',
      'pink-600': 'focus:ring-pink-500',
      'teal-600': 'focus:ring-teal-500',
    };
    return colorMap[theme.primary] || 'focus:ring-blue-500';
  };

  // Helper function to get proper gradient background classes
  const getGradientBackgroundClasses = () => {
    const colorMap: { [key: string]: string } = {
      'purple-600': 'bg-gradient-to-br from-purple-600 to-purple-700',
      'blue-600': 'bg-gradient-to-br from-blue-600 to-blue-700',
      'green-600': 'bg-gradient-to-br from-green-600 to-green-700',
      'orange-600': 'bg-gradient-to-br from-orange-600 to-orange-700',
      'red-600': 'bg-gradient-to-br from-red-600 to-red-700',
      'indigo-600': 'bg-gradient-to-br from-indigo-600 to-indigo-700',
      'pink-600': 'bg-gradient-to-br from-pink-600 to-pink-700',
      'teal-600': 'bg-gradient-to-br from-teal-600 to-teal-700',
    };
    return colorMap[theme.primary] || 'bg-gradient-to-br from-blue-600 to-blue-700';
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionName) 
        ? prev.filter(name => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  return (
    <div className={cn(
      "flex h-full flex-col bg-white border-r border-gray-200 transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex h-20 items-center justify-between border-b border-gray-200 px-2 lg:justify-center">
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        )}
        {customLogo ? (
          <img 
            src={customLogo} 
            alt="Logo" 
            className="h-16 w-auto max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className={`h-16 w-16 rounded-lg ${getGradientBackgroundClasses()} flex items-center justify-center shadow-lg`}>
            <Building className="h-9 w-9 text-white" />
          </div>
        )}
        {/* Spacer for mobile close button alignment */}
        {onClose && <div className="lg:hidden w-9" />}
      </div>


      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
        {navigationWithDashboard && navigationWithDashboard.length > 0 ? navigationWithDashboard.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedSections.includes(item.name);
            const isActiveItem = (item.href && isActive(item.href)) || (hasChildren && item.children!.some(child => isActive(child.href)));

          return (
            <div key={item.name}>
              {hasChildren ? (
                <button
                  onClick={() => toggleSection(item.name)}
                  className={cn(
                    "group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActiveItem && !isCustomColor
                      ? `${getBackgroundClasses(true)} text-white`
                      : !isActiveItem && !isCustomColor
                      ? `text-gray-700 ${getHoverBackgroundClasses()} hover:text-white`
                      : isCustomColor && !isActiveItem
                      ? 'text-gray-700'
                      : ''
                  )}
                  style={isActiveItem ? getBackgroundStyle(true) : isCustomColor && !isActiveItem ? { color: '#374151' } : {}}
                  onMouseEnter={(e) => {
                    if (isCustomColor && !isActiveItem) {
                      e.currentTarget.style.backgroundColor = themeColorHex;
                      e.currentTarget.style.color = 'white';
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) icon.style.color = 'white';
                      const textSpan = e.currentTarget.querySelector('span:not(.ml-auto)');
                      if (textSpan) (textSpan as HTMLElement).style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isCustomColor && !isActiveItem) {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.color = '#374151';
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) icon.style.color = '#374151';
                      const textSpan = e.currentTarget.querySelector('span:not(.ml-auto)');
                      if (textSpan) (textSpan as HTMLElement).style.color = '#374151';
                    }
                  }}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    !isCustomColor && !isActiveItem ? "group-hover:text-white" : ""
                  )} style={isActiveItem && isCustomColor ? { color: 'white' } : isCustomColor && !isActiveItem ? { color: '#374151' } : {}} />
                  {!collapsed && (
                    <>
                      <span 
                        className={cn(
                          !isCustomColor && !isActiveItem ? "group-hover:!text-white" : ""
                        )} 
                        style={
                          isActiveItem && isCustomColor 
                            ? { color: 'white' } 
                            : isCustomColor && !isActiveItem 
                            ? { color: '#374151' } 
                            : {} // No inline style for preset colors - let classes handle it
                        }
                      >
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "ml-auto text-gray-400 transition-colors group-hover:text-white",
                          isActiveItem ? "text-white" : ""
                        )}
                        style={
                          isActiveItem && isCustomColor
                            ? { color: 'white' }
                            : isCustomColor && !isActiveItem
                            ? { color: '#6B7280' }
                            : {}
                        }
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href={item.href || '#'}
                  onClick={() => {
                    // Close mobile menu when link is clicked
                    if (onClose) {
                      onClose();
                    }
                  }}
                  className={cn(
                    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left",
                    isActiveItem && !isCustomColor
                      ? `${getBackgroundClasses(true)} text-white`
                      : !isActiveItem && !isCustomColor
                      ? `text-gray-700 ${getHoverBackgroundClasses()} hover:text-white`
                      : isCustomColor && !isActiveItem
                      ? 'text-gray-700'
                      : ''
                  )}
                  style={isActiveItem ? getBackgroundStyle(true) : isCustomColor && !isActiveItem ? { color: '#374151' } : {}}
                  onMouseEnter={(e) => {
                    if (isCustomColor && !isActiveItem) {
                      e.currentTarget.style.backgroundColor = themeColorHex;
                      e.currentTarget.style.color = 'white';
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) icon.style.color = 'white';
                      const textSpan = e.currentTarget.querySelector('span');
                      if (textSpan) (textSpan as HTMLElement).style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isCustomColor && !isActiveItem) {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.color = '#374151';
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) icon.style.color = '#374151';
                      const textSpan = e.currentTarget.querySelector('span');
                      if (textSpan) (textSpan as HTMLElement).style.color = '#374151';
                    }
                  }}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    !isCustomColor && !isActiveItem ? "group-hover:text-white" : ""
                  )} style={isActiveItem && isCustomColor ? { color: 'white' } : isCustomColor && !isActiveItem ? { color: '#374151' } : {}} />
                  {!collapsed && (
                    <span 
                      className={cn(
                        !isCustomColor && !isActiveItem ? "group-hover:!text-white" : ""
                      )} 
                      style={
                        isActiveItem && isCustomColor 
                          ? { color: 'white' } 
                          : isCustomColor && !isActiveItem 
                          ? { color: '#374151' } 
                          : {} // No inline style for preset colors - let classes handle it
                      }
                    >
                      {item.name}
                    </span>
                  )}
                </Link>
              )}

              {/* Children */}
              {hasChildren && isExpanded && !collapsed && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children!.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      onClick={() => {
                        // Close mobile menu when link is clicked
                        if (onClose) {
                          onClose();
                        }
                      }}
                      className={cn(
                        "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left",
                        isActive(child.href) && !isCustomColor
                          ? getTextColorClasses()
                          : !isActive(child.href) && !isCustomColor
                          ? `text-gray-600 ${getTextColorClasses(true)}`
                          : isCustomColor && !isActive(child.href)
                          ? 'text-gray-600'
                          : ''
                      )}
                      style={isActive(child.href) ? getTextColorStyle() : isCustomColor && !isActive(child.href) ? { color: '#4B5563' } : {}}
                      onMouseEnter={(e) => {
                        if (isCustomColor && !isActive(child.href)) {
                          e.currentTarget.style.color = themeColorHex;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isCustomColor && !isActive(child.href)) {
                          e.currentTarget.style.color = '#4B5563';
                        }
                      }}
                    >
                      <child.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }) : (
          <div className="p-4 text-sm text-gray-500 text-center">
            No navigation items available
          </div>
        )}
      </nav>

      {/* Shortcuts */}
      {!collapsed && (
        <div className="px-4 py-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Shortcuts
          </div>
          <div className="space-y-1">
            {shortcuts.map((shortcut, index) => {
              const Icon = shortcut.icon;
              const themeColor = getThemeColor();
              // Map badge count based on shortcut name
              let badgeCount = 0;
              if (shortcut.name === 'Pending Tasks') badgeCount = shortcutCounts.pendingTasks;
              else if (shortcut.name === 'Overdue Invoices') badgeCount = shortcutCounts.overdueInvoices;
              else if (shortcut.name === 'Low/No Stock') badgeCount = shortcutCounts.lowStock;
              
              return (
                <Link
                  key={shortcut.name}
                  href={shortcut.href}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${themeColor}15`; // 15 = ~8% opacity
                    e.currentTarget.style.color = themeColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#374151'; // text-gray-700
                  }}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    {shortcut.name}
                  </div>
                  <span 
                    className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {badgeCount}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        {!collapsed ? (
          <>
            {/* User Menu */}
            <div className="flex items-center space-x-3 mb-3">
              <div 
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(to bottom right, ${getThemeColor()}, ${getThemeColor()}dd)`
                }}
              >
                <span className="text-white text-sm font-medium">
                  {session?.user?.name ? session.user.name.substring(0, 2).toUpperCase() : 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.email || 'user@example.com'}
                </p>
              </div>
            </div>

            {/* Help */}
            <button 
              className="flex items-center w-full text-sm text-gray-500 transition-colors"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = getThemeColor();
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
              }}
              onClick={() => {
                // Could open a help modal or navigate to help page
                alert('Help & Keyboard shortcuts coming soon!');
              }}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Keyboard shortcuts
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div 
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(to bottom right, ${getThemeColor()}, ${getThemeColor()}dd)`
              }}
            >
              <span className="text-white text-sm font-medium">
                {session?.user?.name ? session.user.name.substring(0, 2).toUpperCase() : 'U'}
              </span>
            </div>
            <button 
              className="text-gray-500 transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = getThemeColor();
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
              }}
              onClick={() => {
                alert('Help & Keyboard shortcuts coming soon!');
              }}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="border-t border-gray-200 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>
    </div>
  );
}