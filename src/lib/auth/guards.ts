import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth/session';

export interface AppUser {
  id: string;
  email: string | null;
  wallet_address: string | null;
  privy_did: string | null;
  display_name: string | null;
  role: 'user' | 'viewer' | 'ops' | 'admin';
  vip_status: 'none' | 'pending' | 'approved' | 'revoked';
  vip_expires_at: string | null;
  banned_at: string | null;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 세션 → users 행 조회. 밴 계정은 세션이 있어도 차단. */
export async function getSessionUser(): Promise<AppUser | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const { data } = await db().from('users').select('*').eq('id', uid).maybeSingle();
  if (!data || data.banned_at) return null;
  return data as AppUser;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, 'Unauthorized');
  return user;
}

/** VIP Desk 가드 — 승인 + 미만료. 미승인 계정에는 404로 존재 자체를 숨긴다 (PRD §7-4). */
export async function requireVip(): Promise<AppUser> {
  const user = await requireUser();
  const expired = user.vip_expires_at && new Date(user.vip_expires_at) < new Date();
  if (user.vip_status !== 'approved' || expired) throw new AuthError(404, 'Not found');
  return user;
}

function isEnvAdmin(email: string | null): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/** 어드민 여부 판별 (서버 컴포넌트용) — DB role + 환경변수 듀얼 소스 */
export function isAdminUser(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || isEnvAdmin(user.email);
}

/** 어드민 가드 — API 라우트용 */
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (!isAdminUser(user)) throw new AuthError(404, 'Not found');
  return user;
}

/** 어드민 행위 감사 로그 (불변, insert-only) */
export async function auditLog(
  adminId: string,
  action: string,
  target?: { type: string; id: string },
  before?: unknown,
  after?: unknown,
) {
  await db().from('admin_audit_logs').insert({
    admin_id: adminId,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    before: before ?? null,
    after: after ?? null,
  });
}

/** API 라우트 공통 에러 핸들러 */
export function handleApiError(e: unknown): Response {
  if (e instanceof AuthError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: 'Internal error' }, { status: 500 });
}
