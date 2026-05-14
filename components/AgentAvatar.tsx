import { avatarPublicPath, normalizeAvatarSlug } from '@/factory/modules/agentCodename';

export function AgentAvatar({
  slug,
  className = 'h-10 w-10 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] object-contain p-1',
}: {
  slug: string;
  className?: string;
}) {
  const safe = normalizeAvatarSlug(slug);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarPublicPath(safe)} alt="" className={className} width={40} height={40} />
  );
}
