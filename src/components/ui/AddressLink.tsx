import { shortAddr } from '@/lib/format';
import { addressUrl } from '@/lib/chains';
import { ExternalLink } from 'lucide-react';

export function AddressLink({ address, chainId, short = true }: { address: string; chainId: number; short?: boolean }) {
  const url = addressUrl(chainId, address);
  const display = short ? shortAddr(address) : address;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-sm hover:underline"
      style={{ color: '#00c9a7' }}
    >
      {display}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

export function TxLink({ hash, chainId, label }: { hash: string; chainId: number; label?: string }) {
  const url = `${addressUrl(chainId, '').replace('/address/', '/tx/')}${hash}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-sm hover:underline"
      style={{ color: '#00c9a7' }}
    >
      {label || shortAddr(hash)}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
