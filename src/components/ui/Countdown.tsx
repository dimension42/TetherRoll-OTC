'use client';

import { useState, useEffect } from 'react';
import { fmtDuration } from '@/lib/format';

export function Countdown({ until }: { until: string | Date }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const target = typeof until === 'string' ? new Date(until).getTime() : until.getTime();

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setRemaining(Math.floor(diff / 1000));
    };

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [until]);

  if (remaining === 0) {
    return <span style={{ color: '#ff4466' }}>Expired</span>;
  }

  const color = remaining < 3600 ? '#ff4466' : remaining < 86400 ? '#f5a623' : '#00ff88';

  return <span style={{ color }}>{fmtDuration(remaining)}</span>;
}
