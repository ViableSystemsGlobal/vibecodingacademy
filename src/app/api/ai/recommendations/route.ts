import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIService, BUSINESS_ANALYST_PROMPT } from '@/lib/ai-service';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getExchangeRate } from '@/lib/currency';
import crypto from 'crypto';
import { ROLE_ABILITIES, type Role } from '@/lib/permissions';

// Page-specific prompts for different business contexts
const PAGE_PROMPTS = {
  'crm-dashboard': `You are analyzing CRM data. Focus on lead conversion, opportunity pipeline, and customer engagement insights. Provide 5 actionable recommendations for improving CRM performance.`,
  
  'dashboard': `You are a business analyst analyzing comprehensive business data across all departments. Your goal is to identify the TOP 5 HIGH-IMPACT actions that will move the needle for this business. Focus on revenue growth, operational efficiency, and strategic opportunities. Each recommendation must be:
- PRACTICAL and immediately actionable
- DATA-DRIVEN based on the actual metrics provided
- HIGH-IMPACT (will significantly impact business outcomes)
- SPECIFIC with concrete steps to take

CRITICAL: Only create recommendations for metrics that have NON-ZERO values. If a metric is 0, DO NOT create a recommendation about it. For example:
- If pendingQuotations = 0, DO NOT create "Follow up on 0 pending quotations"
- If overdueInvoices = 0, DO NOT create "Collect GH₵0 in overdue invoices"
- If qualifiedLeads = 0, DO NOT create "Convert 0 qualified leads"
- If monthlyRevenue = 0, DO NOT create "Increase revenue from GH₵0"

Instead, focus on:
1. Metrics with actual values (e.g., if there are 5 pending quotations, recommend following up on those 5)
2. Setup/getting started actions if the system is new (e.g., "Add your first product", "Create your first lead")
3. Growth opportunities based on existing data (e.g., "Expand product catalog", "Improve lead generation")

Prioritize actions that:
1. Directly increase revenue (closing deals, following up on opportunities, converting leads) - ONLY if there are actual opportunities/leads
2. Prevent losses (overdue invoices, low stock alerts, abandoned opportunities) - ONLY if these exist
3. Optimize operations (pricing strategies, inventory levels, conversion rates) - ONLY if there's data to optimize
4. Address urgent issues (pending quotations, unpaid invoices, stuck opportunities) - ONLY if these exist

Provide 5 recommendations in priority order (highest impact first). Each should include a clear title, detailed description explaining WHY it matters and WHAT to do, priority level (high/medium/low), and suggested action.`,
  
  'opportunities': `You are analyzing the sales pipeline and opportunities. Focus on deal progression, win rates, and pipeline optimization. Provide 5 actionable recommendations for improving sales performance.`,
  
  'leads': `You are analyzing lead data and conversion patterns. Focus on lead quality, follow-up strategies, and conversion optimization. Provide 3 actionable recommendations for improving lead management.`,
  
  'accounts': `You are analyzing account data and customer relationship management. Focus on account engagement, revenue opportunities, and relationship optimization. Provide 3 actionable recommendations for improving account management.`,
  
  'products': `You are analyzing product and inventory data. Focus on stock levels, product performance, and inventory optimization. Provide 3 actionable recommendations for improving product management.`,
  
  'inventory': `You are analyzing inventory and stock data. Focus on stock levels, movement patterns, and warehouse optimization. Provide 3 actionable recommendations for improving inventory management.`,
  
  'tasks': `You are analyzing TASK MANAGEMENT data ONLY. Focus EXCLUSIVELY on tasks, task completion rates, task priorities, task deadlines, overdue tasks, and task workflow optimization. Do NOT mention quotations, invoices, leads, opportunities, products, or any other business areas. Provide 3 actionable recommendations SPECIFICALLY for improving task management, addressing overdue tasks, optimizing task priorities, and improving task completion rates.`,
  
  'warehouses': `You are analyzing warehouse operations and inventory data. Focus on warehouse efficiency, stock distribution, and operational optimization. Provide 3 actionable recommendations for improving warehouse management.`,
  
  'stock': `You are analyzing stock levels and inventory management. Focus on stock optimization, reorder points, low stock alerts, and inventory valuation. Provide 3 actionable recommendations for improving stock management and preventing stockouts.`,
  
  'stock-movements': `You are analyzing stock movement patterns and transactions. Focus on movement types, frequency, warehouse transfers, and inventory flow optimization. Provide 3 actionable recommendations for improving stock movement efficiency and accuracy.`,
  
  'backorders': `You are analyzing backorders and order fulfillment data. Focus on fulfillment rates, pending orders, priority management, and preventing stockouts that cause backorders. Provide 3 actionable recommendations for improving backorder management and fulfillment speed.`,
  
  'invoices': `You are analyzing invoice and payment data. Focus on payment collection, overdue invoices, cash flow optimization, and payment patterns. Provide 3 actionable recommendations for improving invoice management, reducing overdue amounts, and optimizing payment collection.`,
  
  'quotations': `You are analyzing quotation and sales data. Focus on conversion rates, quotation acceptance, pricing strategies, and follow-up effectiveness. Provide 3 actionable recommendations for improving quotation management, increasing conversion rates, and optimizing sales processes.`,
  
  'orders': `You are analyzing order fulfillment and delivery data. Focus on order processing times, fulfillment rates, delivery efficiency, and order status optimization. Provide 3 actionable recommendations for improving order management, reducing processing times, and optimizing fulfillment processes.`,
  
  'ecommerce-orders': `You are analyzing ecommerce order operations with an emphasis on COD (cash on delivery) reconciliation. Focus on fulfillment readiness, delivery scheduling, COD collection, and customer communication for online orders. Provide 3 actionable recommendations grounded in the provided ecommerce metrics.`,
  
  'ecommerce-customers': `You are analyzing ecommerce customer operations. Focus on customer lifecycle value, repeat purchase behaviour, COD risk, and proactive communication. Provide 3 actionable recommendations to strengthen customer retention, accelerate cash collection, and improve delivery success.`,
  
  'ecommerce-categories': `You are analyzing ecommerce merchandising categories. Focus on category preparedness, featured placement, product coverage, merchandising metadata, and operational guidance. Provide 3 actionable recommendations to improve storefront relevancy, campaign readiness, and fulfilment playbooks based on the provided category metrics.`,
  
  'payments': `You are analyzing payment and cash flow data. Focus on payment collection, cash flow patterns, outstanding invoices, and payment method optimization. Provide 3 actionable recommendations for improving payment management, reducing outstanding amounts, and optimizing cash flow.`,
  
  'returns': `You are analyzing product returns and refund data. Focus on return rates, return reasons, processing times, and prevention strategies. Provide 3 actionable recommendations for reducing returns, improving return processing efficiency, and addressing common return causes.`,
  
  'reports': `You are analyzing comprehensive business reports and metrics. Focus on overall business performance, trends, and strategic insights. Provide 3 actionable recommendations for improving business performance.`,
  
  'contacts': `You are analyzing contact data and relationship management. Focus on contact engagement, communication completeness, and relationship optimization. Provide 3 actionable recommendations for improving contact management, ensuring complete contact information, and enhancing relationship tracking.`,
  
  'distributor-leads': `You are analyzing distributor lead applications and onboarding data. Focus on application processing times, approval rates, and lead quality. Provide 3 actionable recommendations for improving distributor lead management, reducing processing times, and increasing conversion rates.`,
  
  'distributors': `You are analyzing active distributor network and performance data. Focus on distributor engagement, sales performance, territory optimization, and network growth. Provide 3 actionable recommendations for improving distributor management, increasing sales volume, and optimizing distributor network efficiency.`,
  
  'routes-mapping': `You are analyzing route planning, zone management, and driver efficiency data. Focus on route optimization, delivery efficiency, zone coverage, and driver utilization. Provide 3 actionable recommendations for improving route planning, reducing delivery times, optimizing zone coverage, and enhancing driver productivity.`,
  
  'projects': `You are analyzing project management data. Focus on project delivery, task completion, incident resolution, resource allocation, and deadline management. Provide 5 actionable recommendations for improving project delivery, reducing risks, optimizing resource utilization, and ensuring on-time completion.`
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { page, context } = body;

    if (!page) {
      return NextResponse.json({ error: 'Page parameter is required' }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Fetch user abilities for permission checks
    const userAbilities = await getUserAbilities(userId, session.user.role as Role);

    // Get AI settings and currency settings
    const [aiSettings, currencySettings] = await Promise.all([
      prisma.systemSettings.findMany({
      where: {
        key: {
          in: [
            'ai_enabled',
            'ai_provider',
            'ai_openai_api_key',
            'ai_anthropic_api_key',
            'ai_gemini_api_key',
            'ai_model',
            'ai_temperature',
            'ai_max_tokens',
            'ai_enable_recommendations'
          ]
        }
      }
      }),
      prisma.systemSettings.findMany({
        where: {
          category: 'currency',
          isActive: true
        }
      })
    ]);

    // Get base currency
    const baseCurrencySetting = currencySettings.find(s => s.key === 'base_currency');
    const baseCurrency = baseCurrencySetting?.value || 'GHS';
    const currencySymbol = baseCurrency === 'GHS' ? 'GH₵' : (baseCurrency === 'USD' ? '$' : baseCurrency);

    // Check if AI is enabled
    const enabledSetting = aiSettings.find(s => s.key === 'ai_enabled');
    const recommendationsEnabled = aiSettings.find(s => s.key === 'ai_enable_recommendations');
    
    if (enabledSetting?.value !== 'true' || recommendationsEnabled?.value !== 'true') {
      return NextResponse.json({
        success: true,
        recommendations: [],
        message: 'AI recommendations are disabled'
      });
    }

    // Build AI settings object
    const settingsObj: any = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000
    };

    aiSettings.forEach(setting => {
      switch (setting.key) {
        case 'ai_provider':
          settingsObj.provider = setting.value;
          break;
        case 'ai_openai_api_key':
          settingsObj.openaiApiKey = setting.value;
          break;
        case 'ai_anthropic_api_key':
          settingsObj.anthropicApiKey = setting.value;
          break;
        case 'ai_gemini_api_key':
          settingsObj.geminiApiKey = setting.value;
          break;
        case 'ai_model':
          settingsObj.model = setting.value;
          break;
        case 'ai_temperature':
          settingsObj.temperature = parseFloat(setting.value);
          break;
        case 'ai_max_tokens':
          settingsObj.maxTokens = parseInt(setting.value);
          break;
      }
    });

    // Check if API key is configured
    const apiKeyField = settingsObj.provider === 'openai' ? 'openaiApiKey' : 
                       settingsObj.provider === 'anthropic' ? 'anthropicApiKey' : 'geminiApiKey';
    
    if (!settingsObj[apiKeyField]) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        message: 'AI API key not configured'
      });
    }

    // Get business data based on page context
    const businessData = await getBusinessDataForPage(page, userId, context, userAbilities);
    
    // Log context-specific requests for debugging
    if (context?.accountId && page === 'accounts') {
      console.log(`📊 Fetching specific account data for accountId: ${context.accountId}`);
      console.log(`📊 Business data keys:`, Object.keys(businessData || {}));
      if ((businessData as any)?.error) {
        console.error(`❌ Error fetching account data:`, (businessData as any).error);
      }
    }
    
    // Calculate data hash to detect changes
    const dataHash = crypto
      .createHash('md5')
      .update(JSON.stringify(businessData))
      .digest('hex');
    
    // Include context ID in cache key for context-specific requests
    // Add version to cache key to invalidate old cached recommendations (especially for tasks page filtering)
    const cacheVersion = 'v3'; // Increment this when filtering logic changes (v3: added zero-value filtering for dashboard)
    const contextId = context?.leadId || context?.opportunityId || context?.accountId || '';
    const cacheKey = contextId 
      ? `ai_recommendations_${page}_${contextId}_${dataHash}_${cacheVersion}`
      : `ai_recommendations_${page}_${dataHash}_${cacheVersion}`;
    const cacheSetting = await prisma.systemSettings.findUnique({
      where: { key: cacheKey }
    });
    
    const now = Date.now();
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
    let cachedData: any = null;
    let shouldUseCache = false;
    
    if (cacheSetting) {
      try {
        cachedData = JSON.parse(cacheSetting.value);
        const cacheAge = now - (cachedData.timestamp || 0);
        
        // For tasks page, validate that cached recommendations are task-specific
        if (page === 'tasks' && cachedData.recommendations) {
          const hasNonTaskRecs = cachedData.recommendations.some((rec: any) => {
            const title = (rec.title || '').toLowerCase();
            const desc = (rec.description || '').toLowerCase();
            const nonTaskKeywords = ['quotation', 'invoice', 'lead', 'opportunity', 'product', 'order', 'payment', 'collect', 'follow up on', 'gh₵', 'gh¢', 'prospect', 'deal'];
            return nonTaskKeywords.some(keyword => title.includes(keyword) || desc.includes(keyword));
          });
          
          if (hasNonTaskRecs) {
            console.log(`⚠️ Invalidating tasks cache - contains non-task recommendations`);
            // Delete the invalid cache entry
            await prisma.systemSettings.delete({
              where: { key: cacheKey }
            });
            cachedData = null;
            shouldUseCache = false;
          }
        }
        
        // Use cache if it's less than 1 hour old and data hasn't changed
        if (cachedData && cacheAge < CACHE_DURATION && cachedData.dataHash === dataHash && !shouldUseCache) {
          shouldUseCache = true;
          console.log(`✅ Using cached AI recommendations for ${page} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        } else if (cachedData && (cacheAge >= CACHE_DURATION || cachedData.dataHash !== dataHash)) {
          console.log(`⏰ Cache expired or data changed for ${page}, refreshing...`);
        }
      } catch (e) {
        console.log('⚠️ Error parsing cache, regenerating...');
      }
    }
    
    // If cache is valid, return cached recommendations
    if (shouldUseCache && cachedData?.recommendations) {
      return NextResponse.json({
        success: true,
        recommendations: cachedData.recommendations,
        dataAnalyzed: businessData,
        page,
        cached: true,
        cacheAge: Math.round((now - cachedData.timestamp) / 1000 / 60) // minutes
      });
    }
    
    // Log the data being analyzed for debugging
    console.log(`📊 AI Recommendations for ${page}: Generating new recommendations...`);

    // Create AI service instance
    const aiService = new AIService(settingsObj);

    // Get page-specific prompt
    const pagePrompt = PAGE_PROMPTS[page as keyof typeof PAGE_PROMPTS] || PAGE_PROMPTS['crm-dashboard'];

    // Determine number of recommendations based on page
    const recommendationCount = page === 'dashboard' ? 5 : 3;
    
    // Generate recommendations with explicit data inclusion
    // Check if this is a context-specific request
    const isSpecificLead = context?.leadId && page === 'leads';
    const isSpecificOpportunity = context?.opportunityId && page === 'opportunities';
    const isSpecificAccount = context?.accountId && page === 'accounts';
    
    const dataSummary = isSpecificLead ? `
CRITICAL: This is a specific lead analysis. Focus on THIS PARTICULAR LEAD and provide actionable recommendations specific to this lead.

Lead Details:
- Name: ${(businessData as any).firstName || 'N/A'} ${(businessData as any).lastName || 'N/A'}
- Company: ${(businessData as any).company || 'N/A'}
- Status: ${(businessData as any).status || 'N/A'}
- Source: ${(businessData as any).source || 'N/A'}
- Created: ${(businessData as any).createdAt ? new Date((businessData as any).createdAt).toLocaleDateString() : 'N/A'}
- Days since creation: ${(businessData as any).daysSinceCreation || 0}
- Last contact: ${(businessData as any).lastContactDate || 'Never'}
- Follow-up date: ${(businessData as any).followUpDate || 'Not set'}
- Has overdue follow-up: ${(businessData as any).hasOverdueFollowUp ? 'Yes' : 'No'}
- Assigned to: ${(businessData as any).assignedToNames || 'Unassigned'}
- Product interests: ${(businessData as any).productInterestsCount || 0} products
- Has opportunities: ${(businessData as any).hasOpportunities ? 'Yes' : 'No'}
- Opportunities value: ${(businessData as any).opportunitiesValue || 0}
- Recent activity: ${(businessData as any).recentActivitiesCount || 0} activities
- Tasks: ${(businessData as any).totalTasks || 0} total, ${(businessData as any).pendingTasks || 0} pending, ${(businessData as any).overdueTasks || 0} overdue
- Notes/Comments: ${(businessData as any).commentsCount || 0}
- Files: ${(businessData as any).filesCount || 0}
- Emails: ${(businessData as any).emailsCount || 0}
- SMS: ${(businessData as any).smsCount || 0}
- Meetings: ${(businessData as any).meetingsCount || 0}

Provide 3 SPECIFIC, ACTIONABLE recommendations for THIS PARTICULAR LEAD based on their current status, activity, and data above. Focus on next steps, follow-ups, qualification, or conversion opportunities for THIS LEAD.` : isSpecificOpportunity ? `
CRITICAL: This is a specific opportunity analysis. Focus on THIS PARTICULAR OPPORTUNITY and provide actionable recommendations specific to this opportunity.

Opportunity Details:
- Name: ${(businessData as any).name || 'N/A'}
- Account: ${(businessData as any).accountName || 'N/A'}
- Stage: ${(businessData as any).stage || 'N/A'}
- Value: ${(businessData as any).value || 0}
- Probability: ${(businessData as any).probability || 0}%
- Close Date: ${(businessData as any).closeDate ? new Date((businessData as any).closeDate).toLocaleDateString() : 'Not set'}
- Days until close: ${(businessData as any).daysUntilClose !== undefined ? (businessData as any).daysUntilClose : 'N/A'}
- Is overdue: ${(businessData as any).isOverdueCloseDate ? 'Yes' : 'No'}
- Created: ${(businessData as any).createdAt ? new Date((businessData as any).createdAt).toLocaleDateString() : 'N/A'}
- Days since creation: ${(businessData as any).daysSinceCreation || 0}
- Days in current stage: ${(businessData as any).daysInCurrentStage || 0}
- Owner: ${(businessData as any).ownerName || 'N/A'}
- From lead: ${(businessData as any).fromLead ? 'Yes' : 'No'}
- Quotations: ${(businessData as any).quotationsCount || 0} total, ${(businessData as any).acceptedQuotations || 0} accepted
- Invoices: ${(businessData as any).invoicesCount || 0} total, ${(businessData as any).paidInvoices || 0} paid
- Recent activity: ${(businessData as any).recentActivitiesCount || 0} activities
- Tasks: ${(businessData as any).totalTasks || 0} total, ${(businessData as any).pendingTasks || 0} pending, ${(businessData as any).overdueTasks || 0} overdue
- Notes/Comments: ${(businessData as any).commentsCount || 0}
- Files: ${(businessData as any).filesCount || 0}

Provide 3 SPECIFIC, ACTIONABLE recommendations for THIS PARTICULAR OPPORTUNITY based on their current stage, value, probability, and data above. Focus on progressing the deal, addressing blockers, or closing strategies for THIS OPPORTUNITY.` : isSpecificAccount ? `
CRITICAL: This is a specific account analysis. Focus on THIS PARTICULAR ACCOUNT and provide actionable recommendations specific to this account.

Account Details:
- Name: ${(businessData as any).name || 'N/A'}
- Type: ${(businessData as any).type || 'N/A'}
- Created: ${(businessData as any).createdAt ? new Date((businessData as any).createdAt).toLocaleDateString() : 'N/A'}
- Days since creation: ${(businessData as any).daysSinceCreation || 0}
- Owner: ${(businessData as any).ownerName || 'Unassigned'}
- Contacts: ${(businessData as any).contactsCount || 0} total contacts
- Opportunities: ${(businessData as any).opportunitiesCount || 0} total, ${(businessData as any).openOpportunities || 0} open, ${(businessData as any).wonOpportunities || 0} won
- Opportunities Value: ${(businessData as any).opportunitiesValue || 0} total, ${(businessData as any).openOpportunitiesValue || 0} in open opportunities
- Quotations: ${(businessData as any).quotationsCount || 0} total, ${(businessData as any).pendingQuotations || 0} pending, ${(businessData as any).acceptedQuotations || 0} accepted
- Invoices: ${(businessData as any).invoicesCount || 0} total, ${(businessData as any).unpaidInvoices || 0} unpaid, ${(businessData as any).overdueInvoices || 0} overdue
- Total Revenue: ${(businessData as any).totalRevenue || 0}
- Recent Activity: ${(businessData as any).recentOpportunities || 0} new opportunities in last 30 days, ${(businessData as any).recentQuotations || 0} new quotations in last 30 days
- Tasks: ${(businessData as any).totalTasks || 0} total, ${(businessData as any).pendingTasks || 0} pending, ${(businessData as any).overdueTasks || 0} overdue

Provide 3 SPECIFIC, ACTIONABLE recommendations for THIS PARTICULAR ACCOUNT based on their opportunities, revenue, engagement, and data above. Focus on relationship building, revenue growth, opportunity development, or account optimization for THIS ACCOUNT.` : page === 'dashboard' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Business Metrics:
- Products: ${(businessData as any).totalProducts || 0} total, ${(businessData as any).lowStockItems || 0} low stock, ${(businessData as any).outOfStockItems || 0} out of stock
- CRM: ${(businessData as any).totalLeads || 0} leads (${(businessData as any).newLeads || 0} new this month), ${(businessData as any).qualifiedLeads || 0} qualified
- Opportunities: ${(businessData as any).totalOpportunities || 0} total, ${(businessData as any).openOpportunities || 0} open, ${(businessData as any).wonOpportunities || 0} won this month
- Pipeline Value: ${(businessData as any).pipelineValue || 0}
- Quotations: ${(businessData as any).totalQuotations || 0} total, ${(businessData as any).pendingQuotations || 0} pending, ${(businessData as any).acceptedQuotations || 0} accepted this month
- Invoices: ${(businessData as any).totalInvoices || 0} total, ${(businessData as any).unpaidInvoices || 0} unpaid, ${(businessData as any).overdueInvoices || 0} overdue
- Revenue: ${(businessData as any).totalRevenue || 0} total, ${(businessData as any).monthlyRevenue || 0} this month
- Customers: ${(businessData as any).totalAccounts || 0} accounts

Use these EXACT numbers in your recommendations. Reference specific counts and amounts when making recommendations.` : page === 'leads' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Lead Metrics:
- Total Leads: ${(businessData as any).total || 0}
- Status Breakdown: ${(businessData as any).newLeads || 0} New, ${(businessData as any).contacted || 0} Contacted, ${(businessData as any).qualified || 0} Qualified, ${(businessData as any).converted || 0} Converted, ${(businessData as any).lost || 0} Lost
- New Leads: ${(businessData as any).newLeadsLast7Days || 0} in last 7 days, ${(businessData as any).newLeadsThisMonth || 0} this month
- Stale Leads: ${(businessData as any).newLeadsOver3Days || 0} new leads over 3 days old (need follow-up), ${(businessData as any).contactedOver3Days || 0} contacted leads without update for 3+ days
- Follow-ups: ${(businessData as any).leadsWithFollowUp || 0} have follow-up dates, ${(businessData as any).overdueFollowUps || 0} have overdue follow-ups
- Assignment: ${(businessData as any).assignedLeads || 0} assigned, ${(businessData as any).unassignedLeads || 0} unassigned
- Conversion Rates: ${(businessData as any).conversionRate || 0}% overall, ${(businessData as any).qualificationRate || 0}% qualified, ${(businessData as any).newLeadConversionRate || 0}% new to qualified
- Product Interest: ${(businessData as any).leadsWithProducts || 0} leads have product interests
- Opportunities: ${(businessData as any).leadsWithOpportunities || 0} leads have created opportunities
- Deal Value: Total ${(businessData as any).totalDealValue || 0}, Qualified leads ${(businessData as any).qualifiedDealValue || 0}
- Recent Activity: ${(businessData as any).recentLeads || 0} new leads in last 7 days, ${(businessData as any).recentStatusChanges || 0} status updates
- Sources: ${(businessData as any).totalSources || 0} different sources${Object.keys((businessData as any).sourceBreakdown || {}).length > 0 ? ` - ${Object.entries((businessData as any).sourceBreakdown || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}` : ''}

Use these EXACT numbers in your recommendations. Reference specific counts, percentages, and breakdowns when making recommendations.` : page === 'opportunities' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Opportunity Metrics:
- Total Opportunities: ${(businessData as any).total || 0}
- Stage Breakdown: ${(businessData as any).newOpportunities || 0} Open (not won/lost), ${(businessData as any).quoteSent || 0} Quote Sent, ${(businessData as any).negotiation || 0} Negotiation, ${(businessData as any).won || 0} Won, ${(businessData as any).lost || 0} Lost
- New Opportunities: ${(businessData as any).newLast7Days || 0} in last 7 days, ${(businessData as any).newThisMonth || 0} this month
- Stuck Opportunities: ${(businessData as any).stuckInNegotiation || 0} in negotiation for 30+ days (need follow-up), ${(businessData as any).overdueCloseDates || 0} have overdue close dates
- Pipeline Value: ${(businessData as any).pipelineValue || 0} total value in open opportunities
- Won Opportunities: ${(businessData as any).wonThisMonth || 0} won this month, Total won value: ${(businessData as any).wonValue || 0}
- Won This Month Value: ${(businessData as any).wonThisMonthValue || 0}
- Probability Distribution: ${(businessData as any).highProbability || 0} high (70%+), ${(businessData as any).mediumProbability || 0} medium (40-69%), ${(businessData as any).lowProbability || 0} low (<40%), Average: ${(businessData as any).averageProbability || 0}%
- Conversion Rates: ${(businessData as any).winRate || 0}% win rate, ${(businessData as any).lossRate || 0}% loss rate, ${(businessData as any).openRate || 0}% still open
- Linked Data: ${(businessData as any).withQuotations || 0} have quotations, ${(businessData as any).withInvoices || 0} have invoices, ${(businessData as any).fromLeads || 0} from leads
- Recent Activity: ${(businessData as any).recentOpportunities || 0} new in last 7 days, ${(businessData as any).recentStageChanges || 0} stage updates

Use these EXACT numbers in your recommendations. Reference specific counts, percentages, deal values, and stage breakdowns when making recommendations.` : page === 'accounts' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Account Metrics:
- Total Accounts: ${(businessData as any).total || 0}
- Type Breakdown: ${(businessData as any).companies || 0} Companies, ${(businessData as any).individuals || 0} Individuals, ${(businessData as any).projects || 0} Projects
- With Contacts: ${(businessData as any).accountsWithContacts || 0} have contacts, ${(businessData as any).accountsWithoutContacts || 0} have no contacts
- With Opportunities: ${(businessData as any).accountsWithOpportunities || 0} have opportunities, ${(businessData as any).accountsWithoutOpportunities || 0} have no opportunities
- Total Opportunities: ${(businessData as any).totalOpportunities || 0} across all accounts
- Open Opportunities: ${(businessData as any).openOpportunities || 0}, Value: ${(businessData as any).openOpportunitiesValue || 0}
- Won Opportunities: ${(businessData as any).wonOpportunities || 0}, Value: ${(businessData as any).wonOpportunitiesValue || 0}
- Total Quotations: ${(businessData as any).totalQuotations || 0}, Pending: ${(businessData as any).pendingQuotations || 0}, Accepted: ${(businessData as any).acceptedQuotations || 0}
- Total Invoices: ${(businessData as any).totalInvoices || 0}, Unpaid: ${(businessData as any).unpaidInvoices || 0}, Overdue: ${(businessData as any).overdueInvoices || 0}
- Total Revenue: ${(businessData as any).totalRevenue || 0}
- Active Accounts (30 days): ${(businessData as any).activeAccounts30Days || 0} accounts with activity in last 30 days
- Inactive Accounts (90+ days): ${(businessData as any).inactiveAccounts90Days || 0} accounts with no activity in last 90 days

Use these EXACT numbers in your recommendations. Reference specific counts, account types, opportunity values, and revenue figures when making recommendations.` : page === 'stock' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Stock Metrics:
- Total Products: ${(businessData as any).totalProducts || 0} total, ${(businessData as any).activeProducts || 0} active
- Low Stock Items: ${(businessData as any).lowStockItems || 0} items with quantity ≤ 10
- Out of Stock Items: ${(businessData as any).outOfStockItems || 0} items with quantity = 0
- Total Stock Value (USD): ${(businessData as any).totalStockValue || 0}
- Total Stock Value (GHS): ${(businessData as any).totalStockValueGHS || 0}
- Products with Recent Movement (30 days): ${(businessData as any).productsWithMovement || 0}
- Slow Moving Products (no movement in 30 days): ${(businessData as any).slowMovingProducts || 0}

Use these EXACT numbers in your recommendations. Reference specific counts of low stock items, out of stock items, stock values, and movement patterns when making recommendations.` : page === 'stock-movements' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Stock Movement Metrics:
- Total Movements: ${(businessData as any).totalMovements || 0}
- Movements Last 30 Days: ${(businessData as any).movementsLast30Days || 0}
- Movements Last 7 Days: ${(businessData as any).movementsLast7Days || 0}
- Movement Type Breakdown:
  - Receipts: ${(businessData as any).receiptsCount || 0}
  - Adjustments: ${(businessData as any).adjustmentsCount || 0}
  - Transfers In: ${(businessData as any).transfersInCount || 0}
  - Transfers Out: ${(businessData as any).transfersOutCount || 0}
  - Sales: ${(businessData as any).salesCount || 0}
- Unique Warehouses with Movements: ${(businessData as any).uniqueWarehouses || 0}
- Large Movements (>100 units in last 30 days): ${(businessData as any).largeMovements || 0}
- Movements Without Reference (last 30 days): ${(businessData as any).movementsWithoutReference || 0}

Use these EXACT numbers in your recommendations. Reference specific counts of movements by type, warehouse distribution, large movements, and documentation gaps when making recommendations.` : page === 'backorders' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Backorder Metrics:
- Total Backorders: ${(businessData as any).totalBackorders || 0}
- Status Breakdown:
  - Pending: ${(businessData as any).pendingBackorders || 0}
  - Partially Fulfilled: ${(businessData as any).partiallyFulfilled || 0}
  - Fulfilled: ${(businessData as any).fulfilledBackorders || 0}
- Priority Breakdown:
  - Urgent: ${(businessData as any).urgentBackorders || 0}
  - High Priority: ${(businessData as any).highPriorityBackorders || 0}
- Backorders Created Last 30 Days: ${(businessData as any).backordersLast30Days || 0}
- Total Backorder Value: ${(businessData as any).totalBackorderValue || 0}
- Average Days Pending: ${(businessData as any).averageDaysPending || 0} days
- Unique Products with Backorders: ${(businessData as any).uniqueProducts || 0}

Use these EXACT numbers in your recommendations. Reference specific counts of pending backorders, urgent/high priority orders, backorder value, and fulfillment timelines when making recommendations.` : page === 'warehouses' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Warehouse Metrics:
- Total Warehouses: ${(businessData as any).total || 0}
- Total Stock Quantity: ${(businessData as any).totalStock || 0}
- Total Stock Value: ${(businessData as any).totalValue || 0}

Use these EXACT numbers in your recommendations. Reference specific warehouse counts, stock levels, and valuation when making recommendations.` : page === 'products' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Product Metrics:
- Total Products: ${(businessData as any).totalProducts || 0}
- Active Products: ${(businessData as any).activeProducts || 0}
- Inactive Products: ${(businessData as any).inactiveProducts || 0}
- Products with Stock: ${(businessData as any).productsWithStock || 0}
- Products without Stock: ${(businessData as any).productsWithoutStock || 0}
- Low Stock Products (≤10 units): ${(businessData as any).lowStockProducts || 0}
- Out of Stock Products: ${(businessData as any).outOfStockProducts || 0}
- Products with Pricing: ${(businessData as any).productsWithPrice || 0}
- Products without Pricing: ${(businessData as any).productsWithoutPrice || 0}
- Total Categories: ${(businessData as any).totalCategories || 0}
- Product Type Breakdown: ${JSON.stringify((businessData as any).productTypeBreakdown || {})}
- New Products Last 30 Days: ${(businessData as any).newProductsLast30Days || 0}
- New Products Last 7 Days: ${(businessData as any).newProductsLast7Days || 0}
- Products with Recent Movements (30 days): ${(businessData as any).productsWithMovements || 0}
- Total Stock Value (USD): ${(businessData as any).totalStockValue || 0}
- Total Stock Value (GHS): ${(businessData as any).totalStockValueGHS || 0}

Use these EXACT numbers in your recommendations. Reference specific counts of low stock products, out of stock products, pricing gaps, product types, and stock values when making recommendations.` : page === 'invoices' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Invoice Metrics:
- Total Invoices: ${(businessData as any).totalInvoices || 0}
- Status Breakdown:
  - Draft: ${(businessData as any).draftInvoices || 0}
  - Sent: ${(businessData as any).sentInvoices || 0}
  - Overdue: ${(businessData as any).overdueInvoices || 0}
- Payment Status Breakdown:
  - Paid: ${(businessData as any).paidInvoices || 0}
  - Unpaid: ${(businessData as any).unpaidInvoices || 0}
  - Partially Paid: ${(businessData as any).partiallyPaidInvoices || 0}
- Invoices Created Last 30 Days: ${(businessData as any).invoicesLast30Days || 0}
- Invoices Created This Month: ${(businessData as any).invoicesThisMonth || 0}
- Total Invoice Value: ${(businessData as any).totalInvoiceValue || 0}
- Overdue Amount: ${(businessData as any).overdueAmount || 0}
- Paid This Month: ${(businessData as any).paidThisMonth || 0}
- Unpaid Amount: ${(businessData as any).unpaidAmount || 0}
- Average Days Overdue: ${(businessData as any).averageDaysOverdue || 0} days

Use these EXACT numbers in your recommendations. Reference specific counts of overdue invoices, unpaid amounts, payment statuses, and cash flow metrics when making recommendations.` : page === 'quotations' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Quotation Metrics:
- Total Quotations: ${(businessData as any).totalQuotations || 0}
- Status Breakdown:
  - Draft: ${(businessData as any).draftQuotations || 0}
  - Sent: ${(businessData as any).sentQuotations || 0}
  - Accepted: ${(businessData as any).acceptedQuotations || 0}
  - Rejected: ${(businessData as any).rejectedQuotations || 0}
  - Expired: ${(businessData as any).expiredQuotations || 0}
- Quotations Created Last 30 Days: ${(businessData as any).quotationsLast30Days || 0}
- Quotations Created This Month: ${(businessData as any).quotationsThisMonth || 0}
- Total Quotation Value: ${(businessData as any).totalQuotationValue || 0}
- Accepted Value: ${(businessData as any).acceptedValue || 0}
- Pending Value: ${(businessData as any).pendingValue || 0}
- Quotations Needing Follow-up (>3 days old): ${(businessData as any).quotationsNeedingFollowUp || 0}
- Conversion Rate: ${(businessData as any).conversionRate || 0}%

Use these EXACT numbers in your recommendations. Reference specific counts of sent quotations, accepted quotations, conversion rates, pending values, and follow-up needs when making recommendations.` : page === 'orders' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Order Metrics:
- Total Orders: ${(businessData as any).totalOrders || 0}
- Status Breakdown:
  - Pending: ${(businessData as any).pendingOrders || 0}
  - Confirmed: ${(businessData as any).confirmedOrders || 0}
  - Processing: ${(businessData as any).processingOrders || 0}
  - Shipped: ${(businessData as any).shippedOrders || 0}
  - Delivered: ${(businessData as any).deliveredOrders || 0}
  - Cancelled: ${(businessData as any).cancelledOrders || 0}
  - Returned: ${(businessData as any).returnedOrders || 0}
- Orders Created Last 30 Days: ${(businessData as any).ordersLast30Days || 0}
- Orders Created This Month: ${(businessData as any).ordersThisMonth || 0}
- Total Order Value: ${(businessData as any).totalOrderValue || 0}
- Pending Orders Value: ${(businessData as any).pendingValue || 0}
- Processing Orders Value: ${(businessData as any).processingValue || 0}
- Delivered Orders Value: ${(businessData as any).deliveredValue || 0}
- Average Processing Time: ${(businessData as any).averageProcessingDays || 0} days

Use these EXACT numbers in your recommendations. Reference specific counts of pending orders, processing orders, delivery efficiency, and order status optimization when making recommendations.` : page === 'ecommerce-orders' ? `
CRITICAL: Use ONLY the actual ecommerce metrics provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Ecommerce Order Metrics:
- Total Ecommerce Orders: ${(businessData as any).totalOrders || 0}
- Status Breakdown:
  - Pending: ${(businessData as any).pendingOrders || 0}
  - Confirmed: ${(businessData as any).confirmedOrders || 0}
  - Processing: ${(businessData as any).processingOrders || 0}
  - Ready to Ship: ${(businessData as any).readyToShipOrders || 0}
  - Shipped: ${(businessData as any).shippedOrders || 0}
  - Delivered: ${(businessData as any).deliveredOrders || 0}
  - Completed: ${(businessData as any).completedOrders || 0}
  - Cancelled: ${(businessData as any).cancelledOrders || 0}
- Recent Volume: ${(businessData as any).ordersLast7Days || 0} in last 7 days, ${(businessData as any).ordersLast30Days || 0} in last 30 days, ${(businessData as any).ordersThisMonth || 0} this month, ${(businessData as any).todaysOrders || 0} today
- Fulfillment Value: Ready-to-Ship ${currencySymbol}${Number((businessData as any).readyToShipValue || 0).toFixed(2)}, In Transit ${currencySymbol}${Number((businessData as any).inTransitValue || 0).toFixed(2)}, Delivered ${currencySymbol}${Number((businessData as any).deliveredValue || 0).toFixed(2)}
- COD Snapshot: Outstanding ${currencySymbol}${Number((businessData as any).outstandingCodValue || 0).toFixed(2)}, Collected ${currencySymbol}${Number((businessData as any).collectedCodValue || 0).toFixed(2)}, Delivered but Unpaid ${(businessData as any).deliveredButUnpaid || 0} orders
- Overdue COD: ${(businessData as any).overdueCODCount || 0} orders worth ${currencySymbol}${Number((businessData as any).overdueCODValue || 0).toFixed(2)}
- Fulfillment Timing: Average fulfillment ${(businessData as any).averageFulfillmentHours || 0} hours, Oldest ready-to-ship ${(businessData as any).readyToShipOldestHours || 0} hours, Oldest processing ${(businessData as any).processingOldestHours || 0} hours

Use these EXACT numbers in your recommendations. Reference specific counts of ready-to-ship orders, shipped orders, delivered-but-unpaid orders, outstanding COD value, overdue CODs, and fulfillment timing when making recommendations.` : page === 'payments' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Payment Metrics:
- Total Payments: ${(businessData as any).totalPayments || 0}
- Payments Last 30 Days: ${(businessData as any).paymentsLast30Days || 0}
- Payments This Month: ${(businessData as any).paymentsThisMonth || 0}
- Payments Last Month: ${(businessData as any).paymentsLastMonth || 0}
- Total Payment Amount: ${(businessData as any).totalPaymentAmount || 0}
- This Month Amount: ${(businessData as any).thisMonthAmount || 0}
- Last Month Amount: ${(businessData as any).lastMonthAmount || 0}
- Average Payment Amount: ${(businessData as any).averagePaymentAmount || 0}
- Unpaid Invoices: ${(businessData as any).unpaidInvoices || 0}
- Overdue Invoices: ${(businessData as any).overdueInvoices || 0}
- Overdue Amount: ${(businessData as any).overdueAmount || 0}

Use these EXACT numbers in your recommendations. Reference specific payment amounts, collection rates, outstanding invoices, and cash flow patterns when making recommendations.` : page === 'returns' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Return Metrics:
- Total Returns: ${(businessData as any).totalReturns || 0}
- Status Breakdown:
  - Pending: ${(businessData as any).pendingReturns || 0}
  - Approved: ${(businessData as any).approvedReturns || 0}
  - Completed: ${(businessData as any).completedReturns || 0}
  - Rejected: ${(businessData as any).rejectedReturns || 0}
- Returns Last 30 Days: ${(businessData as any).returnsLast30Days || 0}
- Returns This Month: ${(businessData as any).returnsThisMonth || 0}
- Total Return Value: ${(businessData as any).totalReturnValue || 0}
- Pending Returns Value: ${(businessData as any).pendingValue || 0}
- Refunded Amount: ${(businessData as any).refundedValue || 0}
- Average Processing Time: ${(businessData as any).averageProcessingDays || 0} days

Use these EXACT numbers in your recommendations. Reference specific return rates, processing times, return reasons, and prevention strategies when making recommendations.` : page === 'projects' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Project Metrics:
- Total Projects: ${(businessData as any).total || 0}
- Status Breakdown:
  - Active: ${(businessData as any).activeProjects || 0}
  - On Hold: ${(businessData as any).onHoldProjects || 0}
  - Completed: ${(businessData as any).completedProjects || 0}
  - Cancelled: ${(businessData as any).cancelledProjects || 0}
  - Draft: ${(businessData as any).draftProjects || 0}
- Deadlines:
  - Upcoming (within 14 days): ${(businessData as any).upcomingDeadlines || 0}
  - Overdue: ${(businessData as any).overdueProjects || 0}
- Tasks:
  - Total Tasks: ${(businessData as any).totalTasks || 0}
  - Completed: ${(businessData as any).completedTasks || 0}
  - Pending/In Progress: ${(businessData as any).pendingTasks || 0}
  - Overdue: ${(businessData as any).overdueTasks || 0}
- Incidents:
  - Total Incidents: ${(businessData as any).totalIncidents || 0}
  - Open: ${(businessData as any).openIncidents || 0}
  - High/Critical Severity: ${(businessData as any).highSeverityIncidents || 0}
  - Overdue: ${(businessData as any).overdueIncidents || 0}
- Resource Requests: ${(businessData as any).totalResourceRequests || 0} total
- Project Health:
  - Projects without members: ${(businessData as any).projectsWithoutMembers || 0}
  - Projects without tasks: ${(businessData as any).projectsWithoutTasks || 0}
  - Projects with overdue tasks: ${(businessData as any).projectsWithOverdueTasks || 0}
  - Projects with high severity incidents: ${(businessData as any).projectsWithHighSeverityIncidents || 0}
- Recent Activity:
  - New projects (last 7 days): ${(businessData as any).newProjectsLast7Days || 0}
  - New projects (last 30 days): ${(businessData as any).newProjectsLast30Days || 0}

Use these EXACT numbers in your recommendations. Reference specific counts of overdue projects, overdue tasks, open incidents, projects at risk, and resource needs when making recommendations.` : page === 'tasks' ? `
CRITICAL: Use ONLY the actual numbers provided below. Do NOT invent or estimate numbers. If a metric is missing or zero, acknowledge it in your recommendation.

Current Task Metrics:
- Total Tasks: ${(businessData as any).total || 0}
- Status Breakdown:
  - Completed: ${(businessData as any).completed || 0}
  - Pending: ${(businessData as any).pending || 0}
  - In Progress: ${(businessData as any).inProgress || 0}
  - Overdue: ${(businessData as any).overdue || 0}
  - Cancelled: ${(businessData as any).cancelled || 0}
- Priority Breakdown:
  - Urgent: ${(businessData as any).urgentTasks || 0}
  - High Priority: ${(businessData as any).highPriorityTasks || 0}
- Tasks with Due Dates: ${(businessData as any).tasksWithDueDates || 0}
- Tasks without Due Dates: ${(businessData as any).tasksWithoutDueDates || 0}
- Tasks Due Soon (within 3 days): ${(businessData as any).tasksDueSoon || 0}
- Overdue High Priority Tasks: ${(businessData as any).overdueHighPriority || 0}
- Completion Rate: ${(businessData as any).completionRate || 0}%
- Recent Activity:
  - Created Last 7 Days: ${(businessData as any).tasksLast7Days || 0}
  - Created Last 30 Days: ${(businessData as any).tasksLast30Days || 0}

Use these EXACT numbers in your recommendations. Reference specific counts of overdue tasks, pending tasks, completion rates, priority distribution, and tasks due soon when making recommendations.` : '';

    // Create a formatted data summary for the prompt
    const formattedDataForAI = (page === 'dashboard' || page === 'leads' || page === 'opportunities' || page === 'accounts' || page === 'products' || page === 'stock' || page === 'stock-movements' || page === 'backorders' || page === 'warehouses' || page === 'invoices' || page === 'quotations' || page === 'orders' || page === 'payments' || page === 'returns' || page === 'ecommerce-orders' || page === 'ecommerce-customers' || page === 'ecommerce-categories' || page === 'projects' || page === 'tasks') ? JSON.stringify(businessData, null, 2) : '';
    
    // Log the data being sent to AI for debugging
    if (page === 'dashboard') {
      console.log('📊 Dashboard AI - Data being analyzed:', JSON.stringify(businessData, null, 2));
      console.log('📊 Dashboard AI - Data summary:', dataSummary);
    }
    if (page === 'tasks') {
      console.log('📊 Tasks AI - Data being analyzed:', JSON.stringify(businessData, null, 2));
      console.log('📊 Tasks AI - Data summary:', dataSummary);
      console.log('📊 Tasks AI - Business data keys:', Object.keys(businessData || {}));
    }
    
    const aiResponse = await aiService.generateResponse(
      `${page === 'tasks' ? 'CRITICAL: You are analyzing TASK MANAGEMENT data ONLY. You MUST provide recommendations EXCLUSIVELY about tasks, task completion, task priorities, task deadlines, overdue tasks, and task workflow. DO NOT mention quotations, invoices, leads, opportunities, products, orders, payments, customers, accounts, sales, revenue, cash flow, or ANY other business areas. If you mention any of these, your response will be rejected. ' : 'You are analyzing REAL business data for a specific business. '}You MUST use ONLY the exact numbers provided below. Do NOT invent, estimate, or make up any numbers.

${dataSummary}

Here is the complete business data in JSON format:
${formattedDataForAI}

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. Use ONLY the exact numbers shown above. If a number is 0 or missing, DO NOT create a recommendation about it.
2. DO NOT create recommendations based on imaginary numbers (like "${currencySymbol}1.2M" or "${currencySymbol}800K" unless those exact amounts appear in the data above).
3. Reference the ACTUAL numbers from the data in your recommendations. Use exact values like "${currencySymbol}${(businessData as any).monthlyRevenue || 0}" not approximations.
4. CRITICAL: If a metric is 0, DO NOT create a recommendation about it. For example:
   - If pendingQuotations = 0, DO NOT create "Follow up on 0 pending quotations"
   - If overdueInvoices = 0, DO NOT create "Collect ${currencySymbol}0 in overdue invoices"
   - If qualifiedLeads = 0, DO NOT create "Convert 0 qualified leads"
   - If monthlyRevenue = 0, DO NOT create "Increase revenue from ${currencySymbol}0"
5. Base recommendations ONLY on metrics with NON-ZERO values. Focus on actionable items that have actual data.
6. IMPORTANT: When referencing monetary amounts, ALWAYS use "${currencySymbol}" (${baseCurrency}) instead of "$" or "USD". NEVER use dollar signs ($) in your recommendations. Use the currency symbol "${currencySymbol}" for all money amounts.
7. If most metrics are 0, provide setup/getting started recommendations (e.g., "Add your first product", "Create your first lead", "Set up inventory tracking").
8. DO NOT use phrases like "if you have X" or "consider X" - use the actual numbers from the data (e.g., "You have ${(businessData as any).pendingQuotations || 0} pending quotations that need follow-up").

Based on the EXACT numbers provided above, provide ${recommendationCount} specific, actionable recommendations. Each recommendation should:
1. Use ONLY real numbers from the data above
2. Have a clear, descriptive title (max 6 words) - DO NOT use generic titles like "AI Insight 1", "Recommendation 1", or numbered placeholders. ${page === 'tasks' ? 'Use actual action-oriented titles about TASKS ONLY like "Complete 1 overdue task" or "Set due dates for tasks" or "Improve task completion rate". DO NOT use titles about quotations, invoices, leads, or other business areas.' : 'Use actual action-oriented titles like "Follow up on 5 pending quotations" or "Collect GH₵12,500 in overdue invoices"'}
3. Include a description that references the ACTUAL counts/amounts from the data (max 80 words)
4. Have a priority level (high/medium/low)
5. Include a suggested action (max 12 words)

CRITICAL: Each title must be unique, descriptive, and action-oriented. Never use placeholder titles like "AI Insight 1", "Recommendation 1", "Insight 1", etc. Use actual business actions in the title.

${isSpecificLead ? 'Focus on SPECIFIC actions for THIS PARTICULAR LEAD. Provide recommendations tailored to their status, stage, and activity. Consider next steps like follow-ups, qualification, product demonstrations, or conversion to opportunity.' : isSpecificOpportunity ? 'Focus on SPECIFIC actions for THIS PARTICULAR OPPORTUNITY. Provide recommendations to progress this deal, address blockers, improve probability, or close the opportunity. Consider quotations, negotiations, or closing strategies.' : isSpecificAccount ? 'Focus on SPECIFIC actions for THIS PARTICULAR ACCOUNT. Provide recommendations to strengthen the relationship, grow revenue, develop opportunities, or optimize account engagement. Consider contact management, opportunity development, or revenue optimization.' : page === 'dashboard' ? 'Focus on HIGH-IMPACT actions that will move the needle based on the REAL data provided. CRITICAL: Only create recommendations for metrics with NON-ZERO values. If a metric is 0, skip it entirely. Prioritize actions based on actual numbers - if there are unpaid invoices, mention the exact count. If there are open opportunities, use the actual count. If most metrics are 0, provide setup/getting started recommendations instead.' : page === 'tasks' ? 'CRITICAL: Focus EXCLUSIVELY on TASK MANAGEMENT. Provide recommendations ONLY about tasks, task completion, task priorities, task deadlines, overdue tasks, and task workflow. Do NOT mention quotations, invoices, leads, opportunities, products, or any other business areas. Base all recommendations on the task metrics provided above.' : ''}
${!isSpecificLead && !isSpecificOpportunity && !isSpecificAccount && page === 'leads' ? 'Focus on lead conversion optimization, follow-up strategies, and pipeline management based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of stale leads, unassigned leads, overdue follow-ups, etc. Reference specific conversion rates and deal values from the data.' : ''}
${!isSpecificLead && !isSpecificOpportunity && !isSpecificAccount && page === 'opportunities' ? 'Focus on opportunity pipeline optimization, deal progression, and win rate improvement based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of stuck opportunities, overdue close dates, high-value deals, etc. Reference specific pipeline values, win rates, and probability distributions from the data.' : ''}
${!isSpecificLead && !isSpecificOpportunity && !isSpecificAccount && page === 'accounts' ? 'Focus on account engagement, relationship management, and revenue growth based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of inactive accounts, accounts without contacts, high-value opportunities, etc. Reference specific revenue figures, opportunity values, and engagement metrics from the data.' : ''}
${page === 'stock' ? 'Focus on stock optimization, reorder management, and inventory efficiency based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of low stock items, out of stock items, slow-moving products, etc. Reference specific stock values and movement patterns from the data.' : ''}
${page === 'stock-movements' ? 'Focus on stock movement efficiency, documentation, and warehouse operations based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of movements by type, large movements, missing references, etc. Reference specific movement patterns and warehouse distribution from the data.' : ''}
${page === 'backorders' ? 'Focus on backorder fulfillment, priority management, and stock replenishment based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of pending backorders, urgent orders, average fulfillment time, etc. Reference specific backorder values and product distribution from the data.' : ''}
${page === 'warehouses' ? 'Focus on warehouse optimization, stock distribution, and operational efficiency based on the REAL data provided. Prioritize actions based on actual warehouse counts, stock levels, and valuation. Reference specific numbers from the data.' : ''}
${page === 'products' ? 'Focus on product management, inventory optimization, pricing strategy, and catalog management based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of low stock products, out of stock products, products without pricing, inactive products, etc. Reference specific product types, categories, stock values, and movement patterns from the data.' : ''}
${page === 'invoices' ? 'Focus on invoice management, payment collection, cash flow optimization, and overdue reduction based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of overdue invoices, unpaid amounts, average days overdue, etc. Reference specific payment statuses, cash flow metrics, and collection opportunities from the data.' : ''}
${page === 'quotations' ? 'Focus on quotation management, conversion optimization, follow-up effectiveness, and sales process improvement based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of sent quotations, accepted quotations, conversion rates, pending values, quotations needing follow-up, etc. Reference specific status breakdowns, conversion metrics, and sales pipeline data.' : ''}
${page === 'orders' ? 'Focus on order fulfillment, processing efficiency, delivery optimization, and status management based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of pending orders, processing orders, average processing time, delivery efficiency, etc. Reference specific order statuses, fulfillment rates, and processing metrics from the data.' : ''}
${page === 'ecommerce-orders' ? 'Focus on ecommerce fulfillment, rider scheduling, and COD reconciliation using the REAL metrics provided. Reference specific counts of ready-to-ship orders, shipped orders, delivered-but-unpaid orders, outstanding COD amounts, overdue COD invoices, and average fulfillment times. Recommend concrete next steps for ops and finance coordination (e.g., batching deliveries, chasing COD balances, updating customer communication).' : ''}
${page === 'payments' ? 'Focus on payment collection, cash flow optimization, outstanding invoice management, and payment method analysis based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of overdue invoices, unpaid amounts, payment trends, collection rates, etc. Reference specific payment amounts, methods, and cash flow patterns from the data.' : ''}
${page === 'returns' ? 'Focus on return reduction, processing efficiency, reason analysis, and prevention strategies based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of pending returns, return rates, processing times, top return reasons, etc. Reference specific return statuses, reasons, and processing metrics from the data.' : ''}
${page === 'projects' ? 'Focus on project delivery, deadline management, task completion, incident resolution, and resource allocation based on the REAL data provided. Prioritize actions based on actual counts - mention exact numbers of overdue projects, overdue tasks, open incidents, projects at risk, resource needs, etc. Reference specific project statuses, task completion rates, incident severity, and deadline metrics from the data.' : ''}
${page === 'tasks' ? 'CRITICAL: You are analyzing TASK MANAGEMENT data ONLY. Provide recommendations EXCLUSIVELY about tasks, task completion, task priorities, task deadlines, overdue tasks, and task workflow. Do NOT mention quotations, invoices, leads, opportunities, products, or any other business areas. Base all recommendations on the task metrics provided above. Mention exact numbers of overdue tasks, pending tasks, tasks due soon, high priority tasks, completion rates, etc. Reference specific task statuses, priority distribution, completion metrics, and deadline adherence from the task data.' : ''}

${page === 'tasks' ? 'CRITICAL REMINDER: You are analyzing TASK MANAGEMENT data ONLY. Every recommendation MUST be about tasks. DO NOT create recommendations about quotations, invoices, leads, opportunities, products, or any other business areas. If the data shows task metrics, create recommendations about those tasks. Examples of VALID task recommendations: "Complete 1 overdue task", "Set due dates for tasks", "Prioritize high priority tasks", "Improve task completion rate". Examples of INVALID recommendations (DO NOT CREATE THESE): "Follow up on quotations", "Collect overdue invoices", "Contact leads". ' : ''}

Format your response as a JSON array:
[
  {
    "title": "Use actual data numbers",
    "description": "Reference the exact counts and amounts from the data above",
          "priority": "high|medium|low",
    "action": "Specific action to take"
        }
      ]`,
      businessData,
      [],
      pagePrompt
    );

    // Parse AI response
    let recommendations = [];
    try {
      // Try multiple methods to extract JSON from the response
      let parsedJson = null;
      
      // Method 1: Try to find JSON array directly
      const jsonMatch = aiResponse.text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          parsedJson = JSON.parse(jsonMatch[0]);
        } catch (e) {
          // Continue to next method
        }
      }
      
      // Method 2: Try to extract JSON between code blocks
      if (!parsedJson) {
        const codeBlockMatch = aiResponse.text.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
        if (codeBlockMatch) {
          try {
            parsedJson = JSON.parse(codeBlockMatch[1]);
          } catch (e) {
            // Continue to next method
          }
        }
      }
      
      // Method 3: Try to find any JSON-like structure
      if (!parsedJson) {
        const anyJsonMatch = aiResponse.text.match(/\{[\s\S]*"title"[\s\S]*\}/);
        if (anyJsonMatch) {
          // Try to extract multiple objects
          const objectsMatch = aiResponse.text.match(/\{[\s\S]*?\}/g);
          if (objectsMatch) {
            try {
              parsedJson = objectsMatch.map(obj => {
                try {
                  return JSON.parse(obj);
                } catch (e) {
                  return null;
                }
              }).filter(obj => obj && obj.title);
            } catch (e) {
              // Continue to fallback
            }
          }
        }
      }
      
      if (parsedJson && Array.isArray(parsedJson) && parsedJson.length > 0) {
        recommendations = parsedJson;
        console.log(`✅ Successfully parsed ${recommendations.length} recommendations from AI response`);
      } else {
        // Fallback: create recommendations from text
        console.log('⚠️ JSON parsing failed, using text extraction fallback');
        recommendations = createFallbackRecommendations(aiResponse.text);
      }
    } catch (error) {
      console.error('Error parsing AI recommendations:', error);
      console.log('⚠️ Exception occurred, using text extraction fallback');
      recommendations = createFallbackRecommendations(aiResponse.text);
    }

    // Ensure we have the required number of recommendations
    const targetCount = recommendationCount;
    if (recommendations.length < targetCount) {
      recommendations = recommendations.concat(createDefaultRecommendations(page, targetCount - recommendations.length));
    }

    // Add IDs and format for the component
    // Also replace any dollar signs with the correct currency symbol
    // Filter out any recommendations with placeholder titles
    // For dashboard, filter out recommendations with zero values
    // For tasks page, also filter out recommendations that mention non-task items
    const validRecommendations = recommendations.filter((rec: any) => {
      const title = (rec.title || '').trim();
      const description = (rec.description || '').trim().toLowerCase();
      
      // Reject placeholder titles
      if (!title || title.match(/^(ai\s+)?insight\s*\d+$/i) || title.match(/^recommendation\s*\d+$/i) || title.match(/^insight\s*\d+$/i)) {
        console.log(`⚠️ Filtered out recommendation with placeholder title: "${title}"`);
        return false;
      }
      
      // For dashboard, filter out recommendations with zero values
      if (page === 'dashboard') {
        // Check for patterns like "0 pending quotations", "GH₵0", "0 qualified leads", etc.
        const zeroPatterns = [
          /\b0\s+(pending|overdue|qualified|new|won|open)\s+/i,
          /\bgh[₵¢]?\s*0\b/i,
          /\bghc\s*0\b/i, // Also catch "GHC0" without special character
          /\b0\s+(quotation|invoice|lead|opportunity|product|customer|account)/i,
          /from\s+gh[₵¢c]?\s*0\s+to/i,
          /collect\s+gh[₵¢c]?\s*0/i,
          /follow\s+up\s+on\s+0/i,
          /convert\s+0\s+/i,
          /win\s+0\s+/i,
          /increase.*from.*0/i,
          /there\s+are\s+currently\s+0/i,
          /there\s+have\s+been\s+0/i,
          /there\s+are\s+0/i,
          /currently\s+0/i,
          /have\s+0/i,
          /with\s+0/i,
        ];
        
        const titleLower = title.toLowerCase();
        const descLower = description.toLowerCase();
        
        const hasZeroValue = zeroPatterns.some(pattern => 
          pattern.test(titleLower) || pattern.test(descLower)
        ) || 
        // Also check for explicit "0" followed by common action words
        (titleLower.match(/\b0\b/) && (
          titleLower.includes('follow up') ||
          titleLower.includes('collect') ||
          titleLower.includes('convert') ||
          titleLower.includes('win') ||
          titleLower.includes('increase')
        ));
        
        if (hasZeroValue) {
          console.log(`⚠️ Filtered out zero-value recommendation for dashboard: "${title}"`);
          return false;
        }
      }
      
      // For tasks page, reject recommendations that mention non-task items
      if (page === 'tasks') {
        const titleLower = title.toLowerCase();
        const descLower = description.toLowerCase();
        const nonTaskKeywords = ['quotation', 'invoice', 'lead', 'opportunity', 'product', 'order', 'payment', 'customer', 'account', 'sales', 'revenue', 'cash flow', 'collect', 'follow up on', 'gh₵', 'gh¢', 'cedi', 'prospect', 'deal', 'pipeline', 'pending quotation', 'overdue invoice', 'new lead'];
        const hasNonTaskKeyword = nonTaskKeywords.some(keyword => 
          titleLower.includes(keyword) || descLower.includes(keyword)
        );
        if (hasNonTaskKeyword) {
          console.log(`⚠️ Filtered out non-task recommendation for tasks page: "${title}"`);
          return false;
        }
        // Also check for patterns like "Follow up on X" or "Collect X" which are typically non-task
        if (titleLower.match(/^(follow up on|collect|contact|call|send).*(quotation|invoice|lead|opportunity|product|order|payment|customer|account|prospect|deal)/i)) {
          console.log(`⚠️ Filtered out non-task pattern for tasks page: "${title}"`);
          return false;
        }
      }
      
      return true;
    });
    
    // If we filtered out too many, use default recommendations
    if (validRecommendations.length < recommendationCount) {
      console.log(`⚠️ Only ${validRecommendations.length} valid recommendations, using defaults for remaining`);
      const defaults = createDefaultRecommendations(page, recommendationCount - validRecommendations.length);
      // For tasks page, ensure defaults are also task-specific
      if (page === 'tasks') {
        const taskDefaults = defaults.filter((rec: any) => {
          const titleLower = (rec.title || '').toLowerCase();
          const descLower = (rec.description || '').toLowerCase();
          const nonTaskKeywords = ['quotation', 'invoice', 'lead', 'opportunity', 'product', 'order', 'payment'];
          return !nonTaskKeywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword));
        });
        validRecommendations.push(...taskDefaults);
      } else if (page === 'dashboard') {
        // For dashboard, filter defaults to only include setup/getting started recommendations if data is empty
        // Check if business data suggests the system is new/empty
        const hasData = (businessData as any).totalProducts > 0 || 
                       (businessData as any).totalLeads > 0 || 
                       (businessData as any).totalOpportunities > 0 || 
                       (businessData as any).totalQuotations > 0 || 
                       (businessData as any).totalInvoices > 0;
        
        if (!hasData) {
          // System is new/empty - use setup recommendations
          const setupDefaults = [
            { title: 'Add your first product', description: 'Start by adding products to your catalog to begin selling', priority: 'high', action: 'Create product' },
            { title: 'Create your first lead', description: 'Begin building your sales pipeline by adding leads', priority: 'high', action: 'Add lead' },
            { title: 'Set up inventory tracking', description: 'Configure warehouses and stock levels for inventory management', priority: 'medium', action: 'Setup inventory' },
            { title: 'Configure pricing strategy', description: 'Set up price lists and pricing rules for your products', priority: 'medium', action: 'Setup pricing' },
            { title: 'Add customer accounts', description: 'Start building your customer database by adding accounts', priority: 'low', action: 'Add account' }
          ];
          validRecommendations.push(...setupDefaults.slice(0, recommendationCount - validRecommendations.length));
        } else {
          // Has some data - use regular defaults but filter out zero-value ones
          const filteredDefaults = defaults.filter((rec: any) => {
            const title = (rec.title || '').toLowerCase();
            // Don't include defaults that might reference zero values
            return !title.includes('0') && !title.match(/\bgh[₵¢]?\s*0\b/i);
          });
          validRecommendations.push(...filteredDefaults.slice(0, recommendationCount - validRecommendations.length));
        }
      } else {
        validRecommendations.push(...defaults);
      }
    }
    
    // Final validation for tasks page - filter again before formatting
    let finalRecommendations = validRecommendations.slice(0, targetCount);
    if (page === 'tasks') {
      finalRecommendations = finalRecommendations.filter((rec: any) => {
        const title = (rec.title || '').toLowerCase();
        const description = (rec.description || '').toLowerCase();
        const nonTaskKeywords = ['quotation', 'invoice', 'lead', 'opportunity', 'product', 'order', 'payment', 'collect', 'follow up on', 'gh₵', 'gh¢', 'prospect', 'deal', 'pending quotation', 'overdue invoice', 'new lead'];
        const hasNonTaskKeyword = nonTaskKeywords.some(keyword => 
          title.includes(keyword) || description.includes(keyword)
        );
        if (hasNonTaskKeyword) {
          console.log(`⚠️ Final filter: Removed non-task recommendation: "${rec.title}"`);
          return false;
        }
        // Check for patterns
        if (title.match(/^(follow up on|collect|contact|call|send).*(quotation|invoice|lead|opportunity|product|order|payment|customer|account|prospect|deal)/i)) {
          console.log(`⚠️ Final filter: Removed non-task pattern: "${rec.title}"`);
          return false;
        }
        return true;
      });
      
      // If we filtered out too many, add task-specific defaults
      if (finalRecommendations.length < recommendationCount) {
        const taskDefaults = createDefaultRecommendations('tasks', recommendationCount - finalRecommendations.length);
        finalRecommendations.push(...taskDefaults);
      }
    }
    
    let formattedRecommendations = finalRecommendations.map((rec: any, index: number) => {
      // Replace dollar signs and USD references with the correct currency symbol
      const replaceCurrency = (text: string) => {
        if (!text) return text;
        // Replace $ with currency symbol (preserve spacing)
        text = text.replace(/\$/g, currencySymbol);
        // Replace USD with base currency code
        text = text.replace(/USD/gi, baseCurrency);
        return text;
      };

      return {
      id: `${page}-${index + 1}`,
        title: replaceCurrency(rec.title || `Recommendation ${index + 1}`),
        description: replaceCurrency(rec.description || 'AI-generated recommendation'),
      priority: rec.priority || 'medium',
        action: replaceCurrency(rec.action || 'Take action'),
      completed: false
      };
    });
    
    // Final post-formatting filter for dashboard - remove zero-value recommendations
    if (page === 'dashboard') {
      formattedRecommendations = formattedRecommendations.filter((rec: any) => {
        const title = (rec.title || '').toLowerCase();
        const description = (rec.description || '').toLowerCase();
        
        const zeroPatterns = [
          /\b0\s+(pending|overdue|qualified|new|won|open)\s+/i,
          /\bgh[₵¢c]?\s*0\b/i,
          /\b0\s+(quotation|invoice|lead|opportunity|product|customer|account)/i,
          /from\s+gh[₵¢c]?\s*0\s+to/i,
          /collect\s+gh[₵¢c]?\s*0/i,
          /follow\s+up\s+on\s+0/i,
          /convert\s+0\s+/i,
          /win\s+0\s+/i,
          /increase.*from.*0/i,
          /there\s+are\s+currently\s+0/i,
          /there\s+have\s+been\s+0/i,
        ];
        
        const hasZeroValue = zeroPatterns.some(pattern => 
          pattern.test(title) || pattern.test(description)
        ) || 
        (title.match(/\b0\b/) && (
          title.includes('follow up') ||
          title.includes('collect') ||
          title.includes('convert') ||
          title.includes('win') ||
          title.includes('increase')
        ));
        
        if (hasZeroValue) {
          console.log(`⚠️ Post-formatting dashboard filter: Removed zero-value recommendation: "${rec.title}"`);
          return false;
        }
        return true;
      });
      
      // If we filtered out too many, add setup recommendations if system is empty
      if (formattedRecommendations.length < recommendationCount) {
        const hasData = (businessData as any).totalProducts > 0 || 
                       (businessData as any).totalLeads > 0 || 
                       (businessData as any).totalOpportunities > 0 || 
                       (businessData as any).totalQuotations > 0 || 
                       (businessData as any).totalInvoices > 0;
        
        if (!hasData) {
          console.log(`⚠️ Post-formatting: System appears empty, adding setup recommendations`);
          const setupDefaults = [
            { id: `${page}-setup-1`, title: 'Add your first product', description: 'Start by adding products to your catalog to begin selling', priority: 'high', action: 'Create product', completed: false },
            { id: `${page}-setup-2`, title: 'Create your first lead', description: 'Begin building your sales pipeline by adding leads', priority: 'high', action: 'Add lead', completed: false },
            { id: `${page}-setup-3`, title: 'Set up inventory tracking', description: 'Configure warehouses and stock levels for inventory management', priority: 'medium', action: 'Setup inventory', completed: false },
            { id: `${page}-setup-4`, title: 'Configure pricing strategy', description: 'Set up price lists and pricing rules for your products', priority: 'medium', action: 'Setup pricing', completed: false },
            { id: `${page}-setup-5`, title: 'Add customer accounts', description: 'Start building your customer database by adding accounts', priority: 'low', action: 'Add account', completed: false }
          ];
          formattedRecommendations.push(...setupDefaults.slice(0, recommendationCount - formattedRecommendations.length));
        }
      }
    }
    
    // Final post-formatting filter for tasks page (catch any that slipped through)
    if (page === 'tasks') {
      formattedRecommendations = formattedRecommendations.filter((rec: any) => {
        const title = (rec.title || '').toLowerCase();
        const description = (rec.description || '').toLowerCase();
        const nonTaskKeywords = ['quotation', 'invoice', 'lead', 'opportunity', 'product', 'order', 'payment', 'collect', 'follow up on', 'gh₵', 'gh¢', 'prospect', 'deal', 'pending quotation', 'overdue invoice', 'new lead', 'contact', 'call', 'send'];
        const hasNonTaskKeyword = nonTaskKeywords.some(keyword => 
          title.includes(keyword) || description.includes(keyword)
        );
        if (hasNonTaskKeyword) {
          console.log(`⚠️ Post-formatting filter: Removed non-task recommendation: "${rec.title}"`);
          return false;
        }
        // Check for patterns
        if (title.match(/^(follow up on|collect|contact|call|send).*(quotation|invoice|lead|opportunity|product|order|payment|customer|account|prospect|deal)/i)) {
          console.log(`⚠️ Post-formatting filter: Removed non-task pattern: "${rec.title}"`);
          return false;
        }
        return true;
      });
      
      // If we filtered out too many, add task-specific defaults
      if (formattedRecommendations.length < recommendationCount) {
        console.log(`⚠️ Post-formatting: Only ${formattedRecommendations.length} task recommendations, adding task defaults`);
        const taskDefaults = createDefaultRecommendations('tasks', recommendationCount - formattedRecommendations.length).map((rec: any, index: number) => ({
          id: `${page}-default-${index + 1}`,
          title: rec.title,
          description: rec.description,
          priority: rec.priority || 'medium',
          action: rec.action || 'Take action',
          completed: false
        }));
        formattedRecommendations.push(...taskDefaults);
      }
    }

    // Cache the recommendations
    const cacheData = {
      recommendations: formattedRecommendations,
      dataHash,
      timestamp: now,
      page
    };
    
    try {
      await prisma.systemSettings.upsert({
        where: { key: cacheKey },
        update: { 
          value: JSON.stringify(cacheData),
          category: 'ai_cache'
        },
        create: {
          key: cacheKey,
          value: JSON.stringify(cacheData),
          category: 'ai_cache'
        }
      });
      console.log(`💾 Cached AI recommendations for ${page}`);
    } catch (error) {
      console.error('⚠️ Failed to cache recommendations:', error);
    }

    return NextResponse.json({
      success: true,
      recommendations: formattedRecommendations,
      dataAnalyzed: businessData, // Include the data that was analyzed
      page,
      cached: false
    });

  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    return NextResponse.json({
      success: true,
      recommendations: [],
      message: 'Failed to generate AI recommendations'
    });
  }
}

