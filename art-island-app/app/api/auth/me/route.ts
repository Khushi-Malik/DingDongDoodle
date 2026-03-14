import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return NextResponse.json({ user: null });

    const { payload } = await jwtVerify(token, secret);
    return NextResponse.json({ user: { userId: payload.userId, username: payload.username } });
  } catch {
    return NextResponse.json({ user: null });
  }
}