import { auth } from '@/auth';
import { FactoryHome } from '@/../components/FactoryHome';
import { MarketingLanding } from '@/../components/MarketingLanding';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    return <MarketingLanding />;
  }
  return <FactoryHome />;
}
