'use client';

/**
 * Placeholder for tabs that are being built by another workstream.
 * WS4 will replace this with real RollsTab.tsx and RefundsTab.tsx components.
 */
export default function PendingTab({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        <div className="text-6xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
        <p className="text-sm" style={{ color: '#8FA398' }}>
          This tab is being implemented by WS4 (Roll Order workstream).
        </p>
      </div>
    </div>
  );
}
