import { api } from "./api";
import type { RoomSettings } from "./settings";
import { getCharacterTokens, syncTokens, tokenMeta, type TokenCharacter } from "./tokens";

/**
 * Lädt für alle Charakter-Tokens der Szene die aktuellen Werte aus der
 * Coriolis-App und überträgt sie auf die Tokens.
 */
export async function syncSceneWithApp(settings: RoomSettings): Promise<number> {
  const tokens = await getCharacterTokens();
  const ids = [...new Set(tokens.map((token) => tokenMeta(token)!.characterId))];
  if (ids.length === 0) return 0;
  const characters = await Promise.all(ids.map((id) => api.character(id).catch(() => null)));
  const map = new Map<string, TokenCharacter>();
  for (const character of characters) if (character) map.set(character.id, character);
  return syncTokens(map, settings);
}
