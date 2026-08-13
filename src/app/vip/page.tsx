import { getSessionUser } from '@/lib/auth/guards';
import VipDesk from '@/components/vip/VipDesk';
import VipGate from '@/components/vip/VipGate';

export const dynamic = 'force-dynamic';

export default async function VipPage() {
  const user = await getSessionUser();

  // VIP 승인 + 미만료 확인
  const isVip =
    user?.vip_status === 'approved' &&
    (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

  if (isVip) {
    return <VipDesk />;
  }

  return <VipGate authenticated={!!user} />;
}