async function getBusinessDataForPage(page: string, userId: string, context?: any, abilities: string[] = []) {
  try {
    // Check for context-specific requests (single lead, opportunity, or account)
    if (context?.leadId && page === 'leads') {
      return await getSpecificLeadData(context.leadId);
    }
    if (context?.opportunityId && page === 'opportunities') {
      return await getSpecificOpportunityData(context.opportunityId);
    }
    if (context?.accountId && page === 'accounts') {
      return await getSpecificAccountData(context.accountId);
    }
    
    // General page data
    switch (page) {
      case 'dashboard':
        return await getDashboardData(userId, abilities);
      case 'crm-dashboard':
        return await getCRMDashboardData(userId, abilities);
      case 'opportunities':
        return await getOpportunitiesData(userId);
      case 'leads':
        return await getLeadsData();
      case 'accounts':
        return await getAccountsData(userId);
      case 'products':
        return await getProductsData();
      case 'inventory':
        return await getInventoryData();
      case 'tasks':
        return await getTasksData();
      case 'distributors':
        return await getDistributorsData();
      case 'warehouses':
        return await getWarehousesData();
      case 'stock':
        return await getStockData();
      case 'stock-movements':
        return await getStockMovementsData();
      case 'backorders':
        return await getBackordersData();
      case 'invoices':
        return await getInvoicesData();
      case 'quotations':
        return await getQuotationsData();
      case 'orders':
        return await getOrdersData();
      case 'ecommerce-orders':
        return await getEcommerceOrdersData();
      case 'ecommerce-customers':
        return await getEcommerceCustomersData();
      case 'ecommerce-categories':
        return await getEcommerceCategoriesData();
      case 'payments':
        return await getPaymentsData();
      case 'returns':
        return await getReturnsData();
      case 'reports':
        return await getReportsData();
      case 'contacts':
        return await getContactsData();
      case 'distributor-leads':
        return await getDistributorLeadsData();
      case 'routes-mapping':
        return await getRoutesMappingData();
      case 'projects':
        return await getProjectsData(userId);
      default:
        return await getDashboardData(userId, abilities);
    }
  } catch (error) {
    console.error('Error fetching business data:', error);
    return {};
  }
}

