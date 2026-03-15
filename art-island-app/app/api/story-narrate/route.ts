import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me"
);

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── API key ─────────────────────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // ── Body ────────────────────────────────────────────────────────────────
    const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();

    if (!content) {
      return NextResponse.json(
        { error: "Story content is required" },
        { status: 400 }
      );
    }

    // Keep narration requests bounded to avoid oversized payloads.
    const inputText = `${title ? `${title}. ` : ""}${content}`.slice(0, 5000);

    // ── OpenAI TTS ──────────────────────────────────────────────────────────
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        format: "mp3",
        input: inputText,
      }),
    });

    if (!ttsResponse.ok) {
      const errPayload = await ttsResponse.json().catch(() => null);
      return NextResponse.json(
        {
          error:
            errPayload?.error?.message ||
            errPayload?.message ||
            "Failed to generate narration",
        },
        { status: ttsResponse.status }
      );
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("POST /api/story-narrate error:", error);
    return NextResponse.json(
      { error: "Failed to narrate story" },
      { status: 500 }
    );
  }
}