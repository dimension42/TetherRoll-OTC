import { getSessionUser, isAdminUser, AuthError, type AppUser } from './guards';

/**
 * 어드민 역할 계층.
 * PRD §4.4-7 권한 매트릭스:
 * - viewer: 모든 데이터 읽기만
 * - ops: VIP 승인/거절, 밴, 풀 숨김/마감, 환불, 분쟁 기록, Roll 운영, 공지
 * - admin: treasury, 수수료, 화이트리스트, 킬스위치, 역할 변경
 */
export type AdminRole = 'viewer' | 'ops' | 'admin';

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  viewer: 1,
  ops: 2,
  admin: 3,
};

/**
 * 세션 유저의 admin 역할 해석.
 * - users.role === 'admin' → admin
 * - users.role === 'ops' → ops
 * - users.role === 'viewer' → viewer
 * - ADMIN_EMAILS 환경변수 포함 → admin
 * - 그 외 → null
 */
export function getAdminRole(user: AppUser | null): AdminRole | null {
  if (!user) return null;
  // 환경변수 admin은 최고 권한
  if (isAdminUser(user)) return 'admin';
  // DB role이 admin/ops/viewer 중 하나
  if (user.role === 'admin' || user.role === 'ops' || user.role === 'viewer') {
    return user.role as AdminRole;
  }
  return null;
}

/**
 * 최소 요구 역할 체크. viewer 미달은 404(admin 존재 은폐), 미달은 403.
 * @param minRole 최소 요구 역할
 * @returns {AppUser} 세션 유저 (역할 검증 완료)
 */
export async function requireRole(minRole: AdminRole): Promise<AppUser> {
  const user = await getSessionUser();
  const role = getAdminRole(user);
  if (!role) throw new AuthError(404, 'Not found');
  const required = ROLE_HIERARCHY[minRole];
  const actual = ROLE_HIERARCHY[role];
  if (actual < required) throw new AuthError(403, 'Insufficient role');
  return user!;
}

/** 역할이 특정 최소 역할 이상인지 검사 */
export function hasRole(user: AppUser | null, minRole: AdminRole): boolean {
  const role = getAdminRole(user);
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}
