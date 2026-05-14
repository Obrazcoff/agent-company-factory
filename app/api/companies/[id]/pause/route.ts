import { NextRequest, NextResponse } from 'next/server';
import { PauseRequestSchema } from '@/factory/domain/schemas';
import { pauseCompany } from '@/factory/modules/orchestrator';
import { internal } from '@/factory/api/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = PauseRequestSchema.parse(body);
    const updated = pauseCompany(id, parsed.paused);
    return NextResponse.json({ company: updated });
  } catch (error) {
    return internal(error);
  }
}
