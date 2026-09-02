'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface Announcement {
  text: string;
  level: 'info' | 'warning' | 'error';
}

/**
 * GET /api/announcements 조회 → text + level 표시.
 * tradingPaused = true면 빨간색 "Trading paused" 띠 표시.
 */
export default function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [tradingPaused, setTradingPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/announcements')
      .then(res => res.json())
      .then(data => {
        if (data.announcement) {
          setAnnouncement(data.announcement);
        }
        if (data.tradingPaused) {
          setTradingPaused(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!announcement && !tradingPaused) return null;
  if (dismissed && !tradingPaused) return null;

  return (
    <div>
      {tradingPaused && (
        <div
          className="px-4 py-2 flex items-center justify-center"
          style={{ background: '#FF4D5E', color: '#fff' }}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm font-semibold">Trading Paused — Pool and trade creation is temporarily disabled</span>
        </div>
      )}
      {announcement && !dismissed && (
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{
            background: announcement.level === 'error' ? 'rgba(255,77,94,0.15)' :
                       announcement.level === 'warning' ? 'rgba(245,166,35,0.15)' :
                       'rgba(59,130,246,0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              className="w-4 h-4"
              style={{
                color: announcement.level === 'error' ? '#FF4D5E' :
                       announcement.level === 'warning' ? '#f5a623' :
                       '#60a5fa',
              }}
            />
            <span
              className="text-sm"
              style={{
                color: announcement.level === 'error' ? '#FF4D5E' :
                       announcement.level === 'warning' ? '#f5a623' :
                       '#60a5fa',
              }}
            >
              {announcement.text}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="ml-4 w-6 h-6 rounded flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <X className="w-3 h-3" style={{ color: '#888' }} />
          </button>
        </div>
      )}
    </div>
  );
}
