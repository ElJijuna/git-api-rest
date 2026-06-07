import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Box, Text, Badge, Spinner, Icon } from '@gnome-ui/react';
import { PanelCard } from '@gnome-ui/layout';
import { BoxedList, ActionRow } from '@gnome-ui/react';
import { Refresh, Check, Error } from '@gnome-ui/icons';
import { LineChart } from '@gnome-ui/charts';
import { useApi } from '../hooks/useApi.ts';

export const Route = createFileRoute('/metrics')({
  component: Metrics,
});

interface MetricsSummary { total: number; errors: number; errorRate: number; avgMs: number; window: string }
interface TopEndpoint { endpoint: string; count: number; errors: number; avgMs: number }
interface MetricsEndpoints { endpoints: TopEndpoint[] }
interface LiveEvent { path: string; method: string; status: number; ms: number; ts: number }

function Metrics() {
  const { data: summary } = useApi<MetricsSummary>('/api/metrics', { interval: 5000 });
  const { data: top } = useApi<MetricsEndpoints>('/api/metrics/endpoints?limit=10', { interval: 5000 });
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [sparkline, setSparkline] = useState<Array<{ t: string; rps: number }>>([]);
  const bucketRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const es = new EventSource('/api/metrics/stream');

    es.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as LiveEvent;
      setLiveEvents(prev => [event, ...prev].slice(0, 20));

      const bucket = new Date(event.ts).toISOString().slice(0, 16);
      bucketRef.current[bucket] = (bucketRef.current[bucket] ?? 0) + 1;
      const sorted = Object.entries(bucketRef.current)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-20)
        .map(([t, rps]) => ({ t: t.slice(11), rps }));
      setSparkline(sorted);
    };

    return () => es.close();
  }, []);

  return (
    <Box orientation="vertical" spacing={16} style={{ padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      <Box orientation="horizontal" spacing={2} style={{ alignItems: 'center' }}>
        <Icon icon={Refresh} />
        <Text variant="heading">API Metrics</Text>
      </Box>

      {summary && (
        <PanelCard icon={<Icon icon={Check} />} title={`Summary (last ${summary.window})`} collapsible={false}>
          <Box orientation="horizontal" spacing={6} style={{ padding: '8px 0' }}>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Total requests</Text>
              <Text variant="title-2">{summary.total}</Text>
            </Box>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Errors</Text>
              <Text variant="title-2">{summary.errors}</Text>
            </Box>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Error rate</Text>
              <Badge variant={summary.errorRate > 0.1 ? 'error' : 'success'}>
                {(summary.errorRate * 100).toFixed(1)}%
              </Badge>
            </Box>
            <Box orientation="vertical" spacing={1}>
              <Text variant="caption" color="dim">Avg response</Text>
              <Text variant="title-2">{summary.avgMs}ms</Text>
            </Box>
          </Box>
        </PanelCard>
      )}

      {sparkline.length > 1 && (
        <PanelCard icon={<Icon icon={Refresh} />} title="Live Request Activity" collapsible={false}>
          <LineChart
            data={sparkline}
            series={[{ dataKey: 'rps', name: 'Requests/min', color: 'var(--accent-color)' }]}
            xAxisKey="t"
            height={160}
            showGrid
          />
        </PanelCard>
      )}

      {(top?.endpoints ?? []).length > 0 && (
        <PanelCard icon={<Icon icon={Check} />} title="Top Endpoints" collapsible={false}>
          <BoxedList>
            {(top?.endpoints ?? []).map(e => (
              <ActionRow
                key={e.endpoint}
                title={e.endpoint}
                subtitle={`${e.count} requests · ${e.errors} errors · avg ${e.avgMs}ms`}
                suffix={<Badge variant={e.errors > 0 ? 'error' : 'success'}>{e.count}</Badge>}
              />
            ))}
          </BoxedList>
        </PanelCard>
      )}

      <PanelCard icon={<Icon icon={Refresh} />} title="Live Feed" collapsible={false}>
        {liveEvents.length === 0 && (
          <Box orientation="horizontal" spacing={2} style={{ padding: '8px', alignItems: 'center' }}>
            <Spinner size="small" />
            <Text variant="caption" color="dim">Waiting for requests...</Text>
          </Box>
        )}
        <BoxedList>
          {liveEvents.map((e, i) => (
            <ActionRow
              key={`${e.ts}-${i}`}
              title={`${e.method} ${e.path}`}
              subtitle={`${e.ms}ms`}
              suffix={
                <Badge variant={e.status >= 400 ? 'error' : 'success'}>
                  {e.status}
                </Badge>
              }
              prefix={<Icon icon={e.status >= 400 ? Error : Check} />}
            />
          ))}
        </BoxedList>
      </PanelCard>
    </Box>
  );
}
