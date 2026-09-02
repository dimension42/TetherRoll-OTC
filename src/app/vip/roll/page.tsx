import { redirect, notFound } from 'next/navigation';
import { getSessionUser, isAdminUser } from '@/lib/auth/guards';
import RollOrdersListClient from '@/components/roll/RollOrdersListClient';

export default async function RollOrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const expired = user.vip_expires_at && new Date(user.vip_expires_at) < new Date();
  if (user.vip_status !== 'approved' || expired) {
    // Unless admin
    if (!isAdminUser(user)) notFound();
  }

  return <RollOrdersListClient />;
}
