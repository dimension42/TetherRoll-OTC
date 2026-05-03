'use client';

import { motion } from 'framer-motion';

const stats = [
  { label: 'Total Volume', value: '$124.7M', change: '+12.4%', up: true },
  { label: 'Active Pools', value: '847', change: '+23', up: true },
  { label: 'Completed Trades', value: '12,491', change: '+148', up: true },
  { label: 'Avg Settlement', value: '< 2h', change: '-15%', up: true },
  { label: 'Platform Fee', value: '0.3%', change: null, up: null },
];

export default function StatsBar() {
  return (
    <div
      className="w-full py-4 overflow-hidden"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 shrink-0"
            >
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#666' }}>{stat.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{stat.value}</span>
                  {stat.change && (
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        color: stat.up ? '#00ff88' : '#ff4466',
                        background: stat.up ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,102,0.1)',
                      }}
                    >
                      {stat.change}
                    </span>
                  )}
                </div>
              </div>
              {i < stats.length - 1 && (
                <div className="h-8 w-px ml-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
