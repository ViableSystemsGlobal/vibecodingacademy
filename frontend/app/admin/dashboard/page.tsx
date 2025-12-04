'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface DashboardSummary {
  counts: {
    parents: number;
    students: number;
    classes: number;
    registrations: number;
    registrationsLast7Days: number;
    freeRegistrations: number;
    paidRegistrations: number;
    revenue: number;
    pendingPayments: number;
  };
  registrationsOverTime: Array<{
    date: string;
    count: number;
  }>;
  revenueOverTime: Array<{
    date: string;
    amount: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    amount: number;
  }>;
  attendance: {
    attended: number;
    absent: number;
    unknown: number;
    rate: number;
  };
  paymentConversion: {
    rate: number;
    total: number;
    paid: number;
    pending: number;
  };
  popularClasses: Array<{
    id: string;
    title: string;
    type: string;
    registrations: number;
  }>;
  revenue: {
    total: number;
    bootcamp: number;
  };
  upcomingClasses: Array<{
    id: string;
    title: string;
    startDatetime: string;
    capacity: number;
    registrations: number;
    seatsLeft: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardSummary>('/admin/dashboard/summary'),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-600">
          <p className="font-semibold mb-2">Error loading dashboard data</p>
          <p className="text-sm">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm lg:text-base">Overview of your academy</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.parents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrations (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.registrationsLast7Days}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {(data.counts.revenue / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.paymentConversion.rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {data.paymentConversion.paid} of {data.paymentConversion.total} paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.attendance.rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {data.attendance.attended} attended, {data.attendance.absent} absent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.counts.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">Require follow-up</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bootcamp Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GHS {data.revenue.bootcamp.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From paid bootcamps</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Registrations and Revenue */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registrations Over Time</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="lg:h-[300px]">
              <LineChart data={data.registrationsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#0088FE"
                  strokeWidth={2}
                  name="Registrations"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="lg:h-[300px]">
              <LineChart data={data.revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  formatter={(value: number) => `GHS ${value.toFixed(2)}`}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#00C49F"
                  strokeWidth={2}
                  name="Revenue (GHS)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Monthly Revenue and Attendance */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>Last 3 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="lg:h-[300px]">
              <BarChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => {
                    try {
                      return format(new Date(value + '-01'), 'MMM yyyy');
                    } catch {
                      return value;
                    }
                  }}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(value: number) => `GHS ${value.toFixed(2)}`}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="amount" fill="#8884d8" name="Revenue (GHS)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Breakdown</CardTitle>
            <CardDescription>Overall attendance statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="lg:h-[300px]">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Attended', value: data.attendance.attended },
                    { name: 'Absent', value: data.attendance.absent },
                    { name: 'Not Marked', value: data.attendance.unknown },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Attended', value: data.attendance.attended },
                    { name: 'Absent', value: data.attendance.absent },
                    { name: 'Not Marked', value: data.attendance.unknown },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Popular Classes */}
      <Card>
        <CardHeader>
          <CardTitle>Most Popular Classes</CardTitle>
          <CardDescription>Top classes by registration count</CardDescription>
        </CardHeader>
        <CardContent>
          {data.popularClasses.length === 0 ? (
            <p className="text-muted-foreground">No class data available</p>
          ) : (
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" minWidth={300} height={250} className="lg:h-[300px]">
                <BarChart
                  data={data.popularClasses.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis
                    dataKey="title"
                    type="category"
                    width={70}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="registrations" fill="#0088FE" name="Registrations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.counts.registrations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Free Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.counts.freeRegistrations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paid Bootcamps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.counts.paidRegistrations}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Classes */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Classes (Next 7 Days)</CardTitle>
          <CardDescription>Classes scheduled in the next week</CardDescription>
        </CardHeader>
        <CardContent>
          {data.upcomingClasses.length === 0 ? (
            <p className="text-muted-foreground">No upcoming classes</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Title</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Registrations</TableHead>
                  <TableHead>Seats Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.upcomingClasses.map((classItem) => (
                  <TableRow key={classItem.id}>
                    <TableCell className="font-medium">{classItem.title}</TableCell>
                    <TableCell>
                      {format(new Date(classItem.startDatetime), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{classItem.capacity}</TableCell>
                    <TableCell>{classItem.registrations}</TableCell>
                    <TableCell>
                      <span
                        className={
                          classItem.seatsLeft === 0
                            ? 'text-red-600 font-semibold'
                            : classItem.seatsLeft < 5
                            ? 'text-orange-600 font-semibold'
                            : 'text-green-600'
                        }
                      >
                        {classItem.seatsLeft}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

