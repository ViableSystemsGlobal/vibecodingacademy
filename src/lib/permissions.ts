/**
 * Centralized Permissions Configuration
 * 
 * This file contains the single source of truth for all permissions in the system.
 * Any changes to permissions should be made here and will automatically apply
 * to both client-side and server-side permission checks.
 */

// Define all possible abilities in the system
export const ABILITIES = {
  // Dashboard
  'dashboard.view': 'View dashboard',
  
  // Products
  'products.view': 'View products',
  'products.create': 'Create products',
  'products.edit': 'Edit products',
  'products.delete': 'Delete products',
  'products.view_cost': 'View product cost prices and profit margins',
  
  // Inventory
  'inventory.view': 'View inventory',
  'stock.view': 'View stock',
  'stock.create': 'Create stock',
  'stock.edit': 'Edit stock',
  'stock.delete': 'Delete stock',
  
  // Warehouses
  'warehouses.view': 'View warehouses',
  'warehouses.create': 'Create warehouses',
  'warehouses.edit': 'Edit warehouses',
  'warehouses.delete': 'Delete warehouses',
  
  // Price Lists
  'price-lists.view': 'View price lists',
  'price-lists.create': 'Create price lists',
  'price-lists.edit': 'Edit price lists',
  'price-lists.delete': 'Delete price lists',
  
  // CRM
  'leads.view': 'View leads',
  'leads.create': 'Create leads',
  'leads.edit': 'Edit leads',
  'leads.delete': 'Delete leads',
  'leads.manage': 'Manage leads (bulk operations)',
  
  'accounts.view': 'View accounts',
  'accounts.create': 'Create accounts',
  'accounts.edit': 'Edit accounts',
  'accounts.delete': 'Delete accounts',
  
  'opportunities.view': 'View opportunities',
  'opportunities.create': 'Create opportunities',
  'opportunities.edit': 'Edit opportunities',
  'opportunities.delete': 'Delete opportunities',
  
  'quotations.view': 'View quotations',
  'quotations.create': 'Create quotations',
  'quotations.edit': 'Edit quotations',
  'quotations.delete': 'Delete quotations',
  
  'contacts.view': 'View contacts',
  'contacts.create': 'Create contacts',
  'contacts.edit': 'Edit contacts',
  'contacts.delete': 'Delete contacts',
  
  // Backorders
  'backorders.view': 'View backorders',
  'backorders.create': 'Create backorders',
  'backorders.edit': 'Edit backorders',
  'backorders.delete': 'Delete backorders',
  
  // DRM
  'drm.view': 'View DRM',
  'distributor-leads.view': 'View distributor leads',
  'distributor-leads.create': 'Create distributor leads',
  'distributor-leads.edit': 'Edit distributor leads',
  'distributor-leads.delete': 'Delete distributor leads',
  
  'distributors.view': 'View distributors',
  'distributors.create': 'Create distributors',
  'distributors.edit': 'Edit distributors',
  'distributors.delete': 'Delete distributors',
  
  'routes-mapping.view': 'View routes mapping',
  'routes-mapping.create': 'Create routes mapping',
  'routes-mapping.edit': 'Edit routes mapping',
  'routes-mapping.delete': 'Delete routes mapping',
  
  'engagement.view': 'View engagement',
  'engagement.create': 'Create engagement',
  'engagement.edit': 'Edit engagement',
  'engagement.delete': 'Delete engagement',
  
  'drm-orders.view': 'View DRM orders',
  
  // Sales
  'sales.view': 'View sales',
  'orders.view': 'View orders',
  'proformas.view': 'View proformas',
  'invoices.view': 'View invoices',
  'invoices.create': 'Create invoices',
  'invoices.edit': 'Edit invoices',
  'invoices.delete': 'Delete invoices',
  'payments.view': 'View payments',
  'payments.create': 'Create payments',
  'payments.edit': 'Edit payments',
  'returns.view': 'View returns',
  'credit-notes.view': 'View credit notes',
  'credit-notes.create': 'Create credit notes',
  'credit-notes.edit': 'Edit credit notes',
  'credit-notes.delete': 'Delete credit notes',
  
  // Communication
  'communication.view': 'View communication',
  'templates.view': 'View templates',
  'communication-logs.view': 'View communication logs',
  'sms.view': 'View SMS',
  'sms.send': 'Send SMS',
  'sms.bulk_send': 'Bulk send SMS',
  'sms.history': 'View SMS history',
  'email.view': 'View email',
  'email.send': 'Send email',
  'email.bulk_send': 'Bulk send email',
  'email.history': 'View email history',
  
  // Tasks
  'tasks.view': 'View tasks',
  'tasks.create': 'Create tasks',
  'tasks.edit': 'Edit tasks',
  'tasks.delete': 'Delete tasks',
  'tasks.assign': 'Assign tasks',
  
  'task-templates.view': 'View task templates',
  'task-templates.create': 'Create task templates',
  'task-templates.edit': 'Edit task templates',
  'task-templates.delete': 'Delete task templates',
  
  // Projects
  'projects.view': 'View projects',
  'projects.create': 'Create projects',
  'projects.edit': 'Edit projects',
  'projects.delete': 'Delete projects',
  'projects.manage': 'Manage project configuration',
  
  'task-categories.view': 'View task categories',
  'task-categories.create': 'Create task categories',
  'task-categories.edit': 'Edit task categories',
  'task-categories.delete': 'Delete task categories',
  
  'recurring-tasks.view': 'View recurring tasks',
  'recurring-tasks.create': 'Create recurring tasks',
  'recurring-tasks.edit': 'Edit recurring tasks',
  'recurring-tasks.delete': 'Delete recurring tasks',
  'recurring-tasks.generate': 'Generate recurring tasks',
  
  // Agents
  'agents.view': 'View agents',
  'agents.create': 'Create agents',
  'agents.edit': 'Edit agents',
  'agents.delete': 'Delete agents',
  'commissions.view': 'View commissions',
  'commissions.create': 'Create commissions',
  'commissions.edit': 'Edit commissions',
  'commissions.delete': 'Delete commissions',
  
  // Reports
  'reports.view': 'View reports',
  
  // AI Analyst
  'ai_analyst.access': 'Access AI Business Analyst',
  
  // Settings
  'settings.view': 'View settings',
  'users.view': 'View users',
  'users.create': 'Create users',
  'users.edit': 'Edit users',
  'users.delete': 'Delete users',
  'users.manage': 'Manage users (full access)',
  
  'roles.view': 'View roles',
  'roles.create': 'Create roles',
  'roles.edit': 'Edit roles',
  'roles.delete': 'Delete roles',
  'roles.manage': 'Manage roles (full access)',
  
  'product-settings.view': 'View product settings',
  'currency-settings.view': 'View currency settings',
  'business-settings.view': 'View business settings',
  'google-maps.view': 'View Google Maps',
  'google-maps.config': 'Configure Google Maps',
  'credit-monitoring.view': 'View credit monitoring',
  'credit-monitoring.manage': 'Manage credit monitoring',
  'backup-settings.view': 'View backup settings',
  'backup-settings.manage': 'Manage backup settings',
  'system-settings.view': 'View system settings',
  
  'notifications.view': 'View notifications',
  'notifications.create': 'Create notifications',
  'notifications.edit': 'Edit notifications',
  'notifications.delete': 'Delete notifications',
  'notifications.config': 'Configure notifications',
  
  'notification-templates.view': 'View notification templates',
  'notification-templates.create': 'Create notification templates',
  'notification-templates.edit': 'Edit notification templates',
  'notification-templates.delete': 'Delete notification templates',
  
  'lead-sources.view': 'View lead sources',
  'lead-sources.create': 'Create lead sources',
  'lead-sources.edit': 'Edit lead sources',
  'lead-sources.delete': 'Delete lead sources',
  
  'audit-trail.view': 'View audit trail',
  'cron-settings.view': 'View cron jobs and reminders settings',
  
  'ai-settings.view': 'View AI settings',
  'ai-settings.manage': 'Manage AI settings',
  
  // Ecommerce
  'ecommerce.view': 'View ecommerce',
  'ecommerce-orders.view': 'View ecommerce orders',
  'ecommerce-orders.create': 'Create ecommerce orders',
  'ecommerce-orders.edit': 'Edit ecommerce orders',
  'ecommerce-orders.delete': 'Delete ecommerce orders',
  'ecommerce-abandoned-carts.view': 'View abandoned carts',
  'ecommerce-abandoned-carts.manage': 'Manage abandoned carts',
  
  'ecommerce-best-deals.view': 'View best deals',
  'ecommerce-best-deals.manage': 'Manage best deals products',
  'ecommerce-customers.view': 'View ecommerce customers',
  'ecommerce-customers.create': 'Create ecommerce customers',
  'ecommerce-customers.edit': 'Edit ecommerce customers',
  'ecommerce-customers.delete': 'Delete ecommerce customers',
  'ecommerce-categories.view': 'View ecommerce categories',
  'ecommerce-categories.create': 'Create ecommerce categories',
  'ecommerce-categories.edit': 'Edit ecommerce categories',
  'ecommerce-categories.delete': 'Delete ecommerce categories',
  'ecommerce-marketing.view': 'View ecommerce marketing',
  'ecommerce-marketing.create': 'Create ecommerce marketing',
  'ecommerce-marketing.edit': 'Edit ecommerce marketing',
  'ecommerce-marketing.delete': 'Delete ecommerce marketing',
  'ecommerce-settings.view': 'View ecommerce settings',
  'ecommerce-settings.manage': 'Manage ecommerce settings',
  'ecommerce-analytics.view': 'View ecommerce analytics',
} as const;

