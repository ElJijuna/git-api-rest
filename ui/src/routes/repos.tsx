import { createFileRoute } from '@tanstack/react-router';
import { Box, Text, Badge, Spinner, Button, Icon, StatusPage } from '@gnome-ui/react';
import { BoxedList, ActionRow } from '@gnome-ui/react';
import { Applications, Refresh, Error } from '@gnome-ui/icons';
import { useApi } from '../hooks/useApi.ts';

export const Route = createFileRoute('/repos')({
  component: Repos,
});

interface RepoEntry {
  key: string;
  repo: string;
  branch: string;
  status: string;
  lastPulledAt: string | null;
  error?: string | null;
}

interface ReposData { repos: RepoEntry[] }

function statusBadge(status: string) {
  if (status === 'ready') return <Badge variant="success">Ready</Badge>;
  if (status === 'error') return <Badge variant="error">Error</Badge>;
  if (status === 'cloning') return <Badge variant="warning">Cloning</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function formatPulledAt(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function Repos() {
  const { data, loading, error, refresh } = useApi<ReposData>('/api/repos', { interval: 15000 });

  if (loading) {
    return (
      <Box orientation="vertical" spacing={8} style={{ padding: '24px', alignItems: 'center' }}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ padding: '24px' }}>
        <StatusPage icon={Error} title="Failed to load repos" description={error} compact />
      </Box>
    );
  }

  const repos = data?.repos ?? [];

  return (
    <Box orientation="vertical" spacing={16} style={{ padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      <Box orientation="horizontal" spacing={3} justify="space-between" style={{ alignItems: 'center' }}>
        <Box orientation="horizontal" spacing={2} style={{ alignItems: 'center' }}>
          <Icon icon={Applications} />
          <Text variant="heading">Repositories</Text>
          <Badge variant="neutral">{repos.length}</Badge>
        </Box>
        <Button variant="flat" onClick={() => { void refresh(); }}>
          <Icon icon={Refresh} />
        </Button>
      </Box>

      {repos.length === 0 && (
        <Text variant="body" color="dim">No repositories configured.</Text>
      )}

      <BoxedList>
        {repos.map(r => (
          <ActionRow
            key={`${r.key}/${r.repo}`}
            title={`${r.key} / ${r.repo}`}
            subtitle={`branch: ${r.branch} · pulled: ${formatPulledAt(r.lastPulledAt)}${r.error ? ` · ${r.error}` : ''}`}
            prefix={<Icon icon={Applications} />}
            suffix={statusBadge(r.status)}
          />
        ))}
      </BoxedList>
    </Box>
  );
}
