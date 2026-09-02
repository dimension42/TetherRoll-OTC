import { redirect } from 'next/navigation';

export default function EscrowRedirect() {
  redirect('/trades');
}
