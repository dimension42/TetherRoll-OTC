import { db } from '@/lib/db';

/**
 * 로그인 수단별 users 행 find-or-create.
 * 동일 이메일이 이미 있으면 그 계정에 수단을 연결(통합 계정 원칙, PRD §2.2).
 */
export async function upsertUserByEmail(supabaseUid: string, email: string): Promise<string> {
  const client = db();
  const lower = email.toLowerCase();

  const { data: byUid } = await client.from('users').select('id').eq('supabase_uid', supabaseUid).maybeSingle();
  if (byUid) return byUid.id;

  const { data: byEmail } = await client.from('users').select('id').eq('email', lower).maybeSingle();
  if (byEmail) {
    await client.from('users').update({ supabase_uid: supabaseUid, updated_at: new Date().toISOString() }).eq('id', byEmail.id);
    return byEmail.id;
  }

  const { data, error } = await client
    .from('users')
    .insert({ supabase_uid: supabaseUid, email: lower })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function upsertUserByWallet(address: string): Promise<string> {
  const client = db();
  const lower = address.toLowerCase();

  const { data: existing } = await client.from('users').select('id').eq('wallet_address', lower).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await client
    .from('users')
    .insert({ wallet_address: lower, display_name: `${lower.slice(0, 6)}…${lower.slice(-4)}` })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function upsertUserByPrivy(privyDid: string, email?: string | null): Promise<string> {
  const client = db();

  const { data: byDid } = await client.from('users').select('id').eq('privy_did', privyDid).maybeSingle();
  if (byDid) return byDid.id;

  if (email) {
    const { data: byEmail } = await client.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (byEmail) {
      await client.from('users').update({ privy_did: privyDid, updated_at: new Date().toISOString() }).eq('id', byEmail.id);
      return byEmail.id;
    }
  }

  const { data, error } = await client
    .from('users')
    .insert({ privy_did: privyDid, email: email?.toLowerCase() ?? null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** 밴 여부 선확인 (로그인 자체를 차단) */
export async function assertNotBanned(userId: string) {
  const { data } = await db().from('users').select('banned_at, ban_reason').eq('id', userId).maybeSingle();
  if (data?.banned_at) {
    const err = new Error(data.ban_reason || 'Account suspended');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}
