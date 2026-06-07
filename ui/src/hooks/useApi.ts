import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiOptions {
  interval?: number | null;
}

interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useApi<T = unknown>(url: string, { interval = 5000 }: UseApiOptions = {}): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(url);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(urlRef.current);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as T);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    if (!interval) return;
    const id = setInterval(() => void fetchData(), interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  return { data, error, loading, refresh: fetchData };
}
