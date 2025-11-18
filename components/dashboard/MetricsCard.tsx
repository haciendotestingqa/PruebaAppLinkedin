'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApplicationMetrics } from '@/types'

interface MetricsCardProps {
  title: string
  value: string | number
  description?: string
  trend?: number
}

export function MetricsCard({ title, value, description, trend }: MetricsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend !== undefined && (
          <p className={`text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 && '+'}{trend}% from last week
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface MetricsOverviewProps {
  metrics: ApplicationMetrics
}

export function MetricsOverview({ metrics }: MetricsOverviewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricsCard
        title="Total Applications"
        value={metrics.totalApplied}
        description="Applications submitted"
      />
      <MetricsCard
        title="Today's Applications"
        value={metrics.todayApplied}
        description="Applied today"
      />
      <MetricsCard
        title="Interviews"
        value={metrics.interviews}
        description="Scheduled interviews"
      />
      <MetricsCard
        title="Success Rate"
        value={`${metrics.successRate}%`}
        description="Interview conversion"
      />
      <MetricsCard
        title="Pending"
        value={metrics.pending}
        description="Awaiting response"
      />
      <MetricsCard
        title="Rejections"
        value={metrics.rejections}
        description="Not selected"
      />
      <MetricsCard
        title="Offers"
        value={metrics.offers}
        description="Received offers"
      />
      <MetricsCard
        title="Avg Match Score"
        value={`${metrics.averageMatchScore}%`}
        description="Profile compatibility"
      />
    </div>
  )
}


















