import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

// ─── Schema ───────────────────────────────────────────────────────────────────

const islandSchema = new mongoose.Schema({
  userId:  { type: String, required: true, index: true },
  id:      { type: Number, required: true },   // the client-side numeric id
  x:       { type: Number, default: 50 },
  y:       { type: Number, default: 50 },
  size:    { type: Number, default: 620 },
  color:   { type: String, default: "" },
  border:  { type: String, default: "" },
  label:   { type: String, default: "" },
  skin:    { type: String, default: "" },       // ← "dirt" | "sand" | "stone" | ""
  createdAt: { type: Date, default: Date.now },
});

const Island = mongoose.models.Island || mongoose.model("Island", islandSchema);

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

// ─── Serialize ────────────────────────────────────────────────────────────────

function serialize(doc: mongoose.Document) {
  const d = doc as unknown as {
    id: number; x: number; y: number; size: number;
    color: string; border: string; label: string; skin: string;
  };
  return {
    id:     d.id,
    x:      d.x,
    y:      d.y,
    size:   d.size,
    color:  d.color,
    border: d.border,
    label:  d.label,
    skin:   d.skin ?? "",   // always return skin, never undefined
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const islands = await Island.find({ userId }).sort({ createdAt: 1 });
    return NextResponse.json(islands.map(serialize));
  } catch (error) {
    console.error("GET /api/islands error:", error);
    return NextResponse.json({ error: "Failed to load islands" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await request.json();

    const island = await Island.create({
      userId,
      id:     body.id,
      x:      body.x     ?? 50,
      y:      body.y     ?? 50,
      size:   body.size  ?? 620,
      color:  body.color  ?? "",
      border: body.border ?? "",
      label:  body.label  ?? "",
      skin:   body.skin   ?? "",   // ← persist whatever the client sends
    });

    return NextResponse.json(serialize(island));
  } catch (error) {
    console.error("POST /api/islands error:", error);
    return NextResponse.json({ error: "Failed to save island" }, { status: 500 });
  }
}

// ─── PATCH — update an existing island (e.g. change skin) ────────────────────
// Body: { id: number, ...fields to update }

export async function PATCH(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await request.json();
    const { id, ...updates } = body;

    if (id === undefined)
      return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Only allow safe fields to be patched
    const allowed = ["label", "color", "border", "skin", "x", "y"];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) patch[key] = updates[key];
    }

    const island = await Island.findOneAndUpdate(
      { userId, id },
      { $set: patch },
      { new: true }
    );

    if (!island)
      return NextResponse.json({ error: "Island not found" }, { status: 404 });

    return NextResponse.json(serialize(island));
  } catch (error) {
    console.error("PATCH /api/islands error:", error);
    return NextResponse.json({ error: "Failed to update island" }, { status: 500 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
// Query: ?id=<numeric island id>

export async function DELETE(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id)
      return NextResponse.json({ error: "id is required" }, { status: 400 });

    await connectDB();
    const result = await Island.deleteOne({ userId, id });

    if (result.deletedCount === 0)
      return NextResponse.json({ error: "Island not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/islands error:", error);
    return NextResponse.json({ error: "Failed to delete island" }, { status: 500 });
  }
}