import { NextResponse } from 'next/server';
import { getStorageEpoch } from '@/factory/store/db';

export async function GET() {
  return NextResponse.json({ ok: true, serverBootId: getStorageEpoch() });
}
