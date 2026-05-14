import { NextRequest, NextResponse } from 'next/server';
import { getCompanyState } from '@/factory/modules/controlPlane';
import { notFound } from '@/factory/api/errors';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getCompanyState(id);
  if (!state) return notFound('company_not_found');
  return NextResponse.json(state);
}
