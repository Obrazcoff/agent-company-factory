import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { POST as registerPOST } from '../../app/api/register/route';

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

function cookieJarFromResponse(jar: Record<string, string>, res: Response): void {
  const list =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (() => {
          const single = res.headers.get('set-cookie');
          return single ? [single] : [];
        })();
  for (const line of list) {
    const pair = line.split(';')[0]?.trim();
    if (!pair?.includes('=')) continue;
    const name = pair.split('=')[0];
    if (/max-age=0|expires=thu, 01 jan 1970/i.test(line)) delete jar[name];
    else jar[name] = pair;
  }
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.values(jar).join('; ');
}

describe.skipIf(!hasDb)('register + credentials login (NextAuth handlers)', () => {
  const base = 'http://localhost:3000';
  const email = `vitest-auth-${Date.now()}@example.com`;
  const password = 'TestPass12';
  const jar: Record<string, string> = {};

  beforeAll(() => {
    process.env.AUTH_SECRET =
      process.env.AUTH_SECRET?.trim() || 'vitest-auth-secret-do-not-use-prod-min-32-chars';
    process.env.AUTH_URL = process.env.AUTH_URL?.trim() || base;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });

  it('POST /api/register creates user; credentials sign-in yields session with email', async () => {
    const regReq = new NextRequest(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Vitest Auth' }),
    });
    const regRes = await registerPOST(regReq);
    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as { userId?: string; projectId?: string; email?: string };
    expect(regJson.email).toBe(email);
    expect(regJson.userId).toBeTruthy();

    const { handlers } = await import('@/auth');

    const csrfRes = await handlers.GET(new NextRequest(`${base}/api/auth/csrf`));
    expect(csrfRes.status).toBe(200);
    cookieJarFromResponse(jar, csrfRes);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
    expect(csrfToken?.length).toBeGreaterThan(10);

    const form = new URLSearchParams({
      csrfToken: csrfToken!,
      email,
      password,
      callbackUrl: `${base}/`,
      json: 'true',
    });
    const credReq = new NextRequest(`${base}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(jar),
      },
      body: form.toString(),
    });
    const credRes = await handlers.POST(credReq);
    cookieJarFromResponse(jar, credRes);
    expect([200, 302]).toContain(credRes.status);

    const sessReq = new NextRequest(`${base}/api/auth/session`, {
      headers: { Cookie: cookieHeader(jar) },
    });
    const sessRes = await handlers.GET(sessReq);
    expect(sessRes.status).toBe(200);
    const session = (await sessRes.json()) as {
      user?: { email?: string | null; id?: string };
    };
    expect(session.user?.email).toBe(email);
    expect(session.user?.id).toBe(regJson.userId);
  });

  it('POST /api/register duplicate email → 409', async () => {
    const regReq = new NextRequest(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'OtherPass12', name: 'Dup' }),
    });
    const regRes = await registerPOST(regReq);
    expect(regRes.status).toBe(409);
  });
});
