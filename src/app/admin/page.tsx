import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/guards';
import { getAdminRole } from '@/lib/auth/adminRoles';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getSessionUser().catch(() => null);
  const role = getAdminRole(user);
  if (!role) notFound();
  return <AdminShell role={role} />;
}
