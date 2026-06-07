import { createFileRoute } from '@tanstack/react-router';
import { Box, Text, Badge, Spinner, Button, Icon } from '@gnome-ui/react';
import { PanelCard } from '@gnome-ui/layout';
import { Check, Error, Warning, Refresh } from '@gnome-ui/icons';
import { BarChart, LineChart, PieChart } from '@gnome-ui/charts';
import { useApi } from '../hooks/useApi.ts';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

interface RepoStatus { key: string; repo: string; branch: string; status: string; lastPulledAt: string | null; error?: string | null }
interface HealthData { status: string; repos: RepoStatus[] }
interface CommitData { commits: Array<{ date: string; message: string }>; }
interface MetricsSummary { total: number; errors: number; errorRate: number; avgMs: number }
interface TopEndpoint { endpoint: string; count: number; errors: number }
interface MetricsEndpoints { endpoints: TopEndpoint[] }

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'ready' || status === 'ok') return 'success';
  if (status === 'error' || status === 'down') return 'error';
  if (status === 'degraded' || status === 'cloning') return 'warning';
  return 'neutral';
}

function buildActivityData(commits: Array<{ date: string }>) {
  const buckets: Record<string, number> = {};
  for (const c of commits) {
    const day = c.date.slice(0, 10);
    buckets[day] = (buckets[day] ?? 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date: date.slice(5), count }));
}

function Dashboard() {
  const { data: health, loading, error, refresh } = useApi<HealthData>('/health', { interval: 10000 });
  const { data: metrics } = useApi<MetricsSummary>('/api/metrics', { interval: 5000 });
  const { data: topEndpoints } = useApi<MetricsEndpoints>('/api/metrics/endpoints?limit=5', { interval: 10000 });
  const { data: commits } = useApi<CommitData>('/api/projects/MYPROJECT/repos/my-repo/commits?limit=50', { interval: 30000 });

  const appStatus = loading ? 'loading' : error ? 'down' : health?.status ?? 'unknown';
  const readyCount = health?.repos.filter(r => r.status === 'ready').length ?? 0;
  const totalRepos = health?.repos.length ?? 0;
  const errorRepos = health?.repos.filter(r => r.status === 'error').length ?? 0;

  const pieData = [
    { label: 'Ready', value: readyCount, color: 'var(--gnome-green-4, #2ec27e)' },
    { label: 'Error', value: errorRepos, color: 'var(--gnome-red-3, #e01b24)' },
    { label: 'Other', value: totalRepos - readyCount - errorRepos, color: 'var(--gnome-orange-3, #ff7800)' },
  ].filter(d => d.value > 0);

  const barData = (topEndpoints?.endpoints ?? []).map(e => ({
    endpoint: e.endpoint.replace(/GET |POST /, '').split('/').pop() ?? e.endpoint,
    count: e.count,
    errors: e.errors,
  }));

  const lineData = buildActivityData(commits?.commits ?? []);

  return (
    <Box orientation="vertical" spacing={16} style={{ padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      <Box orientation="horizontal" spacing={3} justify="space-between" style={{ alignItems: 'center' }}>
        <Text variant="heading">Dashboard</Text>
        <Button variant="flat" onClick={() => { void refresh(); }}>
          <Icon icon={Refresh} />
        </Button>
      </Box>

      <PanelCard
        icon={<Icon icon={appStatus === 'ok' ? Check : appStatus === 'degraded' ? Warning : Error} />}
        title="API Status"
        collapsible={false}
      >
        <Box orientation="horizontal" spacing={4} style={{ padding: '8px 0', alignItems: 'center' }}>
          {loading
            ? <Spinner size="small" />
            : <Badge variant={statusVariant(appStatus)}>{appStatus.toUpperCase()}</Badge>}
        </Box>
      </PanelCard>

      <PanelCard icon={<Icon icon={Check} />} title="Repositories" collapsible={false}>
        <Box orientation="horizontal" spacing={6} style={{ padding: '8px 0' }}>
          <Box orientation="vertical" spacing={1}>
            <Text variant="caption" color="dim">Total</Text>
            <Text variant="title-2">{totalRepos}</Text>
          </Box>
          <Box orientation="vertical" spacing={1}>
            <Text variant="caption" color="dim">Ready</Text>
            <Text variant="title-2">{readyCount}</Text>
          </Box>
          <Box orientation="vertical" spacing={1}>
            <Text variant="caption" color="dim">Errors</Text>
            <Text variant="title-2" style={{ color: errorRepos > 0 ? 'var(--error-color)' : undefined }}>
              {errorRepos}
            </Text>
          </Box>
        </Box>
      </PanelCard>

      {metrics && (
        <PanelCard icon={<Icon icon={Refresh} />} title="API Activity (last hour)" collapsible={false}>
          <Box orientation="horizontal" spacing={6} style={{ padding: '8px 0' }}>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Requests</Text>
              <Text variant="title-2">{metrics.total}</Text>
            </Box>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Errors</Text>
              <Text variant="title-2">{metrics.errors}</Text>
            </Box>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Error rate</Text>
              <Badge variant={metrics.errorRate > 0.1 ? 'error' : 'success'}>
                {(metrics.errorRate * 100).toFixed(1)}%
              </Badge>
            </Box>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Avg ms</Text>
              <Text variant="title-2">{metrics.avgMs}</Text>
            </Box>
          </Box>
        </PanelCard>
      )}

      {pieData.length > 0 && (
        <PanelCard icon={<Icon icon={Check} />} title="Repo Status" collapsible={false}>
          <PieChart data={pieData} height={200} donut showLegend aria-label="Repo status breakdown" />
        </PanelCard>
      )}

      {barData.length > 0 && (
        <PanelCard icon={<Icon icon={Refresh} />} title="Top Endpoints" collapsible={false}>
          <BarChart
            data={barData}
            series={[
              { dataKey: 'count', name: 'Requests' },
              { dataKey: 'errors', name: 'Errors', color: 'var(--error-color)' },
            ]}
            xAxisKey="endpoint"
            height={200}
            showGrid
            showLegend
          />
        </PanelCard>
      )}

      {lineData.length > 1 && (
        <PanelCard icon={<Icon icon={Check} />} title="Commit Activity (last 14 days)" collapsible={false}>
          <LineChart
            data={lineData}
            series={[{ dataKey: 'count', name: 'Commits', color: 'var(--accent-color)' }]}
            xAxisKey="date"
            height={200}
            showGrid
          />
        </PanelCard>
      )}
    </Box>
  );
}
