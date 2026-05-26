import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export type Account = {
  id: string;
  email: string | null;
  wallet: string | null;
  role: string;
  status: string;
  label: string | null;
  created_at?: string;
  created_by?: string | null;
};

export type AllowlistResult =
  | { ok: true; account: Account }
  | { ok: false; reason: 'not_allowlisted' | 'disabled' }
  | { ok: 'unconfigured' }; // Supabase 미설정 → 개발 모드(allowlist 미강제)

export type Identity = { email?: string | null; wallet?: string | null };

function norm(idn: Identity) {
  return {
    email: idn.email ? idn.email.toLowerCase().trim() : null,
    wallet: idn.wallet ? idn.wallet.toLowerCase().trim() : null,
  };
}

/** 로그인한 신원(email/wallet)이 어드민 발급 allowlist에 있는지 검증. */
export async function checkAllowlist(idn: Identity): Promise<AllowlistResult> {
  if (!isSupabaseConfigured()) return { ok: 'unconfigured' };

  const { email, wallet } = norm(idn);
  if (!email && !wallet) return { ok: false, reason: 'not_allowlisted' };

  const sb = supabaseAdmin();
  if (!sb) return { ok: 'unconfigured' };

  const ors: string[] = [];
  if (email) ors.push(`email.eq.${email}`);
  if (wallet) ors.push(`wallet.eq.${wallet}`);

  const { data, error } = await sb
    .from('accounts')
    .select('*')
    .or(ors.join(','))
    .limit(1);

  if (error || !data || data.length === 0) return { ok: false, reason: 'not_allowlisted' };

  const account = data[0] as Account;
  if (account.status !== 'active') return { ok: false, reason: 'disabled' };
  return { ok: true, account };
}
