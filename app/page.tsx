import { auth } from '@/auth';
import { FactoryHome } from '@/../components/FactoryHome';
import { MarketingLanding } from '@/../components/MarketingLanding';

/** Гость vs сессия — нельзя кэшировать как статику (иначе «лендинг не виден» после логина/CDN). */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    return <MarketingLanding />;
  }
  return <FactoryHome />;
}
