import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const storySettingSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  label: { type: String, required: true },
  emoji: { type: String, default: "✨" },
  createdAt: { type: Date, default: Date.now },
});

const StorySetting =
  mongoose.models.StorySetting ||
  mongoose.model("StorySetting", storySettingSchema);

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me"
);

async function getUserId() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const settings = await StorySetting.find({ userId }).sort({ createdAt: 1 });

    return NextResponse.json(
      settings.map((setting) => ({
        id: setting._id.toString(),
        label: setting.label,
        emoji: setting.emoji,
        custom: true,
        createdAt: setting.createdAt,
      }))
    );
  } catch (error) {
    console.error("GET /api/story-settings error:", error);
    return NextResponse.json(
      { error: "Failed to load story settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();

    const label = String(body.label || "").trim();
    const emoji = String(body.emoji || "✨").trim() || "✨";

    if (!label) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const setting = await StorySetting.create({ userId, label, emoji });

    return NextResponse.json({
      id: setting._id.toString(),
      label: setting.label,
      emoji: setting.emoji,
      custom: true,
      createdAt: setting.createdAt,
    });
  } catch (error) {
    console.error("POST /api/story-settings error:", error);
    return NextResponse.json(
      { error: "Failed to save story setting" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await connectDB();
    const result = await StorySetting.deleteOne({ _id: id, userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Story setting not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/story-settings error:", error);
    return NextResponse.json(
      { error: "Failed to delete story setting" },
      { status: 500 }
    );
  }
}
