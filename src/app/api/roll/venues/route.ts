import { NextResponse } from 'next/server';
import { requireVip, handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireVip();

    const { data: venues } = await db().from('venues').select('*').order('name');

    return NextResponse.json({ venues: venues ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
