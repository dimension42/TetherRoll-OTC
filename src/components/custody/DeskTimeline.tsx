import { type DeskTradeStatus } from './types';

/**
 * DeskTimeline — Timeline for Desk trade state machine
 */

const TIMELINE_STEPS: Array<{ key: DeskTradeStatus; label: string }> = [
  { key: 'PENDING', label: 'Created' },
  { key: 'AWAITING_DEPOSITS', label: 'Awaiting Deposits' },
  { key: 'DEPOSITED', label: 'Deposited' },
  { key: 'PAYOUT_PENDING', label: 'Payout Pending' },
  { key: 'COMPLETED', label: 'Completed' },
];

const TERMINAL_STATES: DeskTradeStatus[] = ['CANCELLED', 'REFUNDED', 'DISPUTED', 'EXPIRED'];

export function DeskTimeline({ status }: { status: DeskTradeStatus }) {
  const isTerminal = TERMINAL_STATES.includes(status);

  if (isTerminal) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,68,102,0.05)', border: '1px solid rgba(255,68,102,0.2)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,68,102,0.15)', color: '#ff4466' }}>
          {status === 'DISPUTED' ? '⚠️' : '✕'}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{status}</p>
          <p className="text-xs" style={{ color: '#888' }}>
            {status === 'CANCELLED' && 'Trade cancelled'}
            {status === 'REFUNDED' && 'Refund completed'}
            {status === 'DISPUTED' && 'Dispute raised — admin review'}
            {status === 'EXPIRED' && 'Deadline passed'}
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = TIMELINE_STEPS.findIndex(s => s.key === status);

  return (
    <div className="flex items-center">
      {TIMELINE_STEPS.map((step, i) => {
        const isActive = i === currentIdx;
        const isPast = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: isPast || isActive ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.05)',
                  color: isPast || isActive ? '#00c9a7' : '#555',
                  border: isActive ? '2px solid #00c9a7' : '2px solid transparent',
                  boxShadow: isActive ? '0 0 16px rgba(0,201,167,0.4)' : 'none',
                }}
              >
                {isPast ? '✓' : i + 1}
              </div>
              <p className="text-xs mt-1 text-center max-w-[80px]" style={{ color: isActive ? '#00c9a7' : isFuture ? '#555' : '#888' }}>
                {step.label}
              </p>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 transition-all duration-500"
                style={{ background: isPast ? '#00c9a7' : '#1f1f1f' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
