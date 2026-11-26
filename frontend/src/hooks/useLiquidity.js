import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useLiquidity(refreshKey) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/dashboard/liquidity', { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      setData(response.data);
      setError(false);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [refreshKey, retry]);

  return { data, error, retry: () => { setError(false); setRetry(value => value + 1); } };
}
