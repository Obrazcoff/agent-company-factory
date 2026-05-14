import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';

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
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
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
