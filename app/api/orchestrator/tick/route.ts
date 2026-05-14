import { NextResponse } from 'next/server';
import { tick } from '@/factory/modules/orchestrator';
import { internal } from '@/factory/api/errors';

export async function POST() {
  try {
    const result = await tick();
    return NextResponse.json(result);
  } catch (error) {
    return internal(error);
  }
}