function buildEcommerceSalesOrderFilter(): Prisma.SalesOrderWhereInput {
  return {
    OR: [
      {
        invoice: {
          lead: {
            source: "ECOMMERCE",
          },
        },
      },
      {
        quotation: {
          lead: {
            source: "ECOMMERCE",
          },
        },
      },
    ],
  };
}

// Helper function to fetch user abilities
async function getUserAbilities(userId: string, userRole: Role): Promise<string[]> {
  try {
    // Try to get user's role assignments from database
    const userRoleAssignments = await prisma.userRoleAssignment.findMany({
      where: {
        userId: userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            roleAbilities: {
              include: {
                ability: true
              }
            }
          }
        }
      }
    });

    // Extract all abilities from all assigned roles
    const abilities: string[] = [];
    userRoleAssignments.forEach(assignment => {
      assignment.role.roleAbilities.forEach(roleAbility => {
        if (!abilities.includes(roleAbility.ability.name)) {
          abilities.push(roleAbility.ability.name);
        }
      });
    });

    // If no abilities found from database, fall back to centralized role-based abilities
    if (abilities.length === 0 && userRole) {
      const fallbackAbilities = ROLE_ABILITIES[userRole] || [];
      return [...fallbackAbilities]; // Convert readonly array to mutable
    }

    return abilities;
  } catch (error) {
    console.error('Error fetching user abilities:', error);
    // Fallback to role-based abilities if database query fails
    if (userRole) {
      const fallbackAbilities = ROLE_ABILITIES[userRole] || [];
      return [...fallbackAbilities]; // Convert readonly array to mutable
    }
    return [];
  }
}

