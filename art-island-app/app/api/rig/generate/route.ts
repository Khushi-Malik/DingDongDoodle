import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";

export const runtime = "nodejs";

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

function decodeDataUrl(url: string): Buffer | null {
  if (!url.startsWith("data:image")) return null;
  const idx = url.indexOf(",");
  if (idx < 0) return null;
  const b64 = url.slice(idx + 1);
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

function runPython(scriptPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("python3", [scriptPath, ...args], { maxBuffer: 1024 * 1024 * 20 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const characterId = String(body?.characterId ?? "").trim();
    const useEditor = Boolean(body?.useEditor);
    if (!characterId)
      return NextResponse.json({ error: "characterId is required" }, { status: 400 });

    await connectDB();
    const collection = mongoose.connection.collection("characters");
    const char = await collection.findOne({
      _id: new mongoose.Types.ObjectId(characterId),
      userId,
    });

    if (!char) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const imageUrl = String(char.imageUrl ?? "");
    if (!imageUrl) {
      return NextResponse.json({ error: "Character has no imageUrl" }, { status: 400 });
    }

    const appRoot = process.cwd();
    const pythonScript = path.resolve(appRoot, "../image_2/arap_animate.py");
    const rigsRoot = path.resolve(appRoot, "public/rigs");
    const outDir = path.join(rigsRoot, characterId);

    await fs.mkdir(rigsRoot, { recursive: true });

    const tmp = await fs.mkdtemp(path.join(tmpdir(), `rig-${characterId}-`));
    const inputPath = path.join(tmp, "input.png");

    try {
      const fromData = decodeDataUrl(imageUrl);
      if (fromData) {
        await fs.writeFile(inputPath, fromData);
      } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const res = await fetch(imageUrl);
        if (!res.ok) {
          throw new Error("Failed to download character image");
        }
        const buf = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(inputPath, buf);
      } else {
        throw new Error("Unsupported imageUrl format. Expected data URL or http(s) URL.");
      }

      await runPython(
        pythonScript,
        useEditor
          ? [inputPath, "--out", outDir]
          : [inputPath, "--out", outDir, "--no-editor"]
      );

      const rigJsonPath = path.join(outDir, "rig.json");
      await fs.access(rigJsonPath);

      const rigPath = `/rigs/${characterId}/rig.json`;
      const riggedAt = new Date();
      await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(characterId), userId },
        { $set: { rigPath, riggedAt } }
      );

      return NextResponse.json({ ok: true, rigPath, riggedAt: riggedAt.toISOString() });
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate rig";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
