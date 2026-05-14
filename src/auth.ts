import { randomBytes } from 'node:crypto';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';
import { createUserWithDefaults } from '@/lib/provision-user';

/** Auth.js требует непустой `secret` для JWT/куки; без него `/api/auth/session` отдаёт 500 (ClientFetchError). */
function resolveAuthSecret(): string | undefined {
  const raw = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length > 0) return trimmed;
  if (process.env.NODE_ENV !== 'production') {
    return 'local-dev-auth-secret-do-not-use-in-prod-min-32-chars';
  }
  return undefined;
}

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
const googleProvider =
  googleId && googleSecret
    ? Google({
        clientId: googleId,
        clientSecret: googleSecret,
      })
    : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const prisma = getPrisma();
        if (!prisma || !credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(googleProvider ? [googleProvider] : []),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google' && profile && typeof profile === 'object' && 'email' in profile) {
        const emailRaw = (profile as { email?: string | null }).email;
        if (typeof emailRaw === 'string' && emailRaw) {
          const prisma = getPrisma();
          if (prisma) {
            const email = emailRaw.toLowerCase().trim();
            let dbUser = await prisma.user.findUnique({ where: { email } });
            if (!dbUser) {
              const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
              const name = (profile as { name?: string | null }).name ?? null;
              const created = await createUserWithDefaults(prisma, { email, passwordHash, name });
              dbUser = await prisma.user.findUniqueOrThrow({ where: { id: created.userId } });
            }
            token.sub = dbUser.id;
            token.email = dbUser.email ?? undefined;
            token.name = dbUser.name ?? undefined;
          }
        }
        return token;
      }
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
