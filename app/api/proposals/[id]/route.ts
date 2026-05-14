import { NextRequest, NextResponse } from 'next/server';
import { getProposal } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = getProposal(id);
    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    return NextResponse.json({ proposal });
  } catch (error) {
    return internal(error);
  }
}
