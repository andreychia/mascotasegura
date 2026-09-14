import { currentOwner } from '@/lib/auth';
import { Dashboard } from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Page() {
  let owner = null;
  let unavailable = false;
  try {
    owner = (await currentOwner()) ?? null;
  } catch {
    unavailable = true;
  }
  return (
    <Dashboard
      email={owner?.email ?? null}
      isAdmin={owner?.isAdmin ?? false}
      accountStatus={owner?.accountStatus ?? null}
      subscriptionStatus={owner?.subscriptionStatus ?? null}
      subscriptionExpiresAt={owner?.subscriptionExpiresAt ?? null}
      unavailable={unavailable}
    />
  );
}
