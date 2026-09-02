import { redirect, notFound } from 'next/navigation';
import { getSessionUser, isAdminUser } from '@/lib/auth/guards';
import RollOrderDetailClient from '@/components/roll/RollOrderDetailClient';

export default async function RollOrderDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const expired = user.vip_expires_at && new Date(user.vip_expires_at) < new Date();
  if (user.vip_status !== 'approved' || expired) {
    if (!isAdminUser(user)) notFound();
  }

  return <RollOrderDetailClient orderId={params.id} />;
}