// Define module access mappings - what abilities are required for each module
export const MODULE_ACCESS = {
  'dashboard': ['dashboard.view'],
  'products': ['products.view'],
  'inventory': ['inventory.view'],
  'warehouses': ['warehouses.view'],
  'price-lists': ['price-lists.view'],
  'crm': ['leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'accounts.view', 'accounts.create', 'accounts.edit', 'accounts.delete', 'opportunities.view', 'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete'],
  'leads': ['leads.view', 'leads.create', 'leads.edit', 'leads.delete'],
  'accounts': ['accounts.view', 'accounts.create', 'accounts.edit', 'accounts.delete'],
  'opportunities': ['opportunities.view'],
  'quotations': ['quotations.view'],
  'contacts': ['contacts.view'],
  'backorders': ['backorders.view'],
  'drm': ['drm.view'],
  'distributor-leads': ['distributor-leads.view'],
  'distributors': ['distributors.view'],
  'routes-mapping': ['routes-mapping.view'],
  'engagement': ['engagement.view'],
  'drm-orders': ['drm-orders.view'],
  'sales': ['sales.view'],
  'orders': ['orders.view'],
  'proformas': ['proformas.view'],
  'invoices': ['invoices.view'],
  'payments': ['payments.view'],
  'returns': ['returns.view'],
  'credit-notes': ['credit-notes.view'],
  'communication': ['communication.view'],
  'templates': ['templates.view'],
  'communication-logs': ['communication-logs.view'],
  'sms': ['sms.view'],
  'sms-history': ['sms.view', 'sms.history'],
  'email': ['email.view'],
  'email-history': ['email.view', 'email.history'],
  'tasks': ['tasks.view'],
  'my-tasks': ['tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign'],
  'recurring-tasks': ['recurring-tasks.view'],
  'task_templates': ['task-templates.view'],
  'agents': ['agents.view'],
  'commissions': ['commissions.view'],
  'reports': ['reports.view'],
  'ai_analyst': ['ai_analyst.access'],
  'settings': ['settings.view'],
  'users': ['users.view'],
  'roles': ['roles.view'],
  'profile': ['settings.view'], // Profile is accessible to anyone with settings access
  'security': ['settings.view'], // Security/Login History is accessible to anyone with settings access
  'product-settings': ['product-settings.view'],
  'currency-settings': ['currency-settings.view'],
  'business-settings': ['business-settings.view'],
  'google-maps': ['google-maps.view'],
  'credit-monitoring': ['credit-monitoring.view'],
  'backup-settings': ['backup-settings.view'],
  'system-settings': ['system-settings.view'],
  'notifications': ['notifications.view'],
  'notification-templates': ['notification-templates.view'],
  'notification_templates': ['notification-templates.view'],
  'lead-sources': ['lead-sources.view'],
  'lead_sources': ['lead-sources.view'],
  'ai-settings': ['ai-settings.view'],
  'ecommerce': ['ecommerce.view'],
  'ecommerce-orders': ['ecommerce-orders.view'],
  'ecommerce-abandoned-carts': ['ecommerce-abandoned-carts.view'],
  'ecommerce-best-deals': ['ecommerce-best-deals.view'],
  'ecommerce-customers': ['ecommerce-customers.view'],
  'ecommerce-categories': ['ecommerce-categories.view'],
  'ecommerce-marketing': ['ecommerce-marketing.view'],
  'ecommerce-settings': ['ecommerce-settings.view'],
  'ecommerce-cms': ['ecommerce-settings.view'],
  'ecommerce-analytics': ['ecommerce-analytics.view'],
  'projects': ['projects.view'],
  'audit-trail': ['audit-trail.view'],
  'cron-settings': ['cron-settings.view'],
  'modules': ['settings.view', 'system-settings.view'],
} as const;

// Define role-based abilities - single source of truth
export const ROLE_ABILITIES = {
  'SUPER_ADMIN': [
    // Dashboard
    'dashboard.view',
    
    // Products
    'products.view', 'products.create', 'products.edit', 'products.delete', 'products.view_cost',
    
    // Projects
    'projects.view', 'projects.create', 'projects.edit', 'projects.delete', 'projects.manage',
    
    // Inventory
    'inventory.view', 'stock.view', 'stock.create', 'stock.edit', 'stock.delete', 'stock.view_cost',
    
    // Warehouses
    'warehouses.view', 'warehouses.create', 'warehouses.edit', 'warehouses.delete',
    
    // Price Lists
    'price-lists.view', 'price-lists.create', 'price-lists.edit', 'price-lists.delete',
    
    // CRM
    'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.manage',
    'accounts.view', 'accounts.create', 'accounts.edit', 'accounts.delete',
    'opportunities.view', 'opportunities.create', 'opportunities.edit', 'opportunities.delete',
    'quotations.view', 'quotations.create', 'quotations.edit', 'quotations.delete',
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete',
    
    // Backorders
    'backorders.view', 'backorders.create', 'backorders.edit', 'backorders.delete',
    
    // DRM
    'drm.view', 'distributor-leads.view', 'distributor-leads.create', 'distributor-leads.edit', 'distributor-leads.delete',
    'distributors.view', 'distributors.create', 'distributors.edit', 'distributors.delete',
    'routes-mapping.view', 'routes-mapping.create', 'routes-mapping.edit', 'routes-mapping.delete',
    'engagement.view', 'engagement.create', 'engagement.edit', 'engagement.delete',
    'drm-orders.view',
    
    // Sales
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete',
    'payments.view', 'payments.create', 'payments.edit', 'returns.view', 
    'credit-notes.view', 'credit-notes.create', 'credit-notes.edit', 'credit-notes.delete',
    
    // Communication
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.send', 'sms.bulk_send', 'sms.history',
    'email.view', 'email.send', 'email.bulk_send', 'email.history',
    
    // Tasks
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'task-templates.view', 'task-templates.create', 'task-templates.edit', 'task-templates.delete',
    'task-categories.view', 'task-categories.create', 'task-categories.edit', 'task-categories.delete',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit', 'recurring-tasks.delete', 'recurring-tasks.generate',
    
    // Agents
    'agents.view', 'agents.create', 'agents.edit', 'agents.delete',
    'commissions.view', 'commissions.create', 'commissions.edit', 'commissions.delete',
    
    // Reports
    'reports.view',
    
    // AI Analyst
    'ai_analyst.access',
    
    // Settings
    'settings.view', 'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage',
    'roles.view', 'roles.create', 'roles.edit', 'roles.delete', 'roles.manage',
    'product-settings.view', 'currency-settings.view', 'business-settings.view', 
    'google-maps.view', 'google-maps.config', 'credit-monitoring.view', 'credit-monitoring.manage', 
    'backup-settings.view', 'backup-settings.manage', 'system-settings.view',
    'notifications.view', 'notifications.create', 'notifications.edit', 'notifications.delete', 'notifications.config',
    'notification-templates.view', 'notification-templates.create', 'notification-templates.edit', 'notification-templates.delete',
    'lead-sources.view', 'lead-sources.create', 'lead-sources.edit', 'lead-sources.delete',
    'ai-settings.view', 'ai-settings.manage',
    'audit-trail.view',
    'cron-settings.view',
    
    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-orders.create', 'ecommerce-orders.edit', 'ecommerce-orders.delete',
    'ecommerce-abandoned-carts.view', 'ecommerce-abandoned-carts.manage',
    'ecommerce-best-deals.view', 'ecommerce-best-deals.manage',
    'ecommerce-customers.view', 'ecommerce-customers.create', 'ecommerce-customers.edit', 'ecommerce-customers.delete',
    'ecommerce-categories.view', 'ecommerce-categories.create', 'ecommerce-categories.edit', 'ecommerce-categories.delete',
    'ecommerce-marketing.view', 'ecommerce-marketing.create', 'ecommerce-marketing.edit', 'ecommerce-marketing.delete',
    'ecommerce-analytics.view',
    'ecommerce-settings.view', 'ecommerce-settings.manage',
  ],
  
  'ADMIN': [
    // Dashboard
    'dashboard.view',
    
    // Products
    'products.view', 'products.create', 'products.edit', 'products.delete', 'products.view_cost',
    
    // Projects
    'projects.view', 'projects.create', 'projects.edit', 'projects.delete', 'projects.manage',
    
    // Inventory
    'inventory.view', 'stock.view', 'stock.create', 'stock.edit', 'stock.delete', 'stock.view_cost',
    
    // Warehouses
    'warehouses.view', 'warehouses.create', 'warehouses.edit', 'warehouses.delete',
    
    // Price Lists
    'price-lists.view', 'price-lists.create', 'price-lists.edit', 'price-lists.delete',
    
    // CRM
    'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.manage',
    'accounts.view', 'accounts.create', 'accounts.edit', 'accounts.delete',
    'opportunities.view', 'opportunities.create', 'opportunities.edit', 'opportunities.delete',
    'quotations.view', 'quotations.create', 'quotations.edit', 'quotations.delete',
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete',
    
    // Backorders
    'backorders.view', 'backorders.create', 'backorders.edit', 'backorders.delete',
    
    // DRM
    'drm.view', 'distributor-leads.view', 'distributor-leads.create', 'distributor-leads.edit', 'distributor-leads.delete',
    'distributors.view', 'distributors.create', 'distributors.edit', 'distributors.delete',
    'routes-mapping.view', 'routes-mapping.create', 'routes-mapping.edit', 'routes-mapping.delete',
    'engagement.view', 'engagement.create', 'engagement.edit', 'engagement.delete',
    'drm-orders.view',
    
    // Sales
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete',
    'payments.view', 'payments.create', 'payments.edit', 'returns.view', 
    'credit-notes.view', 'credit-notes.create', 'credit-notes.edit', 'credit-notes.delete',
    
    // Communication
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.send', 'sms.bulk_send', 'sms.history',
    'email.view', 'email.send', 'email.bulk_send', 'email.history',
    
    // Tasks
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'task-templates.view', 'task-templates.create', 'task-templates.edit', 'task-templates.delete',
    'task-categories.view', 'task-categories.create', 'task-categories.edit', 'task-categories.delete',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit', 'recurring-tasks.delete', 'recurring-tasks.generate',
    
    // Agents
    'agents.view', 'agents.create', 'agents.edit', 'agents.delete',
    'commissions.view', 'commissions.create', 'commissions.edit', 'commissions.delete',
    
    // Reports
    'reports.view',
    
    // AI Analyst
    'ai_analyst.access',
    
    // Settings
    'settings.view', 'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage',
    'roles.view', 'roles.create', 'roles.edit', 'roles.delete', 'roles.manage',
    'product-settings.view', 'currency-settings.view', 'business-settings.view', 
    'google-maps.view', 'google-maps.config', 'credit-monitoring.view', 'credit-monitoring.manage', 
    'backup-settings.view', 'backup-settings.manage', 'system-settings.view',
    'notifications.view', 'notifications.create', 'notifications.edit', 'notifications.delete', 'notifications.config',
    'notification-templates.view', 'notification-templates.create', 'notification-templates.edit', 'notification-templates.delete',
    'lead-sources.view', 'lead-sources.create', 'lead-sources.edit', 'lead-sources.delete',
    'ai-settings.view', 'ai-settings.manage',
    'audit-trail.view',
    'cron-settings.view',

    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-orders.create', 'ecommerce-orders.edit', 'ecommerce-orders.delete',
    'ecommerce-abandoned-carts.view', 'ecommerce-abandoned-carts.manage',
    'ecommerce-best-deals.view', 'ecommerce-best-deals.manage',
    'ecommerce-customers.view', 'ecommerce-customers.create', 'ecommerce-customers.edit', 'ecommerce-customers.delete',
    'ecommerce-categories.view', 'ecommerce-categories.create', 'ecommerce-categories.edit', 'ecommerce-categories.delete',
    'ecommerce-marketing.view', 'ecommerce-marketing.create', 'ecommerce-marketing.edit', 'ecommerce-marketing.delete',
    'ecommerce-analytics.view',
    'ecommerce-settings.view', 'ecommerce-settings.manage',
  ],
  
  'SALES_MANAGER': [
    'dashboard.view',
    'products.view',
    'inventory.view', 'stock.view',
    'warehouses.view',
    'price-lists.view',
    'leads.view', 'leads.create', 'leads.edit',
    'accounts.view', 'accounts.create', 'accounts.edit',
    'opportunities.view', 'opportunities.create', 'opportunities.edit',
    'quotations.view', 'quotations.create', 'quotations.edit',
    'contacts.view', 'contacts.create', 'contacts.edit',
    'backorders.view', 'backorders.create',
    'drm.view', 'distributor-leads.view', 'distributors.view', 'routes-mapping.view', 'engagement.view',
    'drm-orders.view',
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'payments.view', 'returns.view',
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.send', 'sms.bulk_send', 'sms.history',
    'email.view', 'email.send', 'email.bulk_send', 'email.history',
    'tasks.view', 'tasks.create', 'tasks.edit',
    'task-templates.view', 'task-templates.create', 'task-templates.edit',
    'task-categories.view', 'task-categories.create', 'task-categories.edit',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit',
    'agents.view', 'commissions.view',
    'reports.view',
    'settings.view', 'users.view',

    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-abandoned-carts.view',
    'ecommerce-best-deals.view', 'ecommerce-best-deals.manage',
    'ecommerce-customers.view', 'ecommerce-categories.view', 'ecommerce-marketing.view', 'ecommerce-settings.view',
  ],
  
  'SALES_REP': [
    'dashboard.view',
    'products.view',
    'inventory.view', 'stock.view',
    'warehouses.view',
    'price-lists.view',
    'leads.view', 'leads.create', 'leads.edit',
    'accounts.view', 'accounts.create', 'accounts.edit',
    'opportunities.view', 'opportunities.create', 'opportunities.edit',
    'quotations.view', 'quotations.create', 'quotations.edit',
    'contacts.view', 'contacts.create', 'contacts.edit',
    'backorders.view', 'backorders.create',
    'drm.view', 'distributor-leads.view', 'distributors.view', 'routes-mapping.view', 'engagement.view',
    'drm-orders.view',
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'payments.view', 'returns.view',
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.send', 'sms.bulk_send', 'sms.history',
    'email.view', 'email.send', 'email.bulk_send', 'email.history',
    'tasks.view', 'tasks.create', 'tasks.edit',
    'task-templates.view', 'task-templates.create', 'task-templates.edit',
    'task-categories.view', 'task-categories.create', 'task-categories.edit',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit',
    'agents.view', 'commissions.view',
    'reports.view',
    'settings.view', 'users.view',

    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-abandoned-carts.view',
    'ecommerce-best-deals.view', 'ecommerce-best-deals.manage',
    'ecommerce-customers.view', 'ecommerce-categories.view', 'ecommerce-marketing.view', 'ecommerce-settings.view',
  ],
  
  'INVENTORY_MANAGER': [
    'dashboard.view',
    'products.view', 'products.create', 'products.edit',
    'inventory.view', 'stock.view', 'stock.create', 'stock.edit', 'stock.delete',
    'warehouses.view', 'warehouses.create', 'warehouses.edit', 'warehouses.delete',
    'price-lists.view',
    'backorders.view', 'backorders.create', 'backorders.edit',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'task-templates.view', 'task-templates.create', 'task-templates.edit', 'task-templates.delete',
    'task-categories.view', 'task-categories.create', 'task-categories.edit', 'task-categories.delete',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit', 'recurring-tasks.delete', 'recurring-tasks.generate',
    'reports.view',
    'settings.view', 'users.view',

    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-abandoned-carts.view',
    'ecommerce-best-deals.view', 'ecommerce-best-deals.manage',
    'ecommerce-customers.view', 'ecommerce-categories.view', 'ecommerce-marketing.view', 'ecommerce-settings.view',
  ],
  
  'FINANCE_OFFICER': [
    'dashboard.view',
    'products.view',
    'inventory.view', 'stock.view',
    'warehouses.view',
    'price-lists.view',
    'accounts.view',
    'opportunities.view',
    'quotations.view',
    'contacts.view',
    'backorders.view',
    'drm.view', 'distributor-leads.view', 'distributors.view', 'routes-mapping.view', 'engagement.view',
    'drm-orders.view',
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'invoices.create', 'invoices.edit',
    'payments.view', 'payments.create', 'payments.edit', 'returns.view',
    'credit-notes.view', 'credit-notes.create', 'credit-notes.edit', 'credit-notes.delete',
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.send', 'sms.bulk_send', 'sms.history',
    'email.view', 'email.send', 'email.bulk_send', 'email.history',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'task-templates.view', 'task-templates.create', 'task-templates.edit', 'task-templates.delete',
    'task-categories.view', 'task-categories.create', 'task-categories.edit', 'task-categories.delete',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit', 'recurring-tasks.delete', 'recurring-tasks.generate',
    'agents.view', 'commissions.view',
    'reports.view',
    'settings.view', 'users.view',

    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-orders.create', 'ecommerce-orders.edit',
    'ecommerce-customers.view', 'ecommerce-categories.view', 'ecommerce-marketing.view', 'ecommerce-settings.view',
  ],
  
  'CUSTOMER_SERVICE': [
    'dashboard.view',
    'products.view',
    'inventory.view', 'stock.view',
    'warehouses.view',
    'price-lists.view',
    'leads.view', 'leads.create', 'leads.edit',
    'accounts.view', 'accounts.create', 'accounts.edit',
    'opportunities.view', 'opportunities.create', 'opportunities.edit',
    'quotations.view', 'quotations.create', 'quotations.edit',
    'contacts.view', 'contacts.create', 'contacts.edit',
    'backorders.view', 'backorders.create',
    'drm.view', 'distributor-leads.view', 'distributors.view', 'routes-mapping.view', 'engagement.view',
    'drm-orders.view',
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'payments.view', 'returns.view',
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.send', 'sms.bulk_send', 'sms.history',
    'email.view', 'email.send', 'email.bulk_send', 'email.history',
    'tasks.view', 'tasks.create', 'tasks.edit',
    'task-templates.view', 'task-templates.create', 'task-templates.edit',
    'task-categories.view', 'task-categories.create', 'task-categories.edit',
    'recurring-tasks.view', 'recurring-tasks.create', 'recurring-tasks.edit',
    'agents.view', 'commissions.view',
    'reports.view',
    'settings.view', 'users.view',

    // Ecommerce
    'ecommerce.view', 'ecommerce-orders.view', 'ecommerce-abandoned-carts.view',
    'ecommerce-best-deals.view', 'ecommerce-best-deals.manage',
    'ecommerce-customers.view', 'ecommerce-categories.view', 'ecommerce-marketing.view', 'ecommerce-settings.view',
  ],
  
  'VIEWER': [
    'dashboard.view',
    'products.view',
    'inventory.view', 'stock.view',
    'warehouses.view',
    'price-lists.view',
    'leads.view',
    'accounts.view',
    'opportunities.view',
    'quotations.view',
    'contacts.view',
    'backorders.view',
    'drm.view', 'distributor-leads.view', 'distributors.view', 'routes-mapping.view', 'engagement.view',
    'drm-orders.view',
    'sales.view', 'orders.view', 'proformas.view', 'invoices.view', 'payments.view', 'returns.view',
    'communication.view', 'templates.view', 'communication-logs.view',
    'sms.view', 'sms.history',
    'email.view', 'email.history',
    'tasks.view',
    'task-templates.view',
    'task-categories.view',
    'recurring-tasks.view',
    'agents.view', 'commissions.view',
    'reports.view',
    'settings.view', 'users.view',
  ],
} as const;

// Type definitions for better TypeScript support
export type Ability = keyof typeof ABILITIES;
export type Module = keyof typeof MODULE_ACCESS;
export type Role = keyof typeof ROLE_ABILITIES;

// Utility functions
export function getAbilitiesForRole(role: Role): Ability[] {
  return ROLE_ABILITIES[role] || [];
}

export function getRequiredAbilitiesForModule(module: Module): Ability[] {
  return MODULE_ACCESS[module] || [];
}

export function canAccessModule(userAbilities: Ability[], module: Module): boolean {
  const requiredAbilities = getRequiredAbilitiesForModule(module);
  return requiredAbilities.some(ability => userAbilities.includes(ability));
}

export function hasAbility(userAbilities: Ability[], ability: Ability): boolean {
  return userAbilities.includes(ability);
}

// Validation function to ensure consistency
export function validatePermissions(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check that all abilities in MODULE_ACCESS exist in ABILITIES
  for (const [module, abilities] of Object.entries(MODULE_ACCESS)) {
    for (const ability of abilities) {
      if (!(ability in ABILITIES)) {
        errors.push(`Module '${module}' references non-existent ability '${ability}'`);
      }
    }
  }
  
  // Check that all abilities in ROLE_ABILITIES exist in ABILITIES
  for (const [role, abilities] of Object.entries(ROLE_ABILITIES)) {
    for (const ability of abilities) {
      if (!(ability in ABILITIES)) {
        errors.push(`Role '${role}' references non-existent ability '${ability}'`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
