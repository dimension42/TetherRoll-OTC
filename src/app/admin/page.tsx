import { notFound } from 'next/navigation';
import { getSessionUser, isAdminUser } from '@/lib/auth/guards';
import AdminConsole from '@/components/admin/AdminConsole';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getSessionUser().catch(() => null);
  if (!isAdminUser(user)) notFound();
  return <AdminConsole />;
}
