import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

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

function fileContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

async function callPythonWorker(
  imageBuffer: Buffer,
  useEditor: boolean
): Promise<{ rigJson: unknown; files: Record<string, { contentType: string; dataBase64: string }> }> {
  const workerUrl = process.env.RIG_WORKER_URL;
  const workerSecret = process.env.RIG_WORKER_SECRET;

  if (!workerUrl || !workerSecret) {
    throw new Error(
      "RIG_WORKER_URL and RIG_WORKER_SECRET environment variables must be set for Vercel deployment"
    );
  }

  // Create FormData with image
  const formData = new FormData();
  formData.append("image", new Blob([Uint8Array.from(imageBuffer)], { type: "image/png" }), "input.png");
  formData.append("use_editor", String(useEditor));

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "X-Worker-Secret": workerSecret,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Python worker failed: ${response.status} - ${errorText}`
    );
  }

  const result = await response.json() as {
    ok: boolean;
    rigJson?: unknown;
    files?: Record<string, { contentType: string; dataBase64: string }>;
    error?: string;
  };

  if (!result.ok || !result.rigJson || !result.files) {
    throw new Error(`Python worker error: ${result.error || "Unknown error"}`);
  }

  return {
    rigJson: result.rigJson,
    files: result.files,
  };
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

    const rigApiPath = `/api/rig/${characterId}/rig.json`;

    try {
      let imageBuffer: Buffer;
      const fromData = decodeDataUrl(imageUrl);
      if (fromData) {
        imageBuffer = fromData;
      } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const res = await fetch(imageUrl);
        if (!res.ok) {
          throw new Error("Failed to download character image");
        }
        imageBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        throw new Error("Unsupported imageUrl format. Expected data URL or http(s) URL.");
      }

      const sourceHash = createHash("sha256").update(imageBuffer).digest("hex");

      const existingAssets = (char as { rigAssets?: unknown }).rigAssets as
        | {
            rigJson?: unknown;
            files?: Record<string, { contentType: string; dataBase64: string }>;
            sourceHash?: string;
          }
        | undefined;
      if (
        existingAssets?.rigJson &&
        existingAssets?.files &&
        Object.keys(existingAssets.files).length > 0 &&
        existingAssets.sourceHash === sourceHash
      ) {
        const existingRiggedAt =
          (char as { riggedAt?: Date | null }).riggedAt?.toISOString() ??
          new Date().toISOString();
        return NextResponse.json({
          ok: true,
          rigPath: rigApiPath,
          riggedAt: existingRiggedAt,
          cached: true,
        });
      }

      // Call Python worker instead of local execution
      const workerResponse = await callPythonWorker(imageBuffer, useEditor);
      const rigJson = workerResponse.rigJson;
      const rigFiles = workerResponse.files;

      const riggedAt = new Date();
      await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(characterId), userId },
        {
          $set: {
            rigPath: rigApiPath,
            riggedAt,
            rigAssets: {
              sourceHash,
              rigJson,
              files: rigFiles,
              generatedAt: riggedAt,
            },
          },
        }
      );

      return NextResponse.json({
        ok: true,
        rigPath: rigApiPath,
        riggedAt: riggedAt.toISOString(),
        cached: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate rig";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate rig";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
