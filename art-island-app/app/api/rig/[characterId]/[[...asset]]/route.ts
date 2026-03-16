import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me",
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

function asObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function normalizeAssetPath(asset?: string[]) {
  if (!asset || asset.length === 0) return "rig.json";
  return asset.join("/").replace(/\\/g, "/").replace(/^\/+/, "");
}

function contentTypeForAsset(assetPath: string, stored?: string) {
  if (stored) return stored;
  if (assetPath.endsWith(".png")) return "image/png";
  if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg")) return "image/jpeg";
  if (assetPath.endsWith(".webp")) return "image/webp";
  if (assetPath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ characterId: string; asset?: string[] }> },
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { characterId, asset } = await params;
    const objectId = asObjectId(characterId);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid characterId" }, { status: 400 });
    }

    const assetPath = normalizeAssetPath(asset);
    if (assetPath.includes("..")) {
      return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
    }

    await connectDB();
    const collection = mongoose.connection.collection("characters");
    const char = (await collection.findOne(
      { _id: objectId, userId },
      {
        projection: {
          rigAssets: 1,
        },
      },
    )) as
      | {
          rigAssets?: {
            rigJson?: unknown;
            files?: Record<string, { contentType?: string; dataBase64: string }>;
          };
        }
      | null;

    if (!char?.rigAssets?.rigJson) {
      return NextResponse.json({ error: "Rig not found" }, { status: 404 });
    }

    if (assetPath === "rig.json") {
      return NextResponse.json(char.rigAssets.rigJson, {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      });
    }

    const file = char.rigAssets.files?.[assetPath];
    if (!file?.dataBase64) {
      return NextResponse.json({ error: "Rig asset not found" }, { status: 404 });
    }

    const buf = Buffer.from(file.dataBase64, "base64");
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForAsset(assetPath, file.contentType),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rig asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
