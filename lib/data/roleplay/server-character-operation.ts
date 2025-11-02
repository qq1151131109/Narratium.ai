/**
 * Server Character Storage Operations
 *
 * This module provides operations for storing and retrieving character cards
 * from the server, allowing all users to share the same character cards.
 */

import { RawCharacterData } from "@/lib/models/rawdata-model";

export interface ServerCharacterRecord {
  id: string;
  data: RawCharacterData;
  imagePath: string;
  created_at: string;
  updated_at: string;
}

/**
 * Server-side character operations
 */
export class ServerCharacterOperations {
  private static baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  /**
   * Get all characters from server
   */
  static async getAllCharacters(): Promise<ServerCharacterRecord[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/characters`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch characters: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error("Error fetching characters from server:", error);
      return [];
    }
  }

  /**
   * Get a single character by ID
   */
  static async getCharacterById(
    characterId: string,
  ): Promise<ServerCharacterRecord | null> {
    try {
      const characters = await this.getAllCharacters();
      return characters.find((char) => char.id === characterId) || null;
    } catch (error) {
      console.error("Error fetching character by ID:", error);
      return null;
    }
  }

  /**
   * Create a new character
   */
  static async createCharacter(
    characterId: string,
    rawCharacterData: RawCharacterData,
    imageData?: string,
  ): Promise<ServerCharacterRecord | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: characterId,
          data: rawCharacterData,
          imageData: imageData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create character");
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error creating character:", error);
      return null;
    }
  }

  /**
   * Update an existing character
   */
  static async updateCharacter(
    characterId: string,
    characterData: Partial<RawCharacterData>,
    imageData?: string,
  ): Promise<ServerCharacterRecord | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/characters`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: characterId,
          data: characterData,
          imageData: imageData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update character");
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error updating character:", error);
      return null;
    }
  }

  /**
   * Delete a character
   */
  static async deleteCharacter(characterId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/characters?id=${characterId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete character");
      }

      return true;
    } catch (error) {
      console.error("Error deleting character:", error);
      return false;
    }
  }

  /**
   * Migrate characters from IndexedDB to server
   */
  static async migrateFromIndexedDB(): Promise<{
    success: number;
    failed: number;
  }> {
    try {
      // Import the local storage operations dynamically
      const { LocalCharacterRecordOperations } = await import(
        "@/lib/data/roleplay/character-record-operation"
      );
      const { getBlob } = await import("@/lib/data/local-storage");

      const localCharacters =
        await LocalCharacterRecordOperations.getAllCharacters();

      let success = 0;
      let failed = 0;

      for (const localChar of localCharacters) {
        try {
          // Get character image from IndexedDB
          let imageData: string | undefined;
          if (localChar.imagePath) {
            const blob = await getBlob(localChar.imagePath);
            if (blob) {
              imageData = await this.blobToBase64(blob);
            }
          }

          // Create character on server
          const result = await this.createCharacter(
            localChar.id,
            localChar.data,
            imageData,
          );

          if (result) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Failed to migrate character ${localChar.id}:`, error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error("Error migrating characters:", error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Convert Blob to base64
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
