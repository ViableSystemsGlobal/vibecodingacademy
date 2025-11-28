import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AIService, BUSINESS_ANALYST_PROMPT } from '@/lib/ai-service';
import { getCompanyName } from '@/lib/payment-order-notifications';

// AI Query Processor - Truly conversational AI powered by GPT
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 AI Chat API: Request received');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('❌ AI Chat API: Unauthorized - No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationHistory } = await request.json();
    console.log('📝 AI Chat API: Message:', message);

    if (!message) {
      console.error('❌ AI Chat API: No message provided');
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Get AI settings from database
    const aiSettings = await prisma.systemSettings.findMany({
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
            'ai_max_tokens'
          ]
        }
      }
    });

    const settingsMap = aiSettings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    // Check if AI is enabled
    if (settingsMap.ai_enabled === 'false') {
      return NextResponse.json({
        success: true,
        response: {
          text: "Strategic Business Partner (Jayne) is currently disabled. Please enable it in Settings > AI Settings.",
          chart: null
        }
      });
    }

    const provider = settingsMap.ai_provider || 'openai';
    const apiKey = settingsMap[`ai_${provider}_api_key`];
    
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        response: {
          text: `⚠️ No API key configured for ${provider}. Please add your ${provider} API key in Settings > AI Settings to enable AI-powered conversations.`,
          chart: null
        }
      });
    }

    // Get company name from settings
    const companyName = await getCompanyName() || 'AdPools Group';
    
    // Fetch comprehensive business data
    console.log('📊 AI Chat API: Fetching business data...');
    const businessData = await fetchComprehensiveBusinessData(userId);
    console.log('✅ AI Chat API: Business data fetched');

    // Replace company name in prompt (handle both {COMPANY_NAME} placeholder and old format)
    let promptWithCompanyName = BUSINESS_ANALYST_PROMPT.replace(/{COMPANY_NAME}/g, companyName);
    promptWithCompanyName = promptWithCompanyName.replace(/AdPools Group/g, companyName);

    // Initialize AI service with selected provider
    console.log(`💬 AI Chat API: Calling ${provider}...`);
    const aiService = new AIService({
      provider,
      openaiApiKey: settingsMap.ai_openai_api_key,
      anthropicApiKey: settingsMap.ai_anthropic_api_key,
      geminiApiKey: settingsMap.ai_gemini_api_key,
      model: settingsMap.ai_model || 'gpt-4',
      temperature: parseFloat(settingsMap.ai_temperature || '0.7'),
      maxTokens: parseInt(settingsMap.ai_max_tokens || '1000')
    });

    const aiResponse = await aiService.generateResponse(
      message,
      businessData,
      conversationHistory,
      promptWithCompanyName
    );
    console.log('✅ AI Chat API: AI response received');

    return NextResponse.json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('❌ AI Chat API Error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Failed to process your question. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Fetch all relevant business data
async function fetchComprehensiveBusinessData(userId: string) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  const [
    invoices,
    quotations,
    leads,
    opportunities,
    products,
    orders,
    returns,
    accounts,
    payments
  ] = await Promise.all([
    // Invoices
    prisma.invoice.findMany({
      where: { createdAt: { gte: lastMonth } },
      select: {
        id: true,
        number: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        paymentStatus: true,
        dueDate: true,
        createdAt: true,
        account: {
          select: {
            name: true
          }
        }
      }
    }),
    // Quotations
    prisma.quotation.findMany({
      where: { createdAt: { gte: lastMonth } },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        createdAt: true,
        account: {
          select: {
            name: true
          }
        }
      }
    }),
    // Leads
    prisma.lead.findMany({
      where: { createdAt: { gte: lastMonth } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        source: true,
        dealValue: true,
        createdAt: true
      }
    }),
    // Opportunities (filtered by owner)
    prisma.opportunity.findMany({
      where: {
        ownerId: userId
      },
      select: {
        id: true,
        name: true,
        value: true,
        stage: true,
        probability: true,
        createdAt: true,
        closeDate: true
      }
    }),
    // Products
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        active: true,
        _count: {
          select: {
            orderItems: true,
            invoiceLines: true
          }
        },
        stockItems: {
          select: {
            quantity: true,
            reorderPoint: true
          }
        }
      }
    }),
    // Orders
    prisma.order.findMany({
      where: { createdAt: { gte: lastMonth } },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true
      }
    }),
    // Returns
    prisma.return.findMany({
      where: { createdAt: { gte: lastMonth } },
      select: {
        id: true,
        number: true,
        total: true,
        reason: true,
        status: true,
        createdAt: true
      }
    }),
    // Accounts
    prisma.account.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        phone: true,
        _count: {
          select: {
            invoices: true,
            quotations: true,
            payments: true
          }
        }
      }
    }),
    // Payments
    prisma.payment.findMany({
      where: { receivedAt: { gte: lastMonth } },
      select: {
        id: true,
        amount: true,
        method: true,
        receivedAt: true
      }
    })
  ]);

  // Calculate comprehensive metrics
  const metrics = {
    period: "Last 30 Days",
    sales: {
      totalRevenue: invoices.reduce((sum, i) => sum + i.amountPaid, 0),
      totalOutstanding: invoices.reduce((sum, i) => sum + i.amountDue, 0),
      invoiceCount: invoices.length,
      paidInvoices: invoices.filter(i => i.paymentStatus === 'PAID').length,
      unpaidInvoices: invoices.filter(i => i.paymentStatus === 'UNPAID').length,
      partiallyPaidInvoices: invoices.filter(i => i.paymentStatus === 'PARTIALLY_PAID').length,
      averageInvoiceValue: invoices.length > 0 ? invoices.reduce((sum, i) => sum + i.total, 0) / invoices.length : 0,
      unpaidInvoiceDetails: invoices
        .filter(i => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIALLY_PAID')
        .map(i => ({
          number: i.number,
          customer: i.account?.name || 'Unknown',
          amountDue: i.amountDue,
          dueDate: i.dueDate,
          status: i.paymentStatus
        }))
    },
    quotations: {
      total: quotations.length,
      totalValue: quotations.reduce((sum, q) => sum + q.total, 0),
      accepted: quotations.filter(q => q.status === 'ACCEPTED').length,
      sent: quotations.filter(q => q.status === 'SENT').length,
      draft: quotations.filter(q => q.status === 'DRAFT').length,
      rejected: quotations.filter(q => q.status === 'REJECTED').length,
      conversionRate: quotations.length > 0 ? (quotations.filter(q => q.status === 'ACCEPTED').length / quotations.length * 100) : 0
    },
    leads: {
      total: leads.length,
      new: leads.filter(l => l.status === 'NEW').length,
      qualified: leads.filter(l => l.status === 'QUALIFIED').length,
      contacted: leads.filter(l => l.status === 'CONTACTED').length,
      totalValue: leads.reduce((sum, l) => sum + (l.dealValue || 0), 0),
      sources: groupBy(leads, 'source'),
      leadsList: leads.slice(0, 10).map(l => ({
        name: `${l.firstName} ${l.lastName}`,
        company: l.company,
        status: l.status,
        source: l.source,
        dealValue: l.dealValue
      }))
    },
    opportunities: {
      total: opportunities.length,
      totalValue: opportunities.reduce((sum, o) => sum + (o.value || 0), 0),
      weightedValue: opportunities.reduce((sum, o) => sum + ((o.value || 0) * (o.probability || 0) / 100), 0),
      won: opportunities.filter(o => o.stage === 'WON').length,
      lost: opportunities.filter(o => o.stage === 'LOST').length,
      active: opportunities.filter(o => !['WON', 'LOST'].includes(o.stage)).length,
      winRate: opportunities.length > 0 ? (opportunities.filter(o => o.stage === 'WON').length / opportunities.length * 100) : 0,
      opportunitiesList: opportunities.slice(0, 10).map(o => ({
        name: o.name,
        value: o.value,
        stage: o.stage,
        probability: o.probability
      }))
    },
    products: {
      total: products.length,
      active: products.filter(p => p.active).length,
      lowStockProducts: products.filter(p => {
        const totalQty = p.stockItems.reduce((sum, si) => sum + si.quantity, 0);
        const minReorder = p.stockItems.length > 0 ? Math.min(...p.stockItems.map(si => si.reorderPoint || 0)) : 0;
        return totalQty <= minReorder && totalQty > 0;
      }).map(p => ({
        name: p.name,
        sku: p.sku,
        quantity: p.stockItems.reduce((sum, si) => sum + si.quantity, 0),
        reorderPoint: p.stockItems.length > 0 ? Math.min(...p.stockItems.map(si => si.reorderPoint || 0)) : 0
      })),
      outOfStockProducts: products.filter(p => p.stockItems.reduce((sum, si) => sum + si.quantity, 0) === 0).map(p => ({
        name: p.name,
        sku: p.sku
      })),
      topSellers: products
        .sort((a, b) => (b._count.orderItems + b._count.invoiceLines) - (a._count.orderItems + a._count.invoiceLines))
        .slice(0, 10)
        .map(p => ({
          name: p.name,
          sku: p.sku,
          sales: p._count.orderItems + p._count.invoiceLines,
          stock: p.stockItems.reduce((sum, si) => sum + si.quantity, 0),
          price: p.price
        }))
    },
    orders: {
      total: orders.length,
      totalValue: orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      delivered: orders.filter(o => o.status === 'DELIVERED').length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      processing: orders.filter(o => o.status === 'PROCESSING').length,
      fulfillmentRate: orders.length > 0 ? (orders.filter(o => o.status === 'DELIVERED').length / orders.length * 100) : 0
    },
    returns: {
      total: returns.length,
      totalValue: returns.reduce((sum, r) => sum + r.total, 0),
      reasons: groupBy(returns, 'reason'),
      returnRate: orders.length > 0 ? (returns.length / orders.length * 100) : 0,
      returnsList: returns.slice(0, 10).map(r => ({
        number: r.number,
        reason: r.reason,
        amount: r.total,
        status: r.status
      }))
    },
    customers: {
      total: accounts.length,
      topCustomers: accounts
        .sort((a, b) => (b._count.invoices + b._count.quotations) - (a._count.invoices + a._count.quotations))
        .slice(0, 10).map(a => ({
          name: a.name,
          email: a.email,
          phone: a.phone,
          invoices: a._count.invoices,
          quotes: a._count.quotations,
          payments: a._count.payments,
          totalActivity: a._count.invoices + a._count.quotations + a._count.payments
        }))
    },
    payments: {
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      averagePayment: payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0,
      byMethod: groupBy(payments, 'method')
    }
  };

  return metrics;
}


// Helper function
function groupBy(array: any[], field: string): { [key: string]: number } {
  return array.reduce((acc, item) => {
    const key = item[field] || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