// Helper function to check if user has a specific ability
function hasAbility(abilities: string[], ability: string): boolean {
  return abilities.includes(ability);
}

async function getDashboardData(userId: string, abilities: string[] = []) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  // If no abilities provided, fetch all data (for Super Admin or when abilities aren't available)
  // Otherwise check permissions for each module
  const canViewProducts = abilities.length === 0 || hasAbility(abilities, 'products.view');
  const canViewInventory = abilities.length === 0 || hasAbility(abilities, 'inventory.view');
  const canViewLeads = abilities.length === 0 || hasAbility(abilities, 'leads.view');
  const canViewOpportunities = abilities.length === 0 || hasAbility(abilities, 'opportunities.view');
  const canViewQuotations = abilities.length === 0 || hasAbility(abilities, 'quotations.view');
  const canViewInvoices = abilities.length === 0 || hasAbility(abilities, 'invoices.view');
  const canViewAccounts = abilities.length === 0 || hasAbility(abilities, 'accounts.view');

  // Build queries conditionally based on permissions
  const queries: Promise<any>[] = [];
  
  // Products & Inventory
  queries.push(
    canViewProducts ? prisma.product.count({ where: { active: true } }) : Promise.resolve(0),
    canViewInventory ? prisma.stockItem.count({ where: { quantity: { lte: 10, gt: 0 } } }) : Promise.resolve(0),
    canViewInventory ? prisma.stockItem.count({ where: { quantity: 0 } }) : Promise.resolve(0),
    canViewInventory ? prisma.stockItem.aggregate({ _sum: { totalValue: true } }) : Promise.resolve({ _sum: { totalValue: 0 } })
  );
  
  // CRM - Leads
  queries.push(
    canViewLeads ? prisma.lead.count() : Promise.resolve(0),
    canViewLeads ? prisma.lead.count({ where: { status: 'NEW', createdAt: { gte: startOfMonth } } }) : Promise.resolve(0),
    canViewLeads ? prisma.lead.count({ where: { status: 'QUALIFIED' } }) : Promise.resolve(0)
  );
  
  // CRM - Opportunities
  queries.push(
    canViewOpportunities ? prisma.opportunity.count({ where: { ownerId: userId } }) : Promise.resolve(0),
    canViewOpportunities ? prisma.opportunity.count({ where: { ownerId: userId, stage: { notIn: ['WON', 'LOST'] } } }) : Promise.resolve(0),
    canViewOpportunities ? prisma.opportunity.count({ where: { ownerId: userId, stage: 'WON', updatedAt: { gte: startOfMonth } } }) : Promise.resolve(0),
    canViewOpportunities ? prisma.opportunity.aggregate({ _sum: { value: true }, where: { ownerId: userId, stage: { notIn: ['WON', 'LOST'] } } }) : Promise.resolve({ _sum: { value: 0 } })
  );
  
  // Sales - Quotations
  queries.push(
    canViewQuotations ? prisma.quotation.count() : Promise.resolve(0),
    canViewQuotations ? prisma.quotation.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }) : Promise.resolve(0),
    canViewQuotations ? prisma.quotation.count({ where: { status: 'ACCEPTED', updatedAt: { gte: startOfMonth } } }) : Promise.resolve(0)
  );
  
  // Sales - Invoices
  queries.push(
    canViewInvoices ? prisma.invoice.count() : Promise.resolve(0),
    canViewInvoices ? prisma.invoice.count({ where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } } }) : Promise.resolve(0),
    canViewInvoices ? prisma.invoice.count({ where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: now } } }) : Promise.resolve(0),
    canViewInvoices ? prisma.invoice.aggregate({ _sum: { total: true }, where: { paymentStatus: 'PAID' } }) : Promise.resolve({ _sum: { total: 0 } }),
    canViewInvoices ? prisma.invoice.aggregate({ _sum: { total: true }, where: { paymentStatus: 'PAID', updatedAt: { gte: startOfMonth } } }) : Promise.resolve({ _sum: { total: 0 } }),
    canViewInvoices ? prisma.invoice.aggregate({ _sum: { total: true }, where: { paymentStatus: 'PAID', updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }) : Promise.resolve({ _sum: { total: 0 } })
  );
  
  // Customers
  queries.push(canViewAccounts ? prisma.account.count() : Promise.resolve(0));
  
  // Recent activity
  queries.push(
    canViewQuotations ? prisma.quotation.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }) : Promise.resolve(0),
    canViewInvoices ? prisma.invoice.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }) : Promise.resolve(0),
    canViewOpportunities ? prisma.opportunity.count({ where: { ownerId: userId, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }) : Promise.resolve(0)
  );

  const [
    totalProducts,
    lowStockItems,
    outOfStockItems,
    totalStockValue,
    totalLeads,
    newLeads,
    qualifiedLeads,
    totalOpportunities,
    openOpportunities,
    wonOpportunities,
    pipelineValue,
    totalQuotations,
    pendingQuotations,
    acceptedQuotations,
    totalInvoices,
    unpaidInvoices,
    overdueInvoices,
    totalRevenue,
    monthlyRevenue,
    lastMonthRevenue,
    totalAccounts,
    recentQuotations,
    recentInvoices,
    recentOpportunities
  ] = await Promise.all(queries);

  // Calculate revenue change (only if user has invoice permission)
  const revenueChange = canViewInvoices && lastMonthRevenue._sum?.total && monthlyRevenue._sum?.total
    ? ((monthlyRevenue._sum.total - lastMonthRevenue._sum.total) / lastMonthRevenue._sum.total) * 100
    : 0;

  return {
    // Products & Inventory (only if user has permission)
    totalProducts: hasAbility(abilities, 'products.view') ? totalProducts : 0,
    lowStockItems: hasAbility(abilities, 'inventory.view') ? lowStockItems : 0,
    outOfStockItems: hasAbility(abilities, 'inventory.view') ? outOfStockItems : 0,
    totalStockValue: hasAbility(abilities, 'inventory.view') ? (totalStockValue._sum?.totalValue || 0) : 0,
    // CRM (only if user has permission)
    totalLeads: hasAbility(abilities, 'leads.view') ? totalLeads : 0,
    newLeads: hasAbility(abilities, 'leads.view') ? newLeads : 0,
    qualifiedLeads: hasAbility(abilities, 'leads.view') ? qualifiedLeads : 0,
    totalOpportunities: hasAbility(abilities, 'opportunities.view') ? totalOpportunities : 0,
    openOpportunities: hasAbility(abilities, 'opportunities.view') ? openOpportunities : 0,
    wonOpportunities: hasAbility(abilities, 'opportunities.view') ? wonOpportunities : 0,
    pipelineValue: hasAbility(abilities, 'opportunities.view') ? (pipelineValue._sum?.value || 0) : 0,
    // Sales (only if user has permission)
    totalQuotations: hasAbility(abilities, 'quotations.view') ? totalQuotations : 0,
    pendingQuotations: hasAbility(abilities, 'quotations.view') ? pendingQuotations : 0,
    acceptedQuotations: hasAbility(abilities, 'quotations.view') ? acceptedQuotations : 0,
    totalInvoices: canViewInvoices ? totalInvoices : 0,
    unpaidInvoices: canViewInvoices ? unpaidInvoices : 0,
    overdueInvoices: canViewInvoices ? overdueInvoices : 0,
    totalRevenue: canViewInvoices ? (totalRevenue._sum?.total || 0) : 0,
    monthlyRevenue: canViewInvoices ? (monthlyRevenue._sum?.total || 0) : 0,
    lastMonthRevenue: canViewInvoices ? (lastMonthRevenue._sum?.total || 0) : 0,
    revenueChange: canViewInvoices ? Math.round(revenueChange * 10) / 10 : 0,
    // Customers (only if user has permission)
    totalAccounts: hasAbility(abilities, 'accounts.view') ? totalAccounts : 0,
    // Recent activity (only if user has permission)
    recentQuotations: hasAbility(abilities, 'quotations.view') ? recentQuotations : 0,
    recentInvoices: canViewInvoices ? recentInvoices : 0,
    recentOpportunities: hasAbility(abilities, 'opportunities.view') ? recentOpportunities : 0,
    // Time context
    currentMonth: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    lastMonth: endOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  };
}

async function getCRMDashboardData(userId: string, abilities: string[] = []) {
  const canViewLeads = hasAbility(abilities, 'leads.view');
  const canViewOpportunities = hasAbility(abilities, 'opportunities.view');
  const canViewAccounts = hasAbility(abilities, 'accounts.view');

  const [leads, opportunities, accounts] = await Promise.all([
    canViewLeads ? prisma.lead.count() : Promise.resolve(0),
    canViewOpportunities ? prisma.opportunity.count({ where: { ownerId: userId } }) : Promise.resolve(0),
    canViewAccounts ? prisma.account.count() : Promise.resolve(0)
  ]);

  return { leads, opportunities, accounts };
}

