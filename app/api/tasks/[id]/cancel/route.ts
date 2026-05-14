import { NextRequest, NextResponse } from 'next/server';
import { cancelTask } from '@/factory/modules/orchestrator';
import { internal, notFound } from '@/factory/api/errors';
import { db } from '@/factory/store/db';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!db().tasks.get(id)) return notFound('task_not_found');
    const updated = cancelTask(id, 'human_override');
    return NextResponse.json({ task: updated });
  } catch (error) {
    return internal(error);
  }
}
