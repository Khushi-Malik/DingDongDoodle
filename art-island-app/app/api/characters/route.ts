import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

// ─── Schema ───────────────────────────────────────────────────────────────────

const memorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const characterSchema = new mongoose.Schema({
  userId: String,
  name: String,
  age: Number,
  imageUrl: String,
  position: { x: Number, y: Number },
  islandId: Number,
  joints: { type: mongoose.Schema.Types.Mixed, default: null },
  riggedAt: { type: Date, default: null },
  // Memories: short life facts / story events the character has experienced
  memories: { type: [memorySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const Character =
  mongoose.models.Character || mongoose.model("Character", characterSchema);

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeCharacter(char: mongoose.Document & Record<string, unknown>) {
  const c = char as unknown as {
    _id: { toString(): string };
    imageUrl: string;
    name: string;
    age: number;
    position: { x: number; y: number };
    islandId: number;
    joints: unknown;
    memories: Array<{ id: string; text: string; createdAt: Date }>;
  };
  return {
    id: c._id.toString(),
    imageUrl: c.imageUrl,
    name: c.name,
    age: c.age,
    position: c.position,
    islandId: c.islandId,
    joints: c.joints ?? null,
    memories: (c.memories ?? []).map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.createdAt,
    })),
  };
}

// ─── GET — list all characters for user ───────────────────────────────────────

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const characters = await Character.find({ userId }).sort({ createdAt: 1 });

    return NextResponse.json(characters.map(serializeCharacter));
  } catch (error) {
    console.error("GET /api/characters error:", error);
    return NextResponse.json(
      { error: "Failed to load characters" },
      { status: 500 }
    );
  }
}

// ─── POST — create a new character ────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await request.json();

    const character = await Character.create({
      userId,
      name: body.name,
      age: body.age,
      imageUrl: body.imageUrl,
      position: body.position,
      islandId: body.islandId,
      joints: body.joints ?? null,
      memories: [],
    });

    return NextResponse.json(serializeCharacter(character));
  } catch (error) {
    console.error("POST /api/characters error:", error);
    return NextResponse.json(
      { error: "Failed to save character" },
      { status: 500 }
    );
  }
}

// ─── PATCH — add or remove a memory on a specific character ──────────────────
//
//  Body shapes:
//    { action: "add",    characterId: string, memory: { id, text } }
//    { action: "remove", characterId: string, memoryId: string }

export async function PATCH(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await request.json();
    const { action, characterId, memory, memoryId } = body;

    if (!characterId || !action) {
      return NextResponse.json(
        { error: "characterId and action are required" },
        { status: 400 }
      );
    }

    const char = await Character.findOne({ _id: characterId, userId });
    if (!char) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (action === "add") {
      if (!memory?.id || !memory?.text) {
        return NextResponse.json(
          { error: "memory.id and memory.text are required for add" },
          { status: 400 }
        );
      }
      char.memories.push({ id: memory.id, text: memory.text, createdAt: new Date() });
    } else if (action === "remove") {
      if (!memoryId) {
        return NextResponse.json(
          { error: "memoryId is required for remove" },
          { status: 400 }
        );
      }
      char.memories = char.memories.filter(
        (m: { id: string }) => m.id !== memoryId
      );
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await char.save();
    return NextResponse.json(serializeCharacter(char));
  } catch (error) {
    console.error("PATCH /api/characters error:", error);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 }
    );
  }
}