async function getOpportunitiesData(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [
    // Total counts by stage
    total,
    quoteSent,
    quoteReviewed,
    negotiation,
    lost,
    won,
    // Age-based metrics
    newThisMonth,
    newLast7Days,
    stuckInNegotiation,
    overdueCloseDates,
    // Value metrics
    totalValue,
    pipelineValue,
    wonValue,
    lostValue,
    wonThisMonth,
    wonThisMonthValue,
    // Probability metrics
    highProbability,
    mediumProbability,
    lowProbability,
    averageProbability,
    // Linked opportunities
    withQuotations,
    withInvoices,
    fromLeads,
    // Recent activity
    recentOpportunities,
    recentStageChanges
  ] = await Promise.all([
    // Total counts (filtered by owner)
    prisma.opportunity.count({ where: { ownerId: userId } }),
    prisma.opportunity.count({ where: { ownerId: userId, stage: 'QUOTE_SENT' } }),
    prisma.opportunity.count({ where: { ownerId: userId, stage: 'QUOTE_REVIEWED' } }),
    prisma.opportunity.count({ where: { ownerId: userId, stage: 'NEGOTIATION' } }),
    prisma.opportunity.count({ where: { ownerId: userId, stage: 'WON' } }),
    prisma.opportunity.count({ where: { ownerId: userId, stage: 'LOST' } }),
    // Age metrics - new opportunities this month (any stage except won/lost)
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        stage: { notIn: ['WON', 'LOST'] },
        createdAt: { gte: startOfMonth }
      } 
    }),
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        createdAt: { gte: sevenDaysAgo }
      } 
    }),
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        stage: 'NEGOTIATION',
        updatedAt: { lt: thirtyDaysAgo }
      } 
    }),
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        closeDate: { lt: now },
        stage: { notIn: ['WON', 'LOST'] }
      } 
    }),
    // Value aggregates (filtered by owner)
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: { ownerId: userId, value: { not: null } }
    }),
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: { 
        ownerId: userId,
        stage: { notIn: ['WON', 'LOST'] },
        value: { not: null }
      }
    }),
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: { 
        ownerId: userId,
        stage: 'WON',
        value: { not: null }
      }
    }),
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: { 
        ownerId: userId,
        stage: 'LOST',
        value: { not: null }
      }
    }),
    // Won this month
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        stage: 'WON',
        wonDate: { gte: startOfMonth }
      }
    }),
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: {
        ownerId: userId,
        stage: 'WON',
        wonDate: { gte: startOfMonth },
        value: { not: null }
      }
    }),
    // Probability metrics
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        probability: { gte: 70 },
        stage: { notIn: ['WON', 'LOST'] }
      } 
    }),
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        probability: { gte: 40, lt: 70 },
        stage: { notIn: ['WON', 'LOST'] }
      } 
    }),
    prisma.opportunity.count({ 
      where: { 
        ownerId: userId,
        probability: { lt: 40 },
        stage: { notIn: ['WON', 'LOST'] }
      } 
    }),
    // Average probability
    prisma.opportunity.aggregate({
      _avg: { probability: true },
      where: { ownerId: userId, stage: { notIn: ['WON', 'LOST'] } }
    }),
    // Linked opportunities
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        quotations: { some: {} }
      }
    }),
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        invoices: { some: {} }
      }
    }),
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        leadId: { not: null }
      }
    }),
    // Recent activity
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        createdAt: { gte: sevenDaysAgo }
      }
    }),
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        updatedAt: { gte: sevenDaysAgo }
      }
    })
  ]);

  // Calculate conversion rates
  const winRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;
  const lossRate = total > 0 ? ((lost / total) * 100).toFixed(1) : 0;
  const openRate = total > 0 ? (((total - won - lost) / total) * 100).toFixed(1) : 0;

  // Calculate average probability
  const avgProbability = (averageProbability && typeof averageProbability === 'object' && '_avg' in averageProbability && averageProbability._avg && typeof averageProbability._avg === 'object' && 'probability' in averageProbability._avg)
    ? Math.round(Number((averageProbability._avg as any).probability) || 0) 
    : 0;

  return {
    total,
    newOpportunities: total - won - lost, // Open opportunities
    quoteSent,
    quoteReviewed: 0, // Will be 0 as we're not tracking this separately
    negotiation,
    won,
    lost,
    // Age metrics
    newThisMonth,
    newLast7Days,
    stuckInNegotiation,
    overdueCloseDates,
    // Values
    totalValue: (totalValue && typeof totalValue === 'object' && '_sum' in totalValue) ? (Number((totalValue as any)._sum.value) || 0) : 0,
    pipelineValue: (pipelineValue && typeof pipelineValue === 'object' && '_sum' in pipelineValue) ? (Number((pipelineValue as any)._sum.value) || 0) : 0,
    wonValue: (wonValue && typeof wonValue === 'object' && '_sum' in wonValue) ? (Number((wonValue as any)._sum.value) || 0) : 0,
    lostValue: (lostValue && typeof lostValue === 'object' && '_sum' in lostValue) ? (Number((lostValue as any)._sum.value) || 0) : 0,
    wonThisMonth,
    wonThisMonthValue: (wonThisMonthValue && typeof wonThisMonthValue === 'object' && '_sum' in wonThisMonthValue) ? (Number((wonThisMonthValue as any)._sum.value) || 0) : 0,
    // Probability
    highProbability,
    mediumProbability,
    lowProbability,
    averageProbability: avgProbability,
    // Links
    withQuotations,
    withInvoices,
    fromLeads,
    // Conversion rates
    winRate: parseFloat(winRate as string),
    lossRate: parseFloat(lossRate as string),
    openRate: parseFloat(openRate as string),
    // Recent activity
    recentOpportunities,
    recentStageChanges,
    // Time context
    currentMonth: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  };
}

async function getLeadsData(abilities: string[] = []) {
  // Check if user has permission to view leads
  if (!hasAbility(abilities, 'leads.view')) {
    return {
      total: 0,
      newLeads: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
      lost: 0,
      newLeadsLast7Days: 0,
      newLeadsThisMonth: 0,
      newLeadsOver3Days: 0,
      contactedOver3Days: 0,
      leadsWithFollowUp: 0,
      overdueFollowUps: 0,
      assignedLeads: 0,
      unassignedLeads: 0,
      leadsBySource: {},
      leadsWithProducts: 0,
      leadsWithOpportunities: 0,
      totalDealValue: 0,
      qualifiedDealValue: 0,
      recentLeads: 0,
      recentStatusChanges: 0
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  // Valid lead statuses - exclude legacy opportunity-related statuses
  // Legacy statuses like QUOTE_SENT, WON, CONTRACT_SIGNED are already opportunities, not leads
  const validLeadStatuses: any[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED_TO_OPPORTUNITY', 'LOST'];
  
  const [
    // Total counts by status
    total,
    newLeads,
    contacted,
    qualified,
    converted,
    lost,
    // Age-based metrics
    newLeadsLast7Days,
    newLeadsThisMonth,
    newLeadsOver3Days,
    contactedOver3Days,
    // Follow-up metrics
    leadsWithFollowUp,
    overdueFollowUps,
    // Assignment metrics
    assignedLeads,
    unassignedLeads,
    // Source metrics
    leadsBySource,
    // Product interest
    leadsWithProducts,
    // Conversion to opportunities
    leadsWithOpportunities,
    // Deal value
    totalDealValue,
    qualifiedDealValue,
    // Recent activity
    recentLeads,
    recentStatusChanges
  ] = await Promise.all([
    // Total counts - only count valid lead statuses, exclude legacy opportunity statuses
    prisma.lead.count({ where: { status: { in: validLeadStatuses } } }),
    prisma.lead.count({ where: { status: 'NEW' } }),
    prisma.lead.count({ where: { status: 'CONTACTED' } }),
    prisma.lead.count({ where: { status: 'QUALIFIED' } }),
    // Count all converted leads (CONVERTED_TO_OPPORTUNITY, QUOTE_SENT, and legacy CONVERTED)
    prisma.lead.count({ 
      where: { 
        status: { 
          in: ['CONVERTED_TO_OPPORTUNITY', 'QUOTE_SENT', 'CONVERTED', 'OPPORTUNITY', 'NEW_OPPORTUNITY'] 
        } 
      } 
    }),
    prisma.lead.count({ where: { status: 'LOST' } }),
    // Age metrics
    prisma.lead.count({ 
      where: { 
        status: 'NEW',
        createdAt: { gte: sevenDaysAgo }
      } 
    }),
    prisma.lead.count({ 
      where: { 
        status: 'NEW',
        createdAt: { gte: startOfMonth }
      } 
    }),
    prisma.lead.count({ 
      where: { 
        status: 'NEW',
        createdAt: { lte: threeDaysAgo }
      } 
    }),
    prisma.lead.count({ 
      where: { 
        status: 'CONTACTED',
        updatedAt: { lte: threeDaysAgo }
      } 
    }),
    // Follow-up metrics - only count valid lead statuses
    prisma.lead.count({ 
      where: { 
        followUpDate: { not: null },
        status: { in: validLeadStatuses }
      } 
    }),
    prisma.lead.count({ 
      where: { 
        followUpDate: { lte: now },
        status: { in: validLeadStatuses }
      } 
    }),
    // Assignment - only count valid lead statuses
    prisma.lead.count({ 
      where: { 
        assignedTo: { not: null },
        status: { in: validLeadStatuses }
      } 
    }),
    prisma.lead.count({ 
      where: { 
        assignedTo: null,
        status: { in: validLeadStatuses }
      } 
    }),
    // Sources - get distinct sources - only for valid lead statuses
    prisma.lead.groupBy({
      by: ['source'],
      _count: { source: true },
      where: { 
        source: { not: null },
        status: { in: validLeadStatuses }
      }
    }),
    // Product interest - only for valid lead statuses
    prisma.lead.count({ 
      where: { 
        interestedProducts: { not: null },
        status: { in: validLeadStatuses }
      } 
    }),
    // Opportunities from leads - only count valid lead statuses
    prisma.lead.count({
      where: {
        opportunities: { some: {} },
        status: { in: validLeadStatuses }
      }
    }),
    // Deal value aggregates - only for valid lead statuses
    prisma.lead.aggregate({
      _sum: { dealValue: true },
      where: { 
        dealValue: { not: null },
        status: { in: validLeadStatuses }
      }
    }),
    prisma.lead.aggregate({
      _sum: { dealValue: true },
      where: { 
        status: 'QUALIFIED',
        dealValue: { not: null }
      }
    }),
    // Recent activity - only count valid lead statuses
    prisma.lead.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: { in: validLeadStatuses }
      }
    }),
    // Status changes (leads updated but not newly created) - only valid lead statuses
    prisma.lead.count({
      where: {
        updatedAt: { gte: sevenDaysAgo },
        status: { in: validLeadStatuses }
      }
    })
  ]);

  // Calculate conversion rates
  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;
  const qualificationRate = total > 0 ? ((qualified / total) * 100).toFixed(1) : 0;
  const newLeadConversionRate = newLeads > 0 ? ((qualified / newLeads) * 100).toFixed(1) : 0;

  // Format sources
  const sourceBreakdown = leadsBySource.reduce((acc: any, item: any) => {
    if (item.source) {
      acc[item.source] = item._count.source;
    }
    return acc;
  }, {});

  return {
    total,
    newLeads,
    contacted,
    qualified,
    converted,
    lost,
    // Age metrics
    newLeadsLast7Days,
    newLeadsThisMonth,
    newLeadsOver3Days,
    contactedOver3Days,
    // Follow-up
    leadsWithFollowUp,
    overdueFollowUps,
    // Assignment
    assignedLeads,
    unassignedLeads,
    // Sources
    sourceBreakdown,
    totalSources: Object.keys(sourceBreakdown).length,
    // Product interest
    leadsWithProducts,
    // Opportunities
    leadsWithOpportunities,
    // Deal values
    totalDealValue: totalDealValue._sum.dealValue || 0,
    qualifiedDealValue: qualifiedDealValue._sum.dealValue || 0,
    // Conversion rates
    conversionRate: parseFloat(conversionRate as string),
    qualificationRate: parseFloat(qualificationRate as string),
    newLeadConversionRate: parseFloat(newLeadConversionRate as string),
    // Recent activity
    recentLeads,
    recentStatusChanges,
    // Time context
    currentMonth: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  };
}

async function getProductsData(abilities: string[] = []) {
  // Check if user has permission to view products
  if (!hasAbility(abilities, 'products.view')) {
    return {
      totalProducts: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      productsWithStock: 0,
      productsWithoutStock: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      productsWithPrice: 0,
      productsWithoutPrice: 0,
      totalCategories: 0,
      productsByType: {},
      newProductsLast30Days: 0,
      newProductsLast7Days: 0,
      productsWithMovements: 0,
      totalStockValue: 0
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const [
    totalProducts,
    activeProducts,
    inactiveProducts,
    productsWithStock,
    productsWithoutStock,
    lowStockProducts,
    outOfStockProducts,
    productsWithPrice,
    productsWithoutPrice,
    totalCategories,
    productsByType,
    newProductsLast30Days,
    newProductsLast7Days,
    productsWithMovements,
    totalStockValue
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: false } }),
    // Products with stock items (have inventory)
    prisma.product.count({
      where: {
        stockItems: {
          some: {
            quantity: { gt: 0 },
            warehouseId: { not: null }
          }
        }
      }
    }),
    // Products without stock items
    prisma.product.count({
      where: {
        stockItems: {
          none: {
            quantity: { gt: 0 },
            warehouseId: { not: null }
          }
        }
      }
    }),
    // Low stock products (quantity <= 10 but > 0)
    prisma.product.count({
      where: {
        active: true,
        stockItems: {
          some: {
            quantity: { lte: 10, gt: 0 },
            warehouseId: { not: null }
          }
        }
      }
    }),
    // Out of stock products
    prisma.product.count({
      where: {
        active: true,
        stockItems: {
          some: {
            quantity: 0,
            warehouseId: { not: null }
          }
        }
      }
    }),
    // Products with pricing
    prisma.product.count({
      where: {
        AND: [
          { price: { not: null } },
          { price: { gt: 0 } }
        ]
      }
    }),
    // Products without pricing
    prisma.product.count({
      where: {
        OR: [
          { price: null },
          { price: 0 }
        ]
      }
    }),
    prisma.category.count(),
    // Products by type (PRODUCT vs SERVICE)
    prisma.product.groupBy({
      by: ['type'],
      _count: { id: true }
    }),
    // New products in last 30 days
    prisma.product.count({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    }),
    // New products in last 7 days
    prisma.product.count({
      where: {
        createdAt: { gte: sevenDaysAgo }
      }
    }),
    // Products with stock movements in last 30 days - need to check via StockMovement table
    prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      distinct: ['productId'],
      select: {
        productId: true
      }
    }).then(results => results.length),
    // Calculate total stock value
    prisma.stockItem.findMany({
      where: { warehouseId: { not: null } },
      select: {
        quantity: true,
        averageCost: true
      }
    })
  ]);

  // Calculate total stock value
  const calculatedTotalStockValue = totalStockValue.reduce((sum, item) => {
    const cost = item.averageCost || 0;
    const quantity = item.quantity || 0;
    return sum + (cost * quantity);
  }, 0);

  // Format products by type
  const productTypeBreakdown = productsByType.reduce((acc: any, item) => {
    acc[item.type] = item._count.id;
    return acc;
  }, {});

  // Get exchange rate for currency conversion
  let exchangeRate = 11.0;
  try {
    exchangeRate = await getExchangeRate('USD', 'GHS') || 11.0;
  } catch (e) {
    console.error('Error fetching exchange rate:', e);
  }
  const totalStockValueGHS = calculatedTotalStockValue * exchangeRate;

  return {
    totalProducts,
    activeProducts,
    inactiveProducts,
    productsWithStock,
    productsWithoutStock,
    lowStockProducts,
    outOfStockProducts,
    productsWithPrice,
    productsWithoutPrice,
    totalCategories,
    productTypeBreakdown,
    newProductsLast30Days,
    newProductsLast7Days,
    productsWithMovements,
    totalStockValue: calculatedTotalStockValue,
    totalStockValueGHS
  };
}

async function getInventoryData() {
  const [totalItems, lowStock, totalValue] = await Promise.all([
    prisma.stockItem.count(),
    prisma.stockItem.count({ where: { quantity: { lte: 10 } } }),
    prisma.stockItem.aggregate({
      _sum: { quantity: true }
    })
  ]);

  return { totalItems, lowStock, totalValue: totalValue._sum.quantity || 0 };
}

async function getTasksData() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [
    total,
    completed,
    overdue,
    pending,
    inProgress,
    cancelled,
    tasksLast7Days,
    tasksLast30Days,
    tasksWithDueDates,
    tasksWithoutDueDates,
    highPriorityTasks,
    urgentTasks,
    tasksByStatus,
    tasksByPriority
  ] = await Promise.all([
    prisma.task.count(),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.task.count({ 
      where: { 
        status: { not: 'COMPLETED' },
        dueDate: { lt: now }
      }
    }),
    prisma.task.count({ where: { status: 'PENDING' } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { status: 'CANCELLED' } }),
    prisma.task.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.task.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.task.count({ where: { dueDate: { not: null } } }),
    prisma.task.count({ where: { dueDate: null } }),
    prisma.task.count({ where: { priority: 'HIGH' } }),
    prisma.task.count({ where: { priority: 'URGENT' } }),
    prisma.task.groupBy({
      by: ['status'],
      _count: { id: true }
    }),
    prisma.task.groupBy({
      by: ['priority'],
      _count: { id: true }
    })
  ]);

  // Calculate completion rate
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Get tasks due soon (within 3 days)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const tasksDueSoon = await prisma.task.count({
    where: {
      status: { not: 'COMPLETED' },
      dueDate: {
        gte: now,
        lte: threeDaysFromNow
      }
    }
  });

  // Get overdue tasks by priority
  const overdueHighPriority = await prisma.task.count({
    where: {
      status: { not: 'COMPLETED' },
      dueDate: { lt: now },
      priority: { in: ['HIGH', 'URGENT'] }
    }
  });

  return {
    total,
    completed,
    overdue,
    pending,
    inProgress,
    cancelled,
    tasksLast7Days,
    tasksLast30Days,
    tasksWithDueDates,
    tasksWithoutDueDates,
    highPriorityTasks,
    urgentTasks,
    tasksDueSoon,
    overdueHighPriority,
    completionRate,
    statusBreakdown: tasksByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    priorityBreakdown: tasksByPriority.reduce((acc, item) => {
      acc[item.priority] = item._count.id;
      return acc;
    }, {} as Record<string, number>)
  };
}

async function getProjectsData(userId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Get all projects with their related data
  const projects = await prisma.project.findMany({
    include: {
      _count: {
        select: {
          members: true,
          tasks: true,
          incidents: true,
          resourceRequests: true,
          stages: true
        }
      },
      tasks: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          priority: true
        }
      },
      incidents: {
        select: {
          id: true,
          status: true,
          severity: true,
          dueDate: true
        }
      }
    }
  });

  // Calculate metrics
  const total = projects.length;
  const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
  const onHoldProjects = projects.filter(p => p.status === 'ON_HOLD').length;
  const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
  const cancelledProjects = projects.filter(p => p.status === 'CANCELLED').length;
  const draftProjects = projects.filter(p => p.status === 'DRAFT').length;

  // Calculate upcoming deadlines (within 14 days)
  const upcomingDeadlines = projects.filter(p => {
    if (!p.dueDate) return false;
    const due = new Date(p.dueDate);
    return due > now && due <= fourteenDaysFromNow && p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
  }).length;

  // Calculate overdue projects
  const overdueProjects = projects.filter(p => {
    if (!p.dueDate) return false;
    const due = new Date(p.dueDate);
    return due < now && p.status !== 'COMPLETED' && p.status !== 'CANCELLED' && p.status !== 'ARCHIVED';
  }).length;

  // Calculate project tasks metrics
  const allTasks = projects.flatMap(p => p.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'COMPLETED').length;
  const pendingTasks = allTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
  const overdueTasks = allTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due < now && t.status !== 'COMPLETED';
  }).length;

  // Calculate incidents metrics
  const allIncidents = projects.flatMap(p => p.incidents);
  const totalIncidents = allIncidents.length;
  const openIncidents = allIncidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
  const highSeverityIncidents = allIncidents.filter(i => i.severity === 'HIGH' || i.severity === 'CRITICAL').length;
  const overdueIncidents = allIncidents.filter(i => {
    if (!i.dueDate) return false;
    const due = new Date(i.dueDate);
    return due < now && i.status !== 'RESOLVED' && i.status !== 'CLOSED';
  }).length;

  // Calculate resource requests
  const totalResourceRequests = projects.reduce((sum, p) => sum + p._count.resourceRequests, 0);

  // Projects with no members
  const projectsWithoutMembers = projects.filter(p => p._count.members === 0).length;

  // Projects with no tasks
  const projectsWithoutTasks = projects.filter(p => p._count.tasks === 0).length;

  // Projects created recently
  const newProjectsLast7Days = projects.filter(p => new Date(p.createdAt) >= sevenDaysAgo).length;
  const newProjectsLast30Days = projects.filter(p => new Date(p.createdAt) >= thirtyDaysAgo).length;

  // Projects with overdue tasks
  const projectsWithOverdueTasks = projects.filter(p => {
    return p.tasks.some(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due < now && t.status !== 'COMPLETED';
    });
  }).length;

  // Projects with high priority incidents
  const projectsWithHighSeverityIncidents = projects.filter(p => {
    return p.incidents.some(i => i.severity === 'HIGH' || i.severity === 'CRITICAL');
  }).length;

  return {
    total,
    activeProjects,
    onHoldProjects,
    completedProjects,
    cancelledProjects,
    draftProjects,
    upcomingDeadlines,
    overdueProjects,
    totalTasks,
    completedTasks,
    pendingTasks,
    overdueTasks,
    totalIncidents,
    openIncidents,
    highSeverityIncidents,
    overdueIncidents,
    totalResourceRequests,
    projectsWithoutMembers,
    projectsWithoutTasks,
    newProjectsLast7Days,
    newProjectsLast30Days,
    projectsWithOverdueTasks,
    projectsWithHighSeverityIncidents
  };
}

