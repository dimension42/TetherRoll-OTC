/**
 * AssetBadge — Chain + Symbol badge for custody assets
 */
export function AssetBadge({ chain, symbol }: { chain: string; symbol: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.2)', color: '#00c9a7' }}>
      <span className="opacity-70">{chain}</span>
      <span>•</span>
      <span>{symbol}</span>
    </div>
  );
}
