import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const storySchema = new mongoose.Schema({
  userId: String,
  title: String,
  content: String,
  characterIds: { type: [String], default: [] },
  characterNames: { type: [String], default: [] },
  concept: { type: String, default: "" },
  setting: { type: String, default: "" },
  settingLabel: { type: String, default: "" },
  childName: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const Story = mongoose.models.Story || mongoose.model("Story", storySchema);

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

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const stories = await Story.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json(
      stories.map((story) => ({
        id: story._id.toString(),
        title: story.title,
        content: story.content,
        characterIds: story.characterIds,
        characterNames: story.characterNames,
        concept: story.concept,
        setting: story.setting,
        settingLabel: story.settingLabel,
        childName: story.childName,
        createdAt: story.createdAt,
      }))
    );
  } catch (error) {
    console.error("GET /api/stories error:", error);
    return NextResponse.json(
      { error: "Failed to load stories" },
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

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const characterIds: string[] = [];
    if (Array.isArray(body.characterIds)) {
      for (const id of body.characterIds as unknown[]) {
        if (typeof id === "string") {
          characterIds.push(id);
        }
      }
    }

    const characterNames: string[] = [];
    if (Array.isArray(body.characterNames)) {
      for (const name of body.characterNames as unknown[]) {
        if (typeof name === "string") {
          characterNames.push(name);
        }
      }
    }
    const concept = String(body.concept || "").trim();
    const setting = String(body.setting || "").trim();
    const settingLabel = String(body.settingLabel || "").trim();
    const childName = String(body.childName || "").trim();

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    if (characterIds.length === 0) {
      return NextResponse.json(
        { error: "At least one character is required" },
        { status: 400 }
      );
    }

    const story = await Story.create({
      userId,
      title,
      content,
      characterIds,
      characterNames,
      concept,
      setting,
      settingLabel,
      childName,
    });

    return NextResponse.json({
      id: story._id.toString(),
      title: story.title,
      content: story.content,
      characterIds: story.characterIds,
      characterNames: story.characterNames,
      concept: story.concept,
      setting: story.setting,
      settingLabel: story.settingLabel,
      childName: story.childName,
      createdAt: story.createdAt,
    });
  } catch (error) {
    console.error("POST /api/stories error:", error);
    return NextResponse.json(
      { error: "Failed to save story" },
      { status: 500 }
    );
  }
}