async function getDistributorsData() {
  const [total, active, inactive] = await Promise.all([
    prisma.distributor.count(),
    prisma.distributor.count({ where: { status: 'ACTIVE' } }),
    prisma.distributor.count({ where: { status: 'INACTIVE' } })
  ]);

  return { total, active, inactive };
}

async function getWarehousesData() {
  const [total, totalStock, totalValue] = await Promise.all([
    prisma.warehouse.count(),
    prisma.stockItem.aggregate({
      _sum: { quantity: true },
      where: { warehouseId: { not: null } }
    }),
    prisma.stockItem.aggregate({
      _sum: { 
        quantity: true 
      },
      where: { warehouseId: { not: null } }
    })
  ]);

  // Calculate total value using averageCost
  const stockItems = await prisma.stockItem.findMany({
    where: { warehouseId: { not: null } },
    select: {
      quantity: true,
      averageCost: true
    }
  });
  
  const calculatedTotalValue = stockItems.reduce((sum, item) => {
    const cost = item.averageCost || 0;
    const quantity = item.quantity || 0;
    return sum + (cost * quantity);
  }, 0);

  return { 
    total, 
    totalStock: totalStock._sum.quantity || 0,
    totalValue: calculatedTotalValue
  };
}

async function getStockData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [
    totalProducts,
    activeProducts,
    lowStockItems,
    outOfStockItems,
    totalStockValue,
    productsWithMovement,
    slowMovingProducts
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.stockItem.count({ 
      where: { 
        quantity: { lte: 10, gt: 0 },
        warehouseId: { not: null }
      } 
    }),
    prisma.stockItem.count({ 
      where: { 
        quantity: 0,
        warehouseId: { not: null }
      } 
    }),
    // Get stock items to calculate total value
    prisma.stockItem.findMany({
      where: { warehouseId: { not: null } },
      select: {
        quantity: true,
        averageCost: true
      }
    }),
    // Products with recent stock movements (using groupBy and counting unique productIds)
    prisma.stockMovement.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    }).then(results => results.length),
    // Slow moving products - will calculate after Promise.all
    0
  ]);

  // Calculate total stock value
  const calculatedTotalValue = totalStockValue.reduce((sum, item) => {
    const cost = item.averageCost || 0;
    const quantity = item.quantity || 0;
    return sum + (cost * quantity);
  }, 0);

  // Calculate slow moving products (no movement in last 30 days)
  const allProducts = await prisma.product.findMany({
    where: {
      active: true,
      stockItems: {
        some: {
          quantity: { gt: 0 },
          warehouseId: { not: null }
        }
      }
    },
    select: {
      id: true
    }
  });
  
  const productsWithMovements = await prisma.stockMovement.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo }
    },
    distinct: ['productId'],
    select: {
      productId: true
    }
  });
  const productsWithMovementsSet = new Set(productsWithMovements.map(m => m.productId));
  const calculatedSlowMovingProducts = allProducts.filter(p => !productsWithMovementsSet.has(p.id)).length;

  // Get exchange rate for currency conversion
  let exchangeRate = 11.0;
  try {
    exchangeRate = await getExchangeRate('USD', 'GHS') || 11.0;
  } catch (e) {
    console.error('Error fetching exchange rate:', e);
  }
  const totalValueInGHS = calculatedTotalValue * exchangeRate;

  return {
    totalProducts,
    activeProducts,
    lowStockItems,
    outOfStockItems,
    totalStockValue: calculatedTotalValue,
    totalStockValueGHS: totalValueInGHS,
    productsWithMovement,
    slowMovingProducts: calculatedSlowMovingProducts
  };
}

async function getStockMovementsData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const [
    totalMovements,
    movementsLast30Days,
    movementsLast7Days,
    receiptsCount,
    adjustmentsCount,
    transfersInCount,
    transfersOutCount,
    salesCount,
    movementsByWarehouse,
    largeMovements,
    movementsWithoutReference
  ] = await Promise.all([
    prisma.stockMovement.count(),
    prisma.stockMovement.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.stockMovement.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    }),
    prisma.stockMovement.count({ where: { type: 'RECEIPT' } }),
    prisma.stockMovement.count({ where: { type: 'ADJUSTMENT' } }),
    prisma.stockMovement.count({ where: { type: 'TRANSFER_IN' } }),
    prisma.stockMovement.count({ where: { type: 'TRANSFER_OUT' } }),
    prisma.stockMovement.count({ where: { type: 'SALE' } }),
    // Movements by warehouse
    prisma.stockMovement.groupBy({
      by: ['warehouseId'],
      where: { warehouseId: { not: null } },
      _count: { id: true }
    }),
    // Large movements (quantity > 100)
    prisma.stockMovement.count({
      where: {
        quantity: { gt: 100 },
        createdAt: { gte: thirtyDaysAgo }
      }
    }),
    // Movements without reference
    prisma.stockMovement.count({
      where: {
        OR: [
          { reference: null },
          { reference: '' }
        ],
        createdAt: { gte: thirtyDaysAgo }
      }
    })
  ]);

  const uniqueWarehouses = movementsByWarehouse.length;

  return {
    totalMovements,
    movementsLast30Days,
    movementsLast7Days,
    receiptsCount,
    adjustmentsCount,
    transfersInCount,
    transfersOutCount,
    salesCount,
    uniqueWarehouses,
    largeMovements,
    movementsWithoutReference
  };
}

async function getBackordersData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [
    totalBackorders,
    pendingBackorders,
    partiallyFulfilled,
    fulfilledBackorders,
    urgentBackorders,
    highPriorityBackorders,
    backordersLast30DaysCount,
    totalBackorderValue,
    backordersForAverageCalc,
    backordersByProduct
  ] = await Promise.all([
    prisma.backorder.count(),
    prisma.backorder.count({ where: { status: 'PENDING' } }),
    prisma.backorder.count({ where: { status: 'PARTIALLY_FULFILLED' } }),
    prisma.backorder.count({ where: { status: 'FULFILLED' } }),
    prisma.backorder.count({ where: { priority: 'URGENT' } }),
    prisma.backorder.count({ where: { priority: 'HIGH' } }),
    prisma.backorder.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.backorder.aggregate({
      _sum: { lineTotal: true },
      where: { status: { not: 'CANCELLED' } }
    }),
    // Calculate average days pending - get array for calculation
    prisma.backorder.findMany({
      where: { 
        status: { in: ['PENDING', 'PARTIALLY_FULFILLED'] }
      },
      select: {
        createdAt: true
      }
    }),
    // Backorders grouped by product
    prisma.backorder.groupBy({
      by: ['productId'],
      where: { status: { not: 'CANCELLED' } },
      _count: { id: true },
      _sum: { quantityPending: true }
    })
  ]);

  // Calculate average days pending
  const averageDays = backordersForAverageCalc.length > 0
    ? backordersForAverageCalc.reduce((sum, bo) => {
        const daysPending = Math.floor((now.getTime() - new Date(bo.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysPending;
      }, 0) / backordersForAverageCalc.length
    : 0;

  const uniqueProducts = backordersByProduct.length;

  return {
    totalBackorders,
    pendingBackorders,
    partiallyFulfilled,
    fulfilledBackorders,
    urgentBackorders,
    highPriorityBackorders,
    backordersLast30Days: backordersLast30DaysCount,
    totalBackorderValue: totalBackorderValue._sum.lineTotal || 0,
    averageDaysPending: Math.round(averageDays),
    uniqueProducts
  };
}

async function getInvoicesData(abilities: string[] = []) {
  // Check if user has permission to view invoices
  if (!hasAbility(abilities, 'invoices.view')) {
    return {
      totalInvoices: 0,
      draftInvoices: 0,
      sentInvoices: 0,
      overdueInvoices: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      partiallyPaidInvoices: 0,
      invoicesLast30Days: 0,
      invoicesThisMonth: 0,
      totalInvoiceValue: 0,
      overdueAmount: 0,
      paidThisMonth: 0,
      unpaidAmount: 0,
      averageDaysOverdue: 0
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [
    totalInvoices,
    draftInvoices,
    sentInvoices,
    overdueInvoices,
    paidInvoices,
    unpaidInvoices,
    partiallyPaidInvoices,
    invoicesLast30Days,
    invoicesThisMonth,
    totalInvoiceValueResult,
    overdueAmountResult,
    paidThisMonthResult,
    unpaidAmountResult
  ] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: 'DRAFT' } }),
    prisma.invoice.count({ where: { status: 'SENT' } }),
    prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    prisma.invoice.count({ where: { paymentStatus: 'PAID' } }),
    prisma.invoice.count({ where: { paymentStatus: 'UNPAID' } }),
    prisma.invoice.count({ where: { paymentStatus: 'PARTIALLY_PAID' } }),
    prisma.invoice.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.invoice.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.invoice.aggregate({
      _sum: { total: true }
    }),
    prisma.invoice.aggregate({
      _sum: { amountDue: true },
      where: { 
        status: 'OVERDUE',
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }
      }
    }).then(result => result._sum.amountDue || 0),
    prisma.invoice.aggregate({
      _sum: { amountPaid: true },
      where: { 
        paymentStatus: 'PAID',
        paidDate: { gte: startOfMonth }
      }
    }).then(result => result._sum.amountPaid || 0),
    prisma.invoice.aggregate({
      _sum: { amountDue: true },
      where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } }
    }).then(result => result._sum.amountDue || 0)
  ]);

  // Get invoices with overdue dates
  const overdueInvoicesList = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }
    },
    select: {
      id: true,
      number: true,
      amountDue: true,
      dueDate: true
    }
  });

  const overdueCount = overdueInvoicesList.length;
  const averageDaysOverdue = overdueInvoicesList.length > 0
    ? overdueInvoicesList.reduce((sum, inv) => {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysOverdue;
      }, 0) / overdueInvoicesList.length
    : 0;

  return {
    totalInvoices,
    draftInvoices,
    sentInvoices,
    overdueInvoices: overdueCount,
    paidInvoices,
    unpaidInvoices,
    partiallyPaidInvoices,
    invoicesLast30Days,
    invoicesThisMonth,
    totalInvoiceValue: totalInvoiceValueResult._sum.total || 0,
    overdueAmount: overdueAmountResult || 0,
    paidThisMonth: paidThisMonthResult || 0,
    unpaidAmount: unpaidAmountResult || 0,
    averageDaysOverdue
  };
}

async function getQuotationsData(abilities: string[] = []) {
  // Check if user has permission to view quotations
  if (!hasAbility(abilities, 'quotations.view')) {
    return {
      totalQuotations: 0,
      draftQuotations: 0,
      sentQuotations: 0,
      acceptedQuotations: 0,
      rejectedQuotations: 0,
      expiredQuotations: 0,
      quotationsLast30Days: 0,
      quotationsThisMonth: 0,
      totalQuotationValue: 0,
      acceptedValue: 0,
      pendingValue: 0,
      quotationsNeedingFollowUp: 0,
      conversionRate: 0
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [
    totalQuotations,
    draftQuotations,
    sentQuotations,
    acceptedQuotations,
    rejectedQuotations,
    expiredQuotations,
    quotationsLast30Days,
    quotationsThisMonth,
    totalQuotationValue,
    acceptedValue,
    pendingValue,
    quotationsNeedingFollowUp
  ] = await Promise.all([
    prisma.quotation.count(),
    prisma.quotation.count({ where: { status: 'DRAFT' } }),
    prisma.quotation.count({ where: { status: 'SENT' } }),
    prisma.quotation.count({ where: { status: 'ACCEPTED' } }),
    prisma.quotation.count({ where: { status: 'REJECTED' } }),
    prisma.quotation.count({ where: { status: 'EXPIRED' } }),
    prisma.quotation.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.quotation.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.quotation.aggregate({
      _sum: { total: true }
    }),
    prisma.quotation.aggregate({
      _sum: { total: true },
      where: { status: 'ACCEPTED' }
    }),
    prisma.quotation.aggregate({
      _sum: { total: true },
      where: { status: 'SENT' }
    }),
    // Quotations sent more than 3 days ago but not yet responded to
    prisma.quotation.count({
      where: {
        status: 'SENT',
        updatedAt: { lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  // Calculate conversion rate
  const conversionRate = totalQuotations > 0 
    ? (acceptedQuotations / totalQuotations) * 100 
    : 0;

  return {
    totalQuotations,
    draftQuotations,
    sentQuotations,
    acceptedQuotations,
    rejectedQuotations,
    expiredQuotations,
    quotationsLast30Days,
    quotationsThisMonth,
    totalQuotationValue: totalQuotationValue._sum.total || 0,
    acceptedValue: acceptedValue._sum.total || 0,
    pendingValue: pendingValue._sum.total || 0,
    quotationsNeedingFollowUp,
    conversionRate
  };
}

async function getOrdersData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [
    totalOrders,
    pendingOrders,
    confirmedOrders,
    processingOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,
    returnedOrders,
    ordersLast30Days,
    ordersThisMonth,
    totalOrderValue,
    pendingValue,
    processingValue,
    deliveredValue,
    averageProcessingTime,
    ordersByPaymentMethod
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'CONFIRMED' } }),
    prisma.order.count({ where: { status: 'PROCESSING' } }),
    prisma.order.count({ where: { status: 'SHIPPED' } }),
    prisma.order.count({ where: { status: 'DELIVERED' } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
    prisma.order.count({ where: { status: 'RETURNED' } }),
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true }
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'PENDING' }
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'PROCESSING' }
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'DELIVERED' }
    }),
    // Calculate average processing time (time from PENDING to DELIVERED)
    prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    }),
    // Count orders by payment method
    prisma.order.groupBy({
      by: ['paymentMethod'],
      _count: true
    })
  ]);

  // Calculate average processing time
  let avgProcessingDays = 0;
  if (averageProcessingTime.length > 0) {
    const totalDays = averageProcessingTime.reduce((sum, order) => {
      const days = Math.floor((order.updatedAt.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    avgProcessingDays = totalDays / averageProcessingTime.length;
  }

  // Also get SalesOrder data
  const [
    totalSalesOrders,
    pendingSalesOrders,
    confirmedSalesOrders,
    processingSalesOrders,
    shippedSalesOrders,
    deliveredSalesOrders,
    totalSalesOrderValue
  ] = await Promise.all([
    prisma.salesOrder.count(),
    prisma.salesOrder.count({ where: { status: 'PENDING' } }),
    prisma.salesOrder.count({ where: { status: 'CONFIRMED' } }),
    prisma.salesOrder.count({ where: { status: 'PROCESSING' } }),
    prisma.salesOrder.count({ where: { status: 'SHIPPED' } }),
    prisma.salesOrder.count({ where: { status: 'DELIVERED' } }),
    prisma.salesOrder.aggregate({
      _sum: { total: true }
    })
  ]);

  return {
    totalOrders: totalOrders + totalSalesOrders,
    pendingOrders: pendingOrders + pendingSalesOrders,
    confirmedOrders: confirmedOrders + confirmedSalesOrders,
    processingOrders: processingOrders + processingSalesOrders,
    shippedOrders: shippedOrders + shippedSalesOrders,
    deliveredOrders: deliveredOrders + deliveredSalesOrders,
    cancelledOrders,
    returnedOrders,
    ordersLast30Days,
    ordersThisMonth,
    totalOrderValue: Number(totalOrderValue._sum.totalAmount || 0) + Number(totalSalesOrderValue._sum.total || 0),
    pendingValue: pendingValue._sum.totalAmount || 0,
    processingValue: processingValue._sum.totalAmount || 0,
    deliveredValue: deliveredValue._sum.totalAmount || 0,
    averageProcessingDays: Math.round(avgProcessingDays * 10) / 10,
    ordersByPaymentMethod
  };
}

async function getEcommerceOrdersData() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const ecommerceFilter: Prisma.SalesOrderWhereInput = {
    OR: [
      { invoice: { lead: { source: 'ECOMMERCE' } } },
      { quotation: { lead: { source: 'ECOMMERCE' } } },
      { notes: { contains: 'Ecommerce order' } }
    ]
  };

  const statusList = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY_TO_SHIP',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED'
  ] as const;

  const statusCounts = await Promise.all(
    statusList.map(async (status) => ({
      status,
      count: await prisma.salesOrder.count({
        where: {
          AND: [ecommerceFilter, { status }]
        }
      })
    }))
  );

  const [
    ordersLast7Days,
    ordersLast30Days,
    ordersThisMonth,
    totalValue,
    readyToShipValue,
    inTransitValue,
    deliveredValue,
    outstandingCOD,
    codCollected,
    unpaidInvoiceCount,
    partiallyPaidInvoiceCount,
    overdueCODCount,
    overdueCODValue,
    deliveredButUnpaid,
    readyToShipAging,
    awaitingProcessingAging,
    fulfillmentSamples,
    todaysOrders
  ] = await Promise.all([
    prisma.salesOrder.count({
      where: {
        AND: [ecommerceFilter, { createdAt: { gte: sevenDaysAgo } }]
      }
    }),
    prisma.salesOrder.count({
      where: {
        AND: [ecommerceFilter, { createdAt: { gte: thirtyDaysAgo } }]
      }
    }),
    prisma.salesOrder.count({
      where: {
        AND: [ecommerceFilter, { createdAt: { gte: startOfMonth } }]
      }
    }),
    prisma.salesOrder.aggregate({
      _sum: { total: true },
      where: ecommerceFilter
    }),
    prisma.salesOrder.aggregate({
      _sum: { total: true },
      where: {
        AND: [ecommerceFilter, { status: 'READY_TO_SHIP' }]
      }
    }),
    prisma.salesOrder.aggregate({
      _sum: { total: true },
      where: {
        AND: [ecommerceFilter, { status: 'SHIPPED' }]
      }
    }),
    prisma.salesOrder.aggregate({
      _sum: { total: true },
      where: {
        AND: [ecommerceFilter, { status: { in: ['DELIVERED', 'COMPLETED'] } }]
      }
    }),
    prisma.invoice.aggregate({
      _sum: { amountDue: true },
      where: {
        lead: { source: 'ECOMMERCE' },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }
      }
    }),
    prisma.invoice.aggregate({
      _sum: { amountPaid: true },
      where: {
        lead: { source: 'ECOMMERCE' },
        paymentStatus: 'PAID'
      }
    }),
    prisma.invoice.count({
      where: {
        lead: { source: 'ECOMMERCE' },
        paymentStatus: 'UNPAID'
      }
    }),
    prisma.invoice.count({
      where: {
        lead: { source: 'ECOMMERCE' },
        paymentStatus: 'PARTIALLY_PAID'
      }
    }),
    prisma.invoice.count({
      where: {
        lead: { source: 'ECOMMERCE' },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: now }
      }
    }),
    prisma.invoice.aggregate({
      _sum: { amountDue: true },
      where: {
        lead: { source: 'ECOMMERCE' },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: now }
      }
    }),
    prisma.salesOrder.count({
      where: {
        AND: [
          ecommerceFilter,
          { status: { in: ['DELIVERED', 'COMPLETED'] } },
          {
            invoice: {
              paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }
            }
          }
        ]
      }
    }),
    prisma.salesOrder.findMany({
      where: {
        AND: [ecommerceFilter, { status: 'READY_TO_SHIP' }]
      },
      select: {
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      take: 25
    }),
    prisma.salesOrder.findMany({
      where: {
        AND: [ecommerceFilter, { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } }]
      },
      select: {
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      take: 25
    }),
    prisma.salesOrder.findMany({
      where: {
        AND: [
          ecommerceFilter,
          { status: { in: ['DELIVERED', 'COMPLETED'] } }
        ]
      },
      select: {
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    }),
    prisma.salesOrder.count({
      where: {
        AND: [
          ecommerceFilter,
          {
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
            }
          }
        ]
      }
    })
  ]);

  let averageFulfillmentHours = 0;
  if (fulfillmentSamples.length > 0) {
    const totalHours = fulfillmentSamples.reduce((sum, order) => {
      const diff = order.updatedAt.getTime() - order.createdAt.getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    averageFulfillmentHours = totalHours / fulfillmentSamples.length;
  }

  const totalOrders =
    statusCounts.reduce((sum, entry) => sum + entry.count, 0) || 0;

  const getStatusCount = (status: typeof statusList[number]) =>
    statusCounts.find((entry) => entry.status === status)?.count || 0;

  const readyToShipOrders = getStatusCount('READY_TO_SHIP');
  const shippedOrders = getStatusCount('SHIPPED');
  const deliveredOrders = getStatusCount('DELIVERED');
  const completedOrders = getStatusCount('COMPLETED');

  return {
    totalOrders,
    ordersByStatus: statusCounts.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.status] = entry.count;
      return acc;
    }, {}),
    pendingOrders: getStatusCount('PENDING'),
    confirmedOrders: getStatusCount('CONFIRMED'),
    processingOrders: getStatusCount('PROCESSING'),
    readyToShipOrders,
    shippedOrders,
    deliveredOrders,
    completedOrders,
    cancelledOrders: getStatusCount('CANCELLED'),
    awaitingDispatchOrders: readyToShipOrders + shippedOrders,
    ordersLast7Days,
    ordersLast30Days,
    ordersThisMonth,
    todaysOrders,
    totalOrderValue: Number(totalValue._sum.total || 0),
    readyToShipValue: Number(readyToShipValue._sum.total || 0),
    inTransitValue: Number(inTransitValue._sum.total || 0),
    deliveredValue: Number(deliveredValue._sum.total || 0),
    outstandingCodValue: Number(outstandingCOD._sum.amountDue || 0),
    collectedCodValue: Number(codCollected._sum.amountPaid || 0),
    unpaidInvoiceCount,
    partiallyPaidInvoiceCount,
    overdueCODCount,
    overdueCODValue: Number(overdueCODValue._sum.amountDue || 0),
    deliveredButUnpaid,
    readyToShipOldestHours: readyToShipAging.length
      ? Math.max(
          ...readyToShipAging.map((order) =>
            (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60)
          )
        )
      : 0,
    processingOldestHours: awaitingProcessingAging.length
      ? Math.max(
          ...awaitingProcessingAging.map((order) =>
            (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60)
          )
        )
      : 0,
    averageFulfillmentHours: Math.round(averageFulfillmentHours * 10) / 10,
    snapshotGeneratedAt: now.toISOString()
  };
}

