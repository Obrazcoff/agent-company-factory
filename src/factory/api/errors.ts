import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = 'not_found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 409 });
}

export function internal(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'validation_failed', issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: 'internal_error', message }, { status: 500 });
}
