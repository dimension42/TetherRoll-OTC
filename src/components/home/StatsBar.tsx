'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Stats {
  openPools: number;
  totalPools: number;
  totalUsers: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats(data.stats))
      .catch(() => {});
  }, []);

  const items = [
    { label: 'Multi-chain settlement', value: 'Live' },
    { label: 'Open Pools', value: stats ? stats.openPools.toString() : '—' },
    { label: 'Total Pools', value: stats ? stats.totalPools.toString() : '—' },
    { label: 'Total Users', value: stats ? stats.totalUsers.toString() : '—' },
    { label: 'Platform Fee', value: '0.3%' },
  ];

  return (
    <div
      className="w-full py-4 overflow-hidden"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 shrink-0"
            >
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#666' }}>{item.label}</p>
                <span className="text-base font-bold text-white">{item.value}</span>
              </div>
              {i < items.length - 1 && (
                <div className="h-8 w-px ml-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
