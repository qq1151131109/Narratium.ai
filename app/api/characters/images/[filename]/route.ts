/**
 * Character Images API - Serve character images
 *
 * This endpoint serves character avatar images stored on the server.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";
export const revalidate = 0;

const IMAGES_DIR = path.join(process.cwd(), "data", "character-images");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const imagePath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(imagePath)) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 },
      );
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(filename).toLowerCase();

    let contentType = "image/png";
    if (ext === ".jpg" || ext === ".jpeg") {
      contentType = "image/jpeg";
    } else if (ext === ".gif") {
      contentType = "image/gif";
    } else if (ext === ".webp") {
      contentType = "image/webp";
    }

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return NextResponse.json(
      { success: false, error: "Failed to serve image" },
      { status: 500 },
    );
  }
}
