import { type TradeStatus } from '@/lib/types';
import { Check, Clock, X, AlertTriangle } from 'lucide-react';

const TIMELINE_STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'AWAITING_BOND', label: 'Awaiting Bond' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PAID', label: 'Payment Sent' },
  { key: 'RELEASED', label: 'Released' },
] as const;

const TERMINAL_STATES: TradeStatus[] = ['CANCELLED', 'EXPIRED', 'DISPUTED', 'RESOLVED'];

export function TradeTimeline({ status }: { status: TradeStatus }) {
  const isTerminal = TERMINAL_STATES.includes(status);

  // Find current step index
  const currentIndex = TIMELINE_STEPS.findIndex(s => s.key === status);

  return (
    <div className="space-y-4">
      {/* Main flow */}
      <div className="flex items-center gap-2">
        {TIMELINE_STEPS.map((step, i) => {
          const isActive = step.key === status;
          const isPast = i < currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all"
                  style={{
                    background:
                      isPast || isActive
                        ? 'rgba(0,201,167,0.15)'
                        : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${
                      isPast || isActive ? '#00c9a7' : '#2a2a2a'
                    }`,
                  }}
                >
                  {isPast ? (
                    <Check className="w-5 h-5" style={{ color: '#00c9a7' }} />
                  ) : isActive ? (
                    <Clock className="w-5 h-5" style={{ color: '#00c9a7' }} />
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: '#2a2a2a' }}
                    />
                  )}
                </div>
                <p
                  className="text-xs font-semibold text-center"
                  style={{
                    color:
                      isPast || isActive ? '#f0f0f0' : '#666',
                  }}
                >
                  {step.label}
                </p>
              </div>

              {/* Connector */}
              {i < TIMELINE_STEPS.length - 1 && (
                <div
                  className="h-0.5 flex-1 transition-all"
                  style={{
                    background: isPast ? '#00c9a7' : '#2a2a2a',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal states (displayed separately) */}
      {isTerminal && (
        <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f1f1f' }}>
          <div className="flex items-center gap-3">
            {status === 'CANCELLED' && (
              <>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,68,102,0.15)', border: '2px solid #ff4466' }}
                >
                  <X className="w-5 h-5" style={{ color: '#ff4466' }} />
                </div>
                <div>
                  <p className="font-semibold text-white">Cancelled</p>
                  <p className="text-xs" style={{ color: '#666' }}>
                    Trade was cancelled by mutual agreement
                  </p>
                </div>
              </>
            )}
            {status === 'EXPIRED' && (
              <>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(136,136,136,0.15)', border: '2px solid #888' }}
                >
                  <Clock className="w-5 h-5" style={{ color: '#888' }} />
                </div>
                <div>
                  <p className="font-semibold text-white">Expired</p>
                  <p className="text-xs" style={{ color: '#666' }}>
                    Trade deadline passed without completion
                  </p>
                </div>
              </>
            )}
            {status === 'DISPUTED' && (
              <>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(251,146,60,0.15)', border: '2px solid #fb923c' }}
                >
                  <AlertTriangle className="w-5 h-5" style={{ color: '#fb923c' }} />
                </div>
                <div>
                  <p className="font-semibold text-white">Disputed</p>
                  <p className="text-xs" style={{ color: '#666' }}>
                    Awaiting arbitrator resolution
                  </p>
                </div>
              </>
            )}
            {status === 'RESOLVED' && (
              <>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '2px solid #a78bfa' }}
                >
                  <Check className="w-5 h-5" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p className="font-semibold text-white">Resolved</p>
                  <p className="text-xs" style={{ color: '#666' }}>
                    Dispute settled by arbitrator
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
