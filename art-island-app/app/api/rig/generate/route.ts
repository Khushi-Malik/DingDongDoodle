import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
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

async function resolvePythonScript(appRoot: string): Promise<string> {
  const envScript = process.env.RIG_PYTHON_SCRIPT?.trim();
  const candidates = [
    envScript
      ? path.isAbsolute(envScript)
        ? envScript
        : path.resolve(appRoot, envScript)
      : "",
    path.resolve(appRoot, "image_mesh_animation/arap_animate.py"),
    path.resolve(appRoot, "image_2/arap_animate.py"),
    path.resolve(appRoot, "../image_mesh_animation/arap_animate.py"),
    path.resolve(appRoot, "../image_2/arap_animate.py"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep trying fallbacks.
    }
  }

  throw new Error(
    `Could not find rig script. Set RIG_PYTHON_SCRIPT or place arap_animate.py in one of: ${candidates.join(", ")}`
  );
}

function runPython(scriptPath: string, args: string[]): Promise<void> {
  const pythonBin = process.env.RIG_PYTHON_BIN?.trim() || "python3";
  return new Promise((resolve, reject) => {
    execFile(
      pythonBin,
      [scriptPath, ...args],
      {
        cwd: path.dirname(scriptPath),
        maxBuffer: 1024 * 1024 * 20,
      },
      (error) => {
      if (error) reject(error);
      else resolve();
      }
    );
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
    const pythonScript = await resolvePythonScript(appRoot);
    const rigApiPath = `/api/rig/${characterId}/rig.json`;

    const tmp = await fs.mkdtemp(path.join(tmpdir(), `rig-${characterId}-`));
    const inputPath = path.join(tmp, "input.png");
    const outDir = path.join(tmp, "out");
    await fs.mkdir(outDir, { recursive: true });

    try {
      let imageBuffer: Buffer;
      const fromData = decodeDataUrl(imageUrl);
      if (fromData) {
        imageBuffer = fromData;
        await fs.writeFile(inputPath, imageBuffer);
      } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const res = await fetch(imageUrl);
        if (!res.ok) {
          throw new Error("Failed to download character image");
        }
        imageBuffer = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(inputPath, imageBuffer);
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

      await runPython(
        pythonScript,
        useEditor
          ? [inputPath, "--out", outDir]
          : [inputPath, "--out", outDir, "--no-editor"]
      );

      const rigJsonPath = path.join(outDir, "rig.json");
      await fs.access(rigJsonPath);

      const rigRaw = await fs.readFile(rigJsonPath, "utf8");
      const rigJson = JSON.parse(rigRaw) as {
        parts?: Record<string, { file?: string }>;
      };

      const fileKeys = Array.from(
        new Set(
          Object.values(rigJson.parts ?? {})
            .map((part) => String(part?.file ?? "").trim().replace(/\\/g, "/"))
            .filter(Boolean),
        ),
      );

      const rigFiles: Record<string, { contentType: string; dataBase64: string }> = {};
      for (const fileKey of fileKeys) {
        const sanitized = fileKey.replace(/^\/+/, "");
        if (sanitized.includes("..")) {
          throw new Error(`Unsafe rig file path: ${fileKey}`);
        }
        const absPath = path.resolve(outDir, sanitized);
        if (!absPath.startsWith(path.resolve(outDir))) {
          throw new Error(`Rig file escapes output directory: ${fileKey}`);
        }
        const buf = await fs.readFile(absPath);
        rigFiles[sanitized] = {
          contentType: fileContentType(sanitized),
          dataBase64: buf.toString("base64"),
        };
      }

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
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate rig";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