async function getEcommerceCategoriesData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    categories,
    productCounts,
    activeCounts,
    newCounts,
    featuredConfigs,
  ] = await Promise.all([
    prisma.category.findMany({
      include: {
        ecommerceConfig: true,
      },
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { active: true },
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: { _all: true },
    }),
    prisma.ecommerceCategoryConfig.findMany({
      where: {
        isFeatured: true,
      },
      select: {
        categoryId: true,
        updatedAt: true,
      },
    }),
  ]);

  const productCountMap = new Map(
    productCounts.map((item) => [item.categoryId, item._count._all])
  );
  const activeCountMap = new Map(
    activeCounts.map((item) => [item.categoryId, item._count._all])
  );
  const newCountMap = new Map(
    newCounts.map((item) => [item.categoryId, item._count._all])
  );

  const totalCategories = categories.length;
  const categoriesWithConfig = categories.filter(
    (category) => category.ecommerceConfig !== null
  );
  const featuredCategoryIds = new Set(
    featuredConfigs.map((config) => config.categoryId)
  );

  const totals = {
    totalCategories,
    categoriesWithConfig: categoriesWithConfig.length,
    categoriesWithoutConfig: totalCategories - categoriesWithConfig.length,
    featuredCategories: categories.filter(
      (category) => category.ecommerceConfig?.isFeatured
    ).length,
    categoriesMissingTagline: categoriesWithConfig.filter(
      (category) => !category.ecommerceConfig?.marketingTagline
    ).length,
    categoriesMissingOpsNotes: categoriesWithConfig.filter(
      (category) => !category.ecommerceConfig?.opsNotes
    ).length,
    categoriesMissingAiPrompt: categoriesWithConfig.filter(
      (category) => !category.ecommerceConfig?.aiPrompt
    ).length,
    categoriesWithoutProducts: categories.filter(
      (category) => (productCountMap.get(category.id) ?? 0) === 0
    ).length,
    totalProducts: productCounts.reduce(
      (sum, item) => sum + item._count._all,
      0
    ),
    activeProducts: activeCounts.reduce(
      (sum, item) => sum + item._count._all,
      0
    ),
    newProductsLast30Days: newCounts.reduce(
      (sum, item) => sum + item._count._all,
      0
    ),
  };

  const topActiveCategories = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      activeProducts: activeCountMap.get(category.id) ?? 0,
      totalProducts: productCountMap.get(category.id) ?? 0,
      isFeatured: featuredCategoryIds.has(category.id),
    }))
    .filter((entry) => entry.totalProducts > 0)
    .sort((a, b) => b.activeProducts - a.activeProducts)
    .slice(0, 6);

  const categoriesNeedingInventory = categories
    .filter((category) => (productCountMap.get(category.id) ?? 0) === 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
    }))
    .slice(0, 5);

  const staleFeaturedCategories = featuredConfigs
    .filter((config) => config.updatedAt < ninetyDaysAgo)
    .map((config) => {
      const category = categories.find((item) => item.id === config.categoryId);
      return category
        ? {
            id: category.id,
            name: category.name,
            lastUpdated: config.updatedAt,
          }
        : null;
    })
    .filter((entry): entry is { id: string; name: string; lastUpdated: Date } =>
      Boolean(entry)
    );

  const recentlyUpdatedCategories = categories
    .filter((category) => category.ecommerceConfig?.updatedAt)
    .sort(
      (a, b) =>
        (b.ecommerceConfig?.updatedAt?.getTime() ?? 0) -
        (a.ecommerceConfig?.updatedAt?.getTime() ?? 0)
    )
    .slice(0, 6)
    .map((category) => ({
      id: category.id,
      name: category.name,
      updatedAt: category.ecommerceConfig?.updatedAt ?? null,
      isFeatured: category.ecommerceConfig?.isFeatured ?? false,
    }));

  return {
    snapshotGeneratedAt: now.toISOString(),
    totals,
    topActiveCategories,
    categoriesNeedingInventory,
    staleFeaturedCategories,
    recentlyUpdatedCategories,
  };
}

async function getEcommerceCustomersData() {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const ecommerceFilter = buildEcommerceSalesOrderFilter();

  const [
    totalCustomers,
    active30Days,
    active7Days,
    inactive90Days,
    outstandingCustomers,
    highRiskCustomers,
    totalOutstandingCod,
    totalCollectedCod,
    totalRevenue,
    returningCustomers,
    newCustomersThisMonth,
    topOutstandingCustomers,
    topValueCustomers,
    recentCustomers,
  ] = await Promise.all([
    prisma.account.count({
      where: {
        salesOrders: {
          some: ecommerceFilter,
        },
      },
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        },
      },
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        },
      },
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: ecommerceFilter,
        },
        AND: [
          {
            salesOrders: {
              none: {
                createdAt: {
                  gte: ninetyDaysAgo,
                },
                ...ecommerceFilter,
              },
            },
          },
        ],
      },
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            invoice: {
              paymentStatus: {
                in: ["UNPAID", "PARTIALLY_PAID"],
              },
            },
          },
        },
      },
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            invoice: {
              paymentStatus: {
                in: ["UNPAID", "PARTIALLY_PAID"],
              },
              dueDate: {
                lt: now,
              },
            },
          },
        },
      },
    }),
    prisma.invoice.aggregate({
      _sum: {
        amountDue: true,
      },
      where: {
        lead: {
          source: "ECOMMERCE",
        },
        paymentStatus: {
          in: ["UNPAID", "PARTIALLY_PAID"],
        },
      },
    }),
    prisma.invoice.aggregate({
      _sum: {
        amountPaid: true,
      },
      where: {
        lead: {
          source: "ECOMMERCE",
        },
        paymentStatus: "PAID",
      },
    }),
    prisma.salesOrder.aggregate({
      _sum: {
        total: true,
      },
      where: ecommerceFilter,
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: ecommerceFilter,
        },
        AND: [
          {
            salesOrders: {
              some: {
                ...ecommerceFilter,
                status: {
                  in: ["DELIVERED", "COMPLETED"],
                },
              },
            },
          },
          {
            salesOrders: {
              some: {
                ...ecommerceFilter,
                createdAt: {
                  lt: thirtyDaysAgo,
                },
              },
            },
          },
        ],
      },
    }),
    prisma.account.count({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            createdAt: {
              gte: startOfMonth,
            },
          },
        },
      },
    }),
    prisma.account.findMany({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            invoice: {
              paymentStatus: {
                in: ["UNPAID", "PARTIALLY_PAID"],
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        salesOrders: {
          where: ecommerceFilter,
          select: {
            total: true,
            invoice: {
              select: {
                amountDue: true,
              },
            },
          },
        },
      },
      take: 5,
    }),
    prisma.account.findMany({
      where: {
        salesOrders: {
          some: ecommerceFilter,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        salesOrders: {
          where: ecommerceFilter,
          select: {
            total: true,
          },
        },
      },
      take: 5,
    }),
    prisma.account.findMany({
      where: {
        salesOrders: {
          some: {
            ...ecommerceFilter,
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);

  const outstandingCodValue = Number(totalOutstandingCod._sum.amountDue || 0);
  const collectedCodValue = Number(totalCollectedCod._sum.amountPaid || 0);
  const lifetimeValue = Number(totalRevenue._sum.total || 0);

  const topOutstanding = topOutstandingCustomers
    .map((account) => {
      const outstanding = account.salesOrders.reduce((sum, order) => {
        const due = Number(order.invoice?.amountDue || 0);
        return sum + due;
      }, 0);
      return {
        id: account.id,
        name: account.name || "Unnamed",
        email: account.email,
        outstanding,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);

  const topValue = topValueCustomers
    .map((account) => {
      const total = account.salesOrders.reduce((sum, order) => {
        return sum + Number(order.total || 0);
      }, 0);
      return {
        id: account.id,
        name: account.name || "Unnamed",
        email: account.email,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    totalCustomers,
    active30Days,
    active7Days,
    inactive90Days,
    outstandingCustomers,
    highRiskCustomers,
    outstandingCodValue,
    collectedCodValue,
    lifetimeValue,
    returningCustomers,
    newCustomersThisMonth,
    topOutstandingCustomers: topOutstanding,
    topValueCustomers: topValue,
    recentCustomers,
  };
}

async function getPaymentsData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const [
    totalPayments,
    paymentsLast30Days,
    paymentsThisMonth,
    paymentsLastMonth,
    totalPaymentAmount,
    thisMonthAmount,
    lastMonthAmount,
    paymentsByMethod,
    averagePaymentAmount,
    unpaidInvoices,
    overdueInvoices,
    overdueAmount
  ] = await Promise.all([
    prisma.payment.count(),
    prisma.payment.count({ where: { receivedAt: { gte: thirtyDaysAgo } } }),
    prisma.payment.count({ where: { receivedAt: { gte: startOfMonth } } }),
    prisma.payment.count({ 
      where: { 
        receivedAt: { 
          gte: startOfLastMonth,
          lte: endOfLastMonth
        } 
      } 
    }),
    prisma.payment.aggregate({
      _sum: { amount: true }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { receivedAt: { gte: startOfMonth } }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { 
        receivedAt: { 
          gte: startOfLastMonth,
          lte: endOfLastMonth
        } 
      }
    }),
    prisma.payment.groupBy({
      by: ['method'],
      _count: true,
      _sum: { amount: true }
    }),
    prisma.payment.aggregate({
      _avg: { amount: true }
    }),
    prisma.invoice.count({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }
      }
    }),
    prisma.invoice.count({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: now }
      }
    }),
    prisma.invoice.aggregate({
      _sum: { amountDue: true },
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: now }
      }
    })
  ]);

  return {
    totalPayments,
    paymentsLast30Days,
    paymentsThisMonth,
    paymentsLastMonth,
    totalPaymentAmount: totalPaymentAmount._sum.amount || 0,
    thisMonthAmount: thisMonthAmount._sum.amount || 0,
    lastMonthAmount: lastMonthAmount._sum.amount || 0,
    paymentsByMethod,
    averagePaymentAmount: averagePaymentAmount._avg.amount || 0,
    unpaidInvoices,
    overdueInvoices,
    overdueAmount: overdueAmount._sum.amountDue || 0
  };
}

async function getReturnsData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [
    totalReturns,
    pendingReturns,
    approvedReturns,
    completedReturns,
    rejectedReturns,
    returnsLast30Days,
    returnsThisMonth,
    totalReturnValue,
    pendingValue,
    refundedValue,
    returnsByReason,
    averageProcessingTime,
    topReturnReasons
  ] = await Promise.all([
    prisma.return.count(),
    prisma.return.count({ where: { status: 'PENDING' } }),
    prisma.return.count({ where: { status: 'APPROVED' } }),
    prisma.return.count({ where: { status: 'COMPLETED' } }),
    prisma.return.count({ where: { status: 'REJECTED' } }),
    prisma.return.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.return.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.return.aggregate({
      _sum: { total: true }
    }),
    prisma.return.aggregate({
      _sum: { total: true },
      where: { status: 'PENDING' }
    }),
    prisma.return.aggregate({
      _sum: { refundAmount: true },
      where: { status: 'COMPLETED' }
    }),
    prisma.return.groupBy({
      by: ['reason'],
      _count: true,
      _sum: { total: true }
    }),
    // Calculate average processing time (time from PENDING to COMPLETED)
    prisma.return.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        createdAt: true,
        completedAt: true
      }
    }),
    // Get top return reasons
    prisma.return.groupBy({
      by: ['reason'],
      _count: true,
      orderBy: { _count: { reason: 'desc' } },
      take: 5
    })
  ]);

  // Calculate average processing time
  let avgProcessingDays = 0;
  if (averageProcessingTime.length > 0) {
    const totalDays = averageProcessingTime.reduce((sum, ret) => {
      if (ret.completedAt) {
        const days = Math.floor((ret.completedAt.getTime() - ret.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }
      return sum;
    }, 0);
    avgProcessingDays = totalDays / averageProcessingTime.length;
  }

  return {
    totalReturns,
    pendingReturns,
    approvedReturns,
    completedReturns,
    rejectedReturns,
    returnsLast30Days,
    returnsThisMonth,
    totalReturnValue: totalReturnValue._sum.total || 0,
    pendingValue: pendingValue._sum.total || 0,
    refundedValue: refundedValue._sum.refundAmount || 0,
    returnsByReason,
    averageProcessingDays: Math.round(avgProcessingDays * 10) / 10,
    topReturnReasons
  };
}

async function getReportsData() {
  const [invoices, payments, orders] = await Promise.all([
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.order.count()
  ]);

  return { invoices, payments, orders };
}

async function getContactsData() {
  const [total, withEmail, withPhone] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { email: { not: null } } }),
    prisma.contact.count({ where: { phone: { not: null } } })
  ]);

  // Get account type breakdown
  const contacts = await prisma.contact.findMany({
    select: { accountId: true },
    take: 1000
  });

  const accountIds = contacts.map(c => c.accountId).filter(Boolean);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { type: true }
  });

  const byAccountType = {
    INDIVIDUAL: accounts.filter(a => a.type === 'INDIVIDUAL').length,
    COMPANY: accounts.filter(a => a.type === 'COMPANY').length,
    PROJECT: accounts.filter(a => a.type === 'PROJECT').length
  };

  // Get contacts without email or phone
  const contactsWithoutEmail = total - withEmail;
  const contactsWithoutPhone = total - withPhone;

  // Get recent contacts (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentContacts = await prisma.contact.count({
    where: { createdAt: { gte: thirtyDaysAgo } }
  });

  return {
    total,
    withEmail,
    withPhone,
    contactsWithoutEmail,
    contactsWithoutPhone,
    byAccountType,
    recentContacts
  };
}

async function getDistributorLeadsData() {
  const [total, pending, underReview, approved, rejected] = await Promise.all([
    prisma.distributorLead.count(),
    prisma.distributorLead.count({ where: { status: 'PENDING' } }),
    prisma.distributorLead.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.distributorLead.count({ where: { status: 'APPROVED' } }),
    prisma.distributorLead.count({ where: { status: 'REJECTED' } })
  ]);

  // Get pending leads older than 5 days
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const pendingOver5Days = await prisma.distributorLead.count({
    where: {
      status: 'PENDING',
      createdAt: { lte: fiveDaysAgo }
    }
  });

  // Get recent leads (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentLeads = await prisma.distributorLead.count({
    where: { createdAt: { gte: thirtyDaysAgo } }
  });

  // Calculate average processing time (for approved leads)
  // Note: DistributorLead doesn't have approvedAt field, using updatedAt as proxy
  const approvedLeads = await prisma.distributorLead.findMany({
    where: { status: 'APPROVED' },
    select: { createdAt: true, updatedAt: true },
    take: 100
  });

  let totalProcessingDays = 0;
  let processedCount = 0;
  approvedLeads.forEach(lead => {
    // Use updatedAt as proxy for approval date (when status changed to APPROVED)
    const processingTime = (new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    totalProcessingDays += processingTime;
    processedCount++;
  });

  const averageProcessingDays = processedCount > 0 ? totalProcessingDays / processedCount : 0;

  return {
    total,
    pending,
    underReview,
    approved,
    rejected,
    pendingOver5Days,
    recentLeads,
    averageProcessingDays: Math.round(averageProcessingDays * 10) / 10
  };
}

async function getRoutesMappingData() {
  const [zones, routes, drivers] = await Promise.all([
    prisma.zone.count(),
    prisma.route.count(),
    prisma.driver.count()
  ]);

  // Get active zones
  const activeZones = await prisma.zone.count({
    where: { isActive: true }
  });

  // Get active drivers
  const activeDrivers = await prisma.driver.count({
    where: { isActive: true }
  });

  // Get route status breakdown
  const [planned, inProgress, completed, cancelled] = await Promise.all([
    prisma.route.count({ where: { status: 'PLANNED' } }),
    prisma.route.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.route.count({ where: { status: 'COMPLETED' } }),
    prisma.route.count({ where: { status: 'CANCELLED' } })
  ]);

  // Get routes with drivers
  const routesWithDrivers = await prisma.route.count({
    where: { driverId: { not: null } }
  });

  // Get routes without drivers
  const routesWithoutDrivers = routes - routesWithDrivers;

  // Get zones with distributors
  const zonesWithDistributors = await prisma.zone.count({
    where: {
      distributors: {
        some: {}
      }
    }
  });

  // Get recent routes (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRoutes = await prisma.route.count({
    where: { createdAt: { gte: thirtyDaysAgo } }
  });

  return {
    zones,
    activeZones,
    routes,
    planned,
    inProgress,
    completed,
    cancelled,
    routesWithDrivers,
    routesWithoutDrivers,
    drivers,
    activeDrivers,
    zonesWithDistributors,
    recentRoutes
  };
}

