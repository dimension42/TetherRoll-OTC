import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { SESSION_COOKIE, verifySession, type SessionPayload } from '@/lib/auth/session';

export const runtime = 'nodejs';

const ROLES = ['admin', 'maker', 'taker', 'user'];

async function requireAdmin(req: NextRequest): Promise<SessionPayload | null> {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== 'admin') return null;
  return session;
}

const forbidden = () => NextResponse.json({ ok: false, message: 'Forbidden — admin only' }, { status: 403 });
const notConfigured = () =>
  NextResponse.json({ ok: false, message: 'Supabase가 설정되지 않았습니다.' }, { status: 503 });

/** 계정 목록 (어드민) */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden();
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, configured: false, accounts: [] });

  const sb = supabaseAdmin()!;
  const { data, error } = await sb.from('accounts').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, configured: true, accounts: data });
}

/** 계정 발급 (어드민) — 회원가입 대체. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbidden();
  if (!isSupabaseConfigured()) return notConfigured();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, message: 'Bad request' }, { status: 400 });

  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  const wallet = body.wallet ? String(body.wallet).toLowerCase().trim() : null;
  const role = ROLES.includes(body.role) ? body.role : 'user';
  const label = body.label ? String(body.label).slice(0, 120) : null;

  if (!email && !wallet) {
    return NextResponse.json({ ok: false, message: '이메일 또는 지갑 주소가 필요합니다.' }, { status: 400 });
  }

  const sb = supabaseAdmin()!;
  const { data, error } = await sb
    .from('accounts')
    .insert({ email, wallet, role, label, created_by: admin.sub })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });

  await sb.from('audit_log').insert({
    actor: admin.sub,
    action: 'account.create',
    target: email || wallet,
    after: data,
  });
  return NextResponse.json({ ok: true, account: data });
}

/** 계정 삭제 (어드민) — ?id= */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbidden();
  if (!isSupabaseConfigured()) return notConfigured();

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, message: 'id required' }, { status: 400 });

  const sb = supabaseAdmin()!;
  const { error } = await sb.from('accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });

  await sb.from('audit_log').insert({ actor: admin.sub, action: 'account.delete', target: id });
  return NextResponse.json({ ok: true });
}
