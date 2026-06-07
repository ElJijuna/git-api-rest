import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Box, Text, Badge, Button, Icon } from '@gnome-ui/react';
import { TerminalView } from '@gnome-ui/react';
import { Information, Error as ErrorIcon } from '@gnome-ui/icons';

export const Route = createFileRoute('/logs')({
  component: Logs,
});

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
}

function levelVariant(level: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warning';
  if (level === 'info') return 'success';
  return 'neutral';
}

function formatLogLine(entry: LogEntry): string {
  const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
  return `[${ts}] [${entry.level.toUpperCase()}] ${entry.message}`;
}

function Logs() {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function connect() {
    if (esRef.current) {
      esRef.current.close();
    }

    setError(null);
    const es = new EventSource('/api/logs/stream');
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e: MessageEvent<string>) => {
      const entry = JSON.parse(e.data) as LogEntry;
      setLines(prev => [...prev, entry].slice(-500));
    };

    es.onerror = () => {
      setConnected(false);
      setError('Connection lost. Reconnecting...');
      setTimeout(connect, 3000);
    };
  }

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, []);

  const terminalLines = lines.length > 0 ? lines.map(formatLogLine) : ['# Waiting for log entries...'];

  return (
    <Box orientation="vertical" spacing={16} style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Box orientation="horizontal" spacing={3} justify="space-between" style={{ alignItems: 'center' }}>
        <Box orientation="horizontal" spacing={2} style={{ alignItems: 'center' }}>
          <Icon icon={Information} />
          <Text variant="heading">Live Logs</Text>
          <Badge variant={connected ? 'success' : 'warning'}>
            {connected ? 'Connected' : 'Connecting...'}
          </Badge>
        </Box>
        <Button variant="flat" onClick={() => setLines([])}>
          Clear
        </Button>
      </Box>

      {error && (
        <Box orientation="horizontal" spacing={2} style={{ alignItems: 'center' }}>
          <Icon icon={ErrorIcon} />
          <Text variant="caption" color="dim">{error}</Text>
        </Box>
      )}

      <TerminalView lines={terminalLines} autoScroll />
    </Box>
  );
}
