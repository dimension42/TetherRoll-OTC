import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Supabase가 설정되어 있는지. 미설정이면 개발 모드(allowlist 미강제)로 동작. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceKey);
}

let _admin: SupabaseClient | null = null;

/**
 * 서버 전용 Supabase 클라이언트 (service_role).
 * RLS를 우회하므로 절대 클라이언트 번들에 노출 금지 — 서버 라우트에서만 import.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!_admin) {
    _admin = createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