function createFallbackRecommendations(aiText: string) {
  // Extract recommendations from AI text if JSON parsing failed
  // Try to parse structured recommendations from text
  const recommendations = [];
  
  // Try to extract JSON-like structures in text (title: "...", description: "...")
  const titleDescPattern = /(?:title|name)[:"]\s*["']?([^"'\n]+)["']?/gi;
  const titleMatches = [...aiText.matchAll(titleDescPattern)];
  
  if (titleMatches.length > 0) {
    let currentIndex = 0;
    for (let i = 0; i < Math.min(5, titleMatches.length); i++) {
      const titleMatch = titleMatches[i];
      const title = titleMatch[1].trim();
      
      // Find description after this title
      const afterTitle = aiText.substring(titleMatch.index! + titleMatch[0].length);
      const descMatch = afterTitle.match(/(?:description|details?)[:"]\s*["']?([^"'\n]+)["']?/i);
      const description = descMatch ? descMatch[1].trim() : title;
      
      if (title && title.length > 3) {
        recommendations.push({
          title: title.substring(0, 60),
          description: (description || title).substring(0, 150),
          priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
          action: 'Review and implement'
        });
        currentIndex++;
      }
    }
  }
  
  // Try to extract numbered recommendations (1., 2., 3., etc.)
  if (recommendations.length === 0) {
    const numberedPattern = /(\d+)[\.\)]\s*(.+?)(?=\d+[\.\)]|$)/g;
    const numberedMatches = [...aiText.matchAll(numberedPattern)];
    
    if (numberedMatches.length > 0) {
      for (let i = 0; i < Math.min(5, numberedMatches.length); i++) {
        const match = numberedMatches[i];
        const text = match[2].trim();
        
        // Try to extract title and description
        const lines = text.split('\n').filter(l => l.trim());
        let title = '';
        let description = '';
        
        if (lines.length > 0) {
          // First line is usually the title
          title = lines[0].trim();
          // Remove common prefixes
          title = title.replace(/^[-•*]\s*/, '').replace(/^Title:\s*/i, '').replace(/^["']|["']$/g, '').trim();
          // Limit title length
          if (title.length > 60) {
            title = title.substring(0, 57) + '...';
          }
          
          // Rest of the text is description
          description = lines.slice(1).join(' ').trim() || title;
          // Remove common prefixes
          description = description.replace(/^[-•*]\s*/, '').replace(/^Description:\s*/i, '').replace(/^["']|["']$/g, '').trim();
          // Limit description length
          if (description.length > 150) {
            description = description.substring(0, 147) + '...';
          }
        } else {
          // Fallback: use the whole text, split at first period or comma
          const titleMatch = text.match(/^(.+?)[\.:]/);
          title = titleMatch ? titleMatch[1].trim() : text.substring(0, 60).trim();
          description = text.length > title.length ? text.substring(title.length).trim() : text;
        }
        
        // Only add if title is meaningful (not "AI Insight" or similar)
        if (title && title.length > 3 && !title.match(/^(ai\s+)?insight\s*\d+$/i) && !title.match(/^recommendation\s*\d+$/i)) {
          recommendations.push({
            title: title,
            description: description || title || 'No description available',
            priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
            action: 'Review and implement'
          });
        }
      }
    }
  }
  
  // If no numbered recommendations found, try to extract from bullet points
  if (recommendations.length === 0) {
    const bulletPattern = /[-•*]\s*(.+?)(?=[-•*]|$)/g;
    const bulletMatches = [...aiText.matchAll(bulletPattern)];
    
    for (let i = 0; i < Math.min(5, bulletMatches.length); i++) {
      const match = bulletMatches[i];
      const text = match[1].trim();
      
      // Extract title (first sentence or first 60 chars)
      const titleMatch = text.match(/^(.+?)(?:\.|$)/);
      let title = titleMatch ? titleMatch[1].trim() : text.substring(0, 60);
      if (title.length > 60) {
        title = title.substring(0, 57) + '...';
      }
      
      const description = text.length > 60 ? text.substring(0, 150) : text;
      
      // Only add if title is meaningful
      if (title && title.length > 3 && !title.match(/^(ai\s+)?insight\s*\d+$/i) && !title.match(/^recommendation\s*\d+$/i)) {
        recommendations.push({
          title: title,
          description: description || title || 'No description available',
          priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
          action: 'Review and implement'
        });
      }
    }
  }
  
  // Final fallback: split by paragraphs
  if (recommendations.length === 0) {
    const paragraphs = aiText.split(/\n\s*\n/).filter(p => p.trim());
    for (let i = 0; i < Math.min(5, paragraphs.length); i++) {
      const para = paragraphs[i].trim();
      const lines = para.split('\n').filter(l => l.trim());
      const firstLine = lines[0] || para;
      const title = firstLine.substring(0, 60).trim();
      const description = para.substring(0, 150).trim();
      
      // Only add if title is meaningful
      if (title && title.length > 3 && !title.match(/^(ai\s+)?insight\s*\d+$/i) && !title.match(/^recommendation\s*\d+$/i)) {
        recommendations.push({
          title: title,
          description: description || title || 'No description available',
          priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
          action: 'Review and implement'
        });
      }
    }
  }
  
  return recommendations;
}

function createDefaultRecommendations(page: string, count: number) {
  const defaultRecs = {
    'dashboard': [
      { title: 'Follow up on pending quotations', description: 'Review and follow up on pending quotations to convert them to sales', priority: 'high', action: 'Contact prospects' },
      { title: 'Collect overdue invoices', description: 'Reach out to customers with overdue invoices to improve cash flow', priority: 'high', action: 'Send payment reminders' },
      { title: 'Close open opportunities', description: 'Focus on high-value opportunities to accelerate revenue', priority: 'high', action: 'Schedule sales calls' },
      { title: 'Restock low inventory items', description: 'Order products that are running low to prevent stockouts', priority: 'medium', action: 'Create purchase orders' },
      { title: 'Follow up with new leads', description: 'Contact new leads quickly to improve conversion rates', priority: 'medium', action: 'Call new leads' }
    ],
    'crm-dashboard': [
      { title: 'Follow up leads', description: 'Contact new leads within 24 hours', priority: 'high', action: 'Call leads' },
      { title: 'Update opportunities', description: 'Review and update opportunity stages', priority: 'medium', action: 'Update pipeline' },
      { title: 'Analyze conversion', description: 'Review lead to opportunity conversion rates', priority: 'low', action: 'Generate report' }
    ],
    'opportunities': [
      { title: 'Close deals', description: 'Focus on high-value opportunities', priority: 'high', action: 'Schedule calls' },
      { title: 'Update pipeline', description: 'Review opportunity stages and probabilities', priority: 'medium', action: 'Update stages' },
      { title: 'Follow up', description: 'Contact prospects with pending quotes', priority: 'low', action: 'Send emails' }
    ],
    'products': [
      { title: 'Restock items', description: 'Order low-stock products', priority: 'high', action: 'Create purchase orders' },
      { title: 'Update pricing', description: 'Review and adjust product pricing', priority: 'medium', action: 'Update prices' },
      { title: 'Add products', description: 'Expand product catalog', priority: 'low', action: 'Add new items' }
    ],
    'ecommerce-orders': [
      { title: 'Schedule delivery batches', description: 'Assign riders for ready-to-ship ecommerce orders and confirm delivery routes.', priority: 'high', action: 'Plan delivery runs' },
      { title: 'Chase COD balances', description: 'Follow up on delivered ecommerce orders with outstanding COD balances to accelerate cash collection.', priority: 'high', action: 'Call customers / riders' },
      { title: 'Update customer notifications', description: 'Send status updates to customers with orders still processing to reduce cancellations.', priority: 'medium', action: 'Send SMS/email updates' }
    ],
    'ecommerce-customers': [
      { title: 'Call top COD risks', description: 'Focus on ecommerce customers with overdue COD balances to secure payment.', priority: 'high', action: 'Call high-risk customers' },
      { title: 'Offer retention perks', description: 'Send personalized offers to recent ecommerce customers to encourage repeat orders.', priority: 'medium', action: 'Send retention campaign' },
      { title: 'Update contact details', description: 'Verify phone and email details for ecommerce customers flagged with failed deliveries.', priority: 'medium', action: 'Confirm customer info' }
    ],
    'tasks': [
      { title: 'Complete overdue tasks', description: 'Review and complete tasks that are past their due date to improve workflow efficiency', priority: 'high', action: 'Update task status' },
      { title: 'Set task priorities', description: 'Assign priority levels to tasks to focus on important work and improve completion rates', priority: 'medium', action: 'Update priorities' },
      { title: 'Review task assignments', description: 'Ensure tasks are properly assigned to team members for better task management', priority: 'low', action: 'Reassign tasks' },
      { title: 'Add due dates to tasks', description: 'Set due dates for tasks without deadlines to improve deadline adherence', priority: 'medium', action: 'Set due dates' },
      { title: 'Address high priority tasks', description: 'Focus on urgent and high priority tasks to prevent bottlenecks', priority: 'high', action: 'Prioritize tasks' }
    ]
  };

  const pageRecs = defaultRecs[page as keyof typeof defaultRecs] || defaultRecs['crm-dashboard'];
  return pageRecs.slice(0, count);
}

async function getSpecificLeadData(leadId: string) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Fetch the specific lead with all related data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tasks: {
          where: { status: { not: 'COMPLETED' } },
          include: { assignee: { select: { id: true, name: true } } }
        },
        comments: { orderBy: { createdAt: 'desc' }, take: 10 },
        files: { orderBy: { uploadedAt: 'desc' }, take: 10 },
        emails: { orderBy: { sentAt: 'desc' }, take: 10 },
        sms: { orderBy: { sentAt: 'desc' }, take: 10 },
        meetings: { orderBy: { createdAt: 'desc' }, take: 10 },
        products: { include: { product: true } },
        opportunities: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lead) {
      return { error: 'Lead not found' };
    }

    // Calculate days since creation
    const createdAt = new Date(lead.createdAt);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate last contact date
    const lastEmail = lead.emails?.[0]?.sentAt;
    const lastSMS = lead.sms?.[0]?.sentAt;
    const lastActivity = lead.updatedAt;
    const lastContactDate = lastEmail || lastSMS || lastActivity || null;
    const lastContactDaysAgo = lastContactDate 
      ? Math.floor((now.getTime() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Check if follow-up is overdue
    const followUpDate = lead.followUpDate ? new Date(lead.followUpDate) : null;
    // Check if follow-up is overdue (exclude converted and lost leads)
    const isConverted = ['CONVERTED_TO_OPPORTUNITY', 'QUOTE_SENT', 'CONVERTED', 'OPPORTUNITY', 'NEW_OPPORTUNITY'].includes(lead.status);
    const hasOverdueFollowUp = followUpDate && followUpDate < now && !isConverted && lead.status !== 'LOST';

    // Get assigned users
    let assignedToNames = 'Unassigned';
    try {
      const assignedTo = lead.assignedTo ? JSON.parse(lead.assignedTo as string) : null;
      if (Array.isArray(assignedTo) && assignedTo.length > 0) {
        const userNames = await Promise.all(
          assignedTo.map(async (userId: string) => {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            return user?.name || userId;
          })
        );
        assignedToNames = userNames.join(', ');
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Count tasks
    const totalTasks = lead.tasks?.length || 0;
    const pendingTasks = lead.tasks?.filter((t: any) => t.status !== 'COMPLETED').length || 0;
    const overdueTasks = lead.tasks?.filter((t: any) => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < now && t.status !== 'COMPLETED';
    }).length || 0;

    // Calculate opportunities value
    const opportunitiesValue = lead.opportunities?.reduce((sum: number, opp: any) => {
      return sum + (opp.value || 0);
    }, 0) || 0;

    // Count recent activities (last 7 days)
    const recentActivitiesCount = [
      ...(lead.emails?.filter((e: any) => e.sentAt && new Date(e.sentAt) >= sevenDaysAgo) || []),
      ...(lead.sms?.filter((s: any) => s.sentAt && new Date(s.sentAt) >= sevenDaysAgo) || []),
      ...(lead.meetings?.filter((m: any) => new Date(m.createdAt) >= sevenDaysAgo) || []),
      ...(lead.comments?.filter((c: any) => new Date(c.createdAt) >= sevenDaysAgo) || []),
      ...(lead.files?.filter((f: any) => new Date(f.uploadedAt) >= sevenDaysAgo) || [])
    ].length;

    return {
      // Lead basic info
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company || null,
      status: lead.status,
      source: lead.source || null,
      createdAt: lead.createdAt.toISOString(),
      daysSinceCreation,
      lastContactDate: lastContactDate ? new Date(lastContactDate).toISOString() : null,
      lastContactDaysAgo,
      followUpDate: followUpDate ? followUpDate.toISOString() : null,
      hasOverdueFollowUp,
      assignedToNames,
      
      // Activity counts
      productInterestsCount: lead.products?.length || 0,
      hasOpportunities: (lead.opportunities?.length || 0) > 0,
      opportunitiesValue,
      recentActivitiesCount,
      totalTasks,
      pendingTasks,
      overdueTasks,
      commentsCount: lead.comments?.length || 0,
      filesCount: lead.files?.length || 0,
      emailsCount: lead.emails?.length || 0,
      smsCount: lead.sms?.length || 0,
      meetingsCount: lead.meetings?.length || 0,
      
      // Related data
      ownerName: lead.owner?.name || 'Unassigned'
    };
  } catch (error) {
    console.error('Error fetching specific lead data:', error);
    return { error: 'Failed to fetch lead data' };
  }
}

async function getAccountsData(userId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const [
    // Total counts
    total,
    companies,
    individuals,
    projects,
    // Contacts
    accountsWithContacts,
    accountsWithoutContacts,
    // Opportunities
    accountsWithOpportunities,
    accountsWithoutOpportunities,
    totalOpportunities,
    openOpportunities,
    wonOpportunities,
    openOpportunitiesValue,
    wonOpportunitiesValue,
    // Quotations
    totalQuotations,
    pendingQuotations,
    acceptedQuotations,
    // Invoices
    totalInvoices,
    unpaidInvoices,
    overdueInvoices,
    // Revenue
    totalRevenue,
    // Activity
    activeAccounts30Days,
    inactiveAccounts90Days
  ] = await Promise.all([
    // Total counts
    prisma.account.count(),
    prisma.account.count({ where: { type: 'COMPANY' } }),
    prisma.account.count({ where: { type: 'INDIVIDUAL' } }),
    prisma.account.count({ where: { type: 'PROJECT' } }),
    // Accounts with contacts
    prisma.account.count({
      where: {
        contacts: { some: {} }
      }
    }),
    prisma.account.count({
      where: {
        contacts: { none: {} }
      }
    }),
    // Accounts with opportunities
    prisma.account.count({
      where: {
        opportunities: { some: {} }
      }
    }),
    prisma.account.count({
      where: {
        opportunities: { none: {} }
      }
    }),
    // Opportunities
    prisma.opportunity.count({ where: { ownerId: userId } }),
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        stage: { notIn: ['WON', 'LOST'] }
      }
    }),
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        stage: 'WON'
      }
    }),
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: {
        ownerId: userId,
        stage: { notIn: ['WON', 'LOST'] },
        value: { not: null }
      }
    }),
    prisma.opportunity.aggregate({
      _sum: { value: true },
      where: {
        ownerId: userId,
        stage: 'WON',
        value: { not: null }
      }
    }),
    // Quotations
    prisma.quotation.count(),
    prisma.quotation.count({
      where: {
        status: { in: ['DRAFT', 'SENT'] }
      }
    }),
    prisma.quotation.count({
      where: {
        status: 'ACCEPTED'
      }
    }),
    // Invoices
    prisma.invoice.count(),
    prisma.invoice.count({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }
      }
    }),
    prisma.invoice.count({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: now }
      }
    }),
    // Revenue
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID'
      }
    }),
    // Active accounts (have activity in last 30 days)
    prisma.account.count({
      where: {
        OR: [
          { opportunities: { some: { updatedAt: { gte: thirtyDaysAgo } } } },
          { quotations: { some: { updatedAt: { gte: thirtyDaysAgo } } } },
          { invoices: { some: { updatedAt: { gte: thirtyDaysAgo } } } }
        ]
      }
    }),
    // Inactive accounts (no activity in last 90 days)
    prisma.account.count({
      where: {
        AND: [
          { opportunities: { none: { updatedAt: { gte: ninetyDaysAgo } } } },
          { quotations: { none: { updatedAt: { gte: ninetyDaysAgo } } } },
          { invoices: { none: { updatedAt: { gte: ninetyDaysAgo } } } }
        ]
      }
    })
  ]);

  return {
    total,
    companies,
    individuals,
    projects,
    accountsWithContacts,
    accountsWithoutContacts,
    accountsWithOpportunities,
    accountsWithoutOpportunities,
    totalOpportunities,
    openOpportunities,
    wonOpportunities,
    openOpportunitiesValue: openOpportunitiesValue._sum.value || 0,
    wonOpportunitiesValue: wonOpportunitiesValue._sum.value || 0,
    totalQuotations,
    pendingQuotations,
    acceptedQuotations,
    totalInvoices,
    unpaidInvoices,
    overdueInvoices,
    totalRevenue: totalRevenue._sum.total || 0,
    activeAccounts30Days,
    inactiveAccounts90Days
  };
}

async function getSpecificAccountData(accountId: string) {
  try {
    console.log(`🔍 getSpecificAccountData: Fetching account data for accountId: ${accountId}`);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Fetch the specific account with all related data
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        contacts: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        opportunities: {
          orderBy: { createdAt: 'desc' }
        },
        quotations: {
          include: { lines: true },
          orderBy: { createdAt: 'desc' }
        },
        invoices: {
          include: { lines: true },
          orderBy: { createdAt: 'desc' }
        },
        tasks: {
          where: { status: { not: 'COMPLETED' } },
          include: { assignee: { select: { id: true, name: true } } }
        }
      }
    });

    if (!account) {
      console.error(`❌ getSpecificAccountData: Account not found for id: ${accountId}`);
      return { error: 'Account not found' };
    }

    console.log(`✅ getSpecificAccountData: Account found - ${account.name}, Opportunities: ${account.opportunities?.length || 0}, Quotations: ${account.quotations?.length || 0}, Invoices: ${account.invoices?.length || 0}`);

    // Calculate days since creation
    const createdAt = new Date(account.createdAt);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Count opportunities
    const opportunitiesCount = account.opportunities?.length || 0;
    const openOpportunities = account.opportunities?.filter((o: any) => o.stage !== 'WON' && o.stage !== 'LOST').length || 0;
    const wonOpportunities = account.opportunities?.filter((o: any) => o.stage === 'WON').length || 0;
    const opportunitiesValue = account.opportunities?.reduce((sum: number, o: any) => sum + (o.value || 0), 0) || 0;
    const openOpportunitiesValue = account.opportunities?.filter((o: any) => o.stage !== 'WON' && o.stage !== 'LOST').reduce((sum: number, o: any) => sum + (o.value || 0), 0) || 0;

    // Count quotations
    const quotationsCount = account.quotations?.length || 0;
    const pendingQuotations = account.quotations?.filter((q: any) => q.status === 'DRAFT' || q.status === 'SENT').length || 0;
    const acceptedQuotations = account.quotations?.filter((q: any) => q.status === 'ACCEPTED').length || 0;

    // Count invoices
    const invoicesCount = account.invoices?.length || 0;
    const unpaidInvoices = account.invoices?.filter((i: any) => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIALLY_PAID').length || 0;
    const overdueInvoices = account.invoices?.filter((i: any) => {
      if (!i.dueDate) return false;
      return i.paymentStatus !== 'PAID' && new Date(i.dueDate) < now;
    }).length || 0;

    // Calculate revenue
    const totalRevenue = account.invoices?.filter((i: any) => i.paymentStatus === 'PAID').reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0;

    // Count recent activity
    const recentOpportunities = account.opportunities?.filter((o: any) => new Date(o.createdAt) >= thirtyDaysAgo).length || 0;
    const recentQuotations = account.quotations?.filter((q: any) => new Date(q.createdAt) >= thirtyDaysAgo).length || 0;

    // Count tasks
    const totalTasks = account.tasks?.length || 0;
    const pendingTasks = account.tasks?.filter((t: any) => t.status !== 'COMPLETED').length || 0;
    const overdueTasks = account.tasks?.filter((t: any) => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < now && t.status !== 'COMPLETED';
    }).length || 0;

    return {
      // Account basic info
      id: account.id,
      name: account.name,
      type: account.type,
      createdAt: account.createdAt.toISOString(),
      daysSinceCreation,
      ownerName: account.owner?.name || 'Unassigned',
      
      // Related data
      contactsCount: account.contacts?.length || 0,
      opportunitiesCount,
      openOpportunities,
      wonOpportunities,
      opportunitiesValue,
      openOpportunitiesValue,
      quotationsCount,
      pendingQuotations,
      acceptedQuotations,
      invoicesCount,
      unpaidInvoices,
      overdueInvoices,
      totalRevenue,
      recentOpportunities,
      recentQuotations,
      totalTasks,
      pendingTasks,
      overdueTasks
    };
  } catch (error) {
    console.error('Error fetching specific account data:', error);
    return { error: 'Failed to fetch account data' };
  }
}

async function getSpecificOpportunityData(opportunityId: string) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Fetch the specific opportunity with all related data
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        account: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
        quotations: {
          include: { lines: true },
          orderBy: { createdAt: 'desc' }
        },
        invoices: {
          include: { lines: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!opportunity) {
      return { error: 'Opportunity not found' };
    }

    // Get tasks for this opportunity (from related lead if exists, or from account)
    const relatedTasksCount = await prisma.task.count({
      where: {
        OR: [
          { leadId: opportunity.leadId || undefined },
          { accountId: opportunity.accountId }
        ],
        status: { not: 'COMPLETED' }
      }
    });

    // Calculate days since creation
    const createdAt = new Date(opportunity.createdAt);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate days in current stage
    const updatedAt = new Date(opportunity.updatedAt);
    const daysInCurrentStage = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate days until close
    const closeDate = opportunity.closeDate ? new Date(opportunity.closeDate) : null;
    const daysUntilClose = closeDate ? Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const isOverdueCloseDate = closeDate && closeDate < now && opportunity.stage !== 'WON' && opportunity.stage !== 'LOST';

    // Count quotations
    const quotationsCount = opportunity.quotations?.length || 0;
    const acceptedQuotations = opportunity.quotations?.filter((q: any) => q.status === 'ACCEPTED').length || 0;

    // Count invoices
    const invoicesCount = opportunity.invoices?.length || 0;
    const paidInvoices = opportunity.invoices?.filter((i: any) => i.paymentStatus === 'PAID').length || 0;

    return {
      // Opportunity basic info
      id: opportunity.id,
      name: opportunity.name || `${opportunity.account?.name || 'Unknown'} Opportunity`,
      accountName: opportunity.account?.name || null,
      stage: opportunity.stage,
      value: opportunity.value || 0,
      probability: opportunity.probability || 0,
      closeDate: closeDate ? closeDate.toISOString() : null,
      daysUntilClose,
      isOverdueCloseDate,
      createdAt: opportunity.createdAt.toISOString(),
      daysSinceCreation,
      daysInCurrentStage,
      ownerName: opportunity.owner?.name || 'Unassigned',
      fromLead: !!opportunity.lead,
      
      // Related data
      quotationsCount,
      acceptedQuotations,
      invoicesCount,
      paidInvoices,
      recentActivitiesCount: 0, // Opportunities don't have direct activity tracking
      totalTasks: relatedTasksCount,
      pendingTasks: relatedTasksCount,
      overdueTasks: 0,
      commentsCount: 0, // Opportunities don't have direct comments
      filesCount: 0, // Opportunities don't have direct files
      
      // Additional context
      leadName: opportunity.lead ? `${opportunity.lead.firstName} ${opportunity.lead.lastName}` : null,
      leadCompany: opportunity.lead?.company || null
    };
  } catch (error) {
    console.error('Error fetching specific opportunity data:', error);
    return { error: 'Failed to fetch opportunity data' };
  }
}
