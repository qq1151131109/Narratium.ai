/**
 * Characters API - Server-side storage for character cards
 *
 * This API provides CRUD operations for character cards stored on the server.
 * All users accessing the application will share the same character cards.
 *
 * Endpoints:
 * - GET /api/characters - Get all characters
 * - POST /api/characters - Create a new character
 * - PUT /api/characters - Update a character
 * - DELETE /api/characters?id={characterId} - Delete a character
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), "data");
const CHARACTERS_FILE = path.join(DATA_DIR, "characters.json");
const IMAGES_DIR = path.join(DATA_DIR, "character-images");

// Ensure data directory exists
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  if (!fs.existsSync(CHARACTERS_FILE)) {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify([], null, 2));
  }
}

// Read characters from file
function readCharacters() {
  ensureDataDirectory();
  try {
    const data = fs.readFileSync(CHARACTERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading characters file:", error);
    return [];
  }
}

// Write characters to file
function writeCharacters(characters: any[]) {
  ensureDataDirectory();
  fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(characters, null, 2));
}

/**
 * GET - Get all characters
 */
export async function GET() {
  try {
    const characters = readCharacters();
    return NextResponse.json({ success: true, data: characters });
  } catch (error) {
    console.error("Error in GET /api/characters:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch characters" },
      { status: 500 },
    );
  }
}

/**
 * POST - Create a new character
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data, imagePath, imageData } = body;

    if (!id || !data) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: id, data" },
        { status: 400 },
      );
    }

    const characters = readCharacters();

    // Check if character already exists
    const existingIndex = characters.findIndex((char: any) => char.id === id);
    if (existingIndex !== -1) {
      return NextResponse.json(
        { success: false, error: "Character with this ID already exists" },
        { status: 409 },
      );
    }

    // Save image if provided
    let savedImagePath = imagePath;
    if (imageData) {
      const imageFileName = `${id}.png`;
      const imageFilePath = path.join(IMAGES_DIR, imageFileName);

      // Convert base64 to buffer and save
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(imageFilePath, base64Data, "base64");

      savedImagePath = `/api/characters/images/${imageFileName}`;
    }

    const newCharacter = {
      id,
      data,
      imagePath: savedImagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    characters.push(newCharacter);
    writeCharacters(characters);

    return NextResponse.json({ success: true, data: newCharacter });
  } catch (error) {
    console.error("Error in POST /api/characters:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create character" },
      { status: 500 },
    );
  }
}

/**
 * PUT - Update a character
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data, imagePath, imageData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: id" },
        { status: 400 },
      );
    }

    const characters = readCharacters();
    const index = characters.findIndex((char: any) => char.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Character not found" },
        { status: 404 },
      );
    }

    // Save new image if provided
    let savedImagePath = characters[index].imagePath;
    if (imageData) {
      const imageFileName = `${id}.png`;
      const imageFilePath = path.join(IMAGES_DIR, imageFileName);

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(imageFilePath, base64Data, "base64");

      savedImagePath = `/api/characters/images/${imageFileName}`;
    } else if (imagePath) {
      savedImagePath = imagePath;
    }

    characters[index] = {
      ...characters[index],
      data: data || characters[index].data,
      imagePath: savedImagePath,
      updated_at: new Date().toISOString(),
    };

    writeCharacters(characters);

    return NextResponse.json({ success: true, data: characters[index] });
  } catch (error) {
    console.error("Error in PUT /api/characters:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update character" },
      { status: 500 },
    );
  }
}

/**
 * DELETE - Delete a character
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: id" },
        { status: 400 },
      );
    }

    const characters = readCharacters();
    const index = characters.findIndex((char: any) => char.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Character not found" },
        { status: 404 },
      );
    }

    // Delete character image if exists
    const imageFileName = `${id}.png`;
    const imageFilePath = path.join(IMAGES_DIR, imageFileName);
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }

    characters.splice(index, 1);
    writeCharacters(characters);

    return NextResponse.json({ success: true, message: "Character deleted" });
  } catch (error) {
    console.error("Error in DELETE /api/characters:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete character" },
      { status: 500 },
    );
  }
}
