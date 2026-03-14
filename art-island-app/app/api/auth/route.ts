import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');

export async function POST(request: Request) {
  try {
    await connectDB();
    const { username, password, action } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    if (action === 'signup') {
      const existing = await User.findOne({ username });
      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashed });

      const token = await new SignJWT({ userId: user._id.toString(), username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(secret);

      const response = NextResponse.json({ success: true, username });
      response.cookies.set('auth-token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
      return response;
    }

    if (action === 'login') {
      const user = await User.findOne({ username });
      if (!user) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }

      const token = await new SignJWT({ userId: user._id.toString(), username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(secret);

      const response = NextResponse.json({ success: true, username });
      response.cookies.set('auth-token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
      return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}