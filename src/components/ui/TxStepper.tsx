'use client';

import { Check, Loader2, AlertCircle } from 'lucide-react';
import { TxLink } from './AddressLink';

type Step = {
  label: string;
  status: 'pending' | 'active' | 'success' | 'error';
  txHash?: string;
  chainId?: number;
  error?: string;
};

/**
 * 트랜잭션 스테퍼: Approve → Sign → Broadcast → Confirmed
 * 각 단계의 상태를 시각화. explorer 링크 포함.
 */
export function TxStepper({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;

        return (
          <div key={i}>
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                style={{
                  background:
                    step.status === 'success' ? 'rgba(0,201,167,0.15)' :
                    step.status === 'error' ? 'rgba(255,77,94,0.15)' :
                    step.status === 'active' ? 'rgba(0,201,167,0.08)' :
                    'rgba(255,255,255,0.03)',
                  border: `2px solid ${
                    step.status === 'success' ? '#00c9a7' :
                    step.status === 'error' ? '#FF4D5E' :
                    step.status === 'active' ? '#00c9a7' :
                    '#2a2a2a'
                  }`,
                }}
              >
                {step.status === 'success' && <Check className="w-4 h-4" style={{ color: '#00c9a7' }} />}
                {step.status === 'active' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00c9a7' }} />}
                {step.status === 'error' && <AlertCircle className="w-4 h-4" style={{ color: '#FF4D5E' }} />}
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <p
                  className="text-sm font-semibold mb-1"
                  style={{
                    color:
                      step.status === 'success' ? '#00c9a7' :
                      step.status === 'error' ? '#FF4D5E' :
                      step.status === 'active' ? '#f0f0f0' :
                      '#666',
                  }}
                >
                  {step.label}
                </p>
                {step.txHash && step.chainId && (
                  <TxLink hash={step.txHash} chainId={step.chainId} label="View on explorer" />
                )}
                {step.error && (
                  <p className="text-xs mt-1" style={{ color: '#FF4D5E' }}>
                    {step.error}
                  </p>
                )}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="w-0.5 h-6 ml-4 my-1 transition-all"
                style={{
                  background:
                    step.status === 'success' ? '#00c9a7' :
                    step.status === 'active' ? 'linear-gradient(to bottom, #00c9a7, #2a2a2a)' :
                    '#2a2a2a',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
