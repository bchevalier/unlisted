import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthValidationError, resetPasswordWithToken } from '../../../../../../../features/direct/server/auth';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    await resetPasswordWithToken(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
