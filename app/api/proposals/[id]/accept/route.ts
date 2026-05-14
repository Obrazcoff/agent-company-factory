import { NextRequest, NextResponse } from 'next/server';
import { acceptProposal } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';
import { getStorageEpoch } from '@/factory/store/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await acceptProposal(id);
    return NextResponse.json({ ...result, serverBootId: getStorageEpoch() }, { status: 200 });
  } catch (error) {
    return internal(error);
  }
}
