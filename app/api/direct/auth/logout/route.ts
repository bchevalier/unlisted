import { NextResponse } from 'next/server';
import { KEEPER_SESSION_COOKIE } from '../../../../../lib/keeper-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(KEEPER_SESSION_COOKIE, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return response;
}
