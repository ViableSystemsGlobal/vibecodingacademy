"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/contexts/theme-context"
import { useAbilities } from "@/hooks/use-abilities"
import { MiniLineChart } from "@/components/ui/mini-line-chart"
import { AIRecommendationCard } from "@/components/ai-recommendation-card"
import { SkeletonMetricCard, SkeletonCard, SkeletonChart } from "@/components/ui/skeleton"
import { 
  Package, 
  Users, 
  FileText, 
  TrendingUp,
  Plus,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  DollarSign,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Settings,
  UserPlus,
  Receipt,
  Building2,
  Calendar,
  User,
  Target,
  CheckCircle
} from "lucide-react"

interface DashboardData {
  metrics: {
    totalProducts: number;
    totalCustomers: number;
    pendingQuotations: number;
    monthlyRevenue: number;
    revenueChange: number;
    revenueYTD: number;
  };
  trends: {
    productsTrend: number[];
    customersTrend: number[];
    quotationsTrend: number[];
    revenueTrend: number[];
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    amount: number;
  }>;
}

export default function Dashboard() {
  const { getThemeClasses, getThemeColor } = useTheme()
  const theme = getThemeClasses()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { canAccess, loading: abilitiesLoading } = useAbilities()
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check dashboard permissions and redirect if no access
  useEffect(() => {
    if (status === 'loading' || abilitiesLoading) return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }
    
    // Wait for abilities to load before checking
    if (!abilitiesLoading && !canAccess('dashboard')) {
      router.push('/tasks/my')
      return
    }
  }, [session, status, canAccess, abilitiesLoading, router])
  
  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);
  
  // Default values while loading or if fetch fails
  const metrics = dashboardData?.metrics || {
    totalProducts: 0,
    totalCustomers: 0,
    pendingQuotations: 0,
    monthlyRevenue: 0,
    revenueChange: 0,
    revenueYTD: 0
  };
  
  const trends = dashboardData?.trends || {
    productsTrend: [0],
    customersTrend: [0],
    quotationsTrend: [0],
    revenueTrend: [0]
  };
  
  const recentActivity = dashboardData?.recentActivity || [];
  
  const handleRecommendationComplete = (id: string) => {
    console.log('Recommendation completed:', id);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quotation':
        return <FileText className={`h-4 w-4 text-${theme.primary}`} />;
      case 'invoice':
        return <Receipt className={`h-4 w-4 text-${theme.primary}`} />;
      case 'customer':
        return <User className={`h-4 w-4 text-${theme.primary}`} />;
      case 'lead':
        return <Target className={`h-4 w-4 text-${theme.primary}`} />;
      case 'product':
        return <Package className={`h-4 w-4 text-${theme.primary}`} />;
      case 'payment':
        return <CheckCircle className={`h-4 w-4 text-${theme.primary}`} />;
      default:
        return <FileText className={`h-4 w-4 text-${theme.primary}`} />;
    }
  };

  // Don't render if checking permissions or if no access
  if (status === 'loading' || abilitiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!session) {
    return null
  }
  
  if (!canAccess('dashboard')) {
    return null // Will redirect via useEffect
  }

  const getActivityNavigation = (type: string, id: string) => {
    switch (type) {
      case 'quotation':
        return `/quotations/${id}`;
      case 'invoice':
        return `/invoices/${id}`;
      case 'customer':
        return `/crm/accounts/${id}`;
      case 'lead':
        return `/crm/leads/${id}`;
      case 'product':
        return `/products/${id}`;
      case 'payment':
        return `/payments`; // Navigate to payments list
      default:
        return `/quotations/${id}`;
    }
  };
  
  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Welcome back! Here's what's happening with your business today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/quotations/create')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Quick Quote
            </Button>
            <Button 
              size="sm" 
              className="text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: getThemeColor() }}
              onClick={() => router.push('/products?new=1')}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {loading ? (
            <>
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
            </>
          ) : (
            <>
              <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <Package className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{metrics.totalProducts}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                      Last 7 days
                    </div>
                    <MiniLineChart data={trends.productsTrend} color="#16a34a" width={80} height={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Active Customers</CardTitle>
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <Users className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{metrics.totalCustomers}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                      Last 7 days
                    </div>
                    <MiniLineChart data={trends.customersTrend} color="#16a34a" width={80} height={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Pending Quotations</CardTitle>
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <FileText className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{metrics.pendingQuotations}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <ArrowDownRight className="h-3 w-3 mr-1 text-green-500" />
                      Last 7 days
                    </div>
                    <MiniLineChart data={trends.quotationsTrend} color="#16a34a" width={80} height={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Monthly Revenue</CardTitle>
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <TrendingUp className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {`GH₵${(metrics.monthlyRevenue / 1000).toFixed(1)}K`}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                      Last 7 days
                    </div>
                    <MiniLineChart data={trends.revenueTrend} color="#16a34a" width={80} height={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Revenue YTD</CardTitle>
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                    <DollarSign className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {metrics.revenueYTD >= 1000000 
                      ? `GH₵${(metrics.revenueYTD / 1000000).toFixed(2)}M`
                      : metrics.revenueYTD >= 1000
                      ? `GH₵${(metrics.revenueYTD / 1000).toFixed(1)}K`
                      : `GH₵${metrics.revenueYTD.toFixed(2)}`}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <Calendar className="h-3 w-3 mr-1 text-blue-500" />
                      Year to date
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
              <CardDescription className="text-gray-600">
                Common tasks to get you started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/products?new=1')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <Plus className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Add New Product</div>
                    <div className="text-sm text-gray-500">Create a new product in your catalog</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/quotations/create')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <FileText className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Create Quotation</div>
                    <div className="text-sm text-gray-500">Generate a new quotation for a customer</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/crm/accounts?new=1')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <Users className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Add New Customer</div>
                    <div className="text-sm text-gray-500">Register a new customer account</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/invoices/create')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <Receipt className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Create Invoice</div>
                    <div className="text-sm text-gray-500">Generate a new invoice for payment</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/crm/leads?new=1')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <UserPlus className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Add New Lead</div>
                    <div className="text-sm text-gray-500">Capture a new sales lead</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/inventory/stock-movements')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <ShoppingCart className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Stock Movement</div>
                    <div className="text-sm text-gray-500">Record inventory movements</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/drm/distributors?new=1')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <Building2 className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Add Distributor</div>
                    <div className="text-sm text-gray-500">Register a new distributor</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-12 text-left" 
                variant="outline"
                onClick={() => router.push('/tasks/create')}
              >
                <div className="flex items-center w-full">
                  <div className={`p-2 bg-${theme.primaryBg} rounded-lg mr-3`}>
                    <Calendar className={`h-4 w-4 text-${theme.primary}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Create Task</div>
                    <div className="text-sm text-gray-500">Add a new task or reminder</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
              <CardDescription className="text-gray-600">
                Latest updates in your system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                      <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                  <p className="text-gray-500 text-sm">Start by adding your first product or customer</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div 
                      key={`${activity.type}-${activity.id}`}
                      className="flex items-start gap-2 sm:space-x-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(getActivityNavigation(activity.type, activity.id))}
                    >
                      <div className={`p-2 bg-${theme.primaryBg} rounded-lg`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activity.title}
                          </p>
                          {activity.amount > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              GH₵{activity.amount.toFixed(2)}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Actions Today */}
          <div className="lg:col-span-1">
            <AIRecommendationCard
              title="Dashboard AI"
              subtitle="Next best 5 actions that move the needle"
              onRecommendationComplete={handleRecommendationComplete}
              page="dashboard"
              enableAI={true}
            />
          </div>
        </div>
      </div>
    </>
  )
}