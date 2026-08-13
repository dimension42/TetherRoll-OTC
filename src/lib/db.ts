import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 서버 전용 service-role 클라이언트. RLS 우회.
 * 모든 데이터 접근은 API 라우트에서 이 클라이언트로만 수행한다 (PRD §7-4).
 * 클라이언트 컴포넌트에서 import 금지.
 */
let _admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY');
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/** 이메일 로그인 검증용 anon 클라이언트 (signInWithPassword만 사용) */
export function authClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase public env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
