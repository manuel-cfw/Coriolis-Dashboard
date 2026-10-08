import { RADIATION_MAX } from "./labels";
import type { Character, GroupDetail, GroupListEntry, Ship, User } from "./types";

// Alle Seiten der Erweiterung (Popover, HUD, Hintergrund) laufen auf derselben
// Origin und teilen sich deshalb den Login über localStorage.
const TOKEN_KEY = "coriolis-dashboard:token";
const USER_KEY = "coriolis-dashboard:user";
export const AUTH_STORAGE_KEYS = [TOKEN_KEY, USER_KEY];

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Speicher blockiert (z. B. privater Modus) – Login gilt dann nur für diese Seite.
  }
}

export function getSession(): { token: string; user: User } | null {
  const token = readStorage(TOKEN_KEY);
  const rawUser = readStorage(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as User };
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User) {
  writeStorage(TOKEN_KEY, token);
  writeStorage(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  writeStorage(TOKEN_KEY, null);
  writeStorage(USER_KEY, null);
}

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid email or password": "E-Mail oder Passwort ist falsch.",
  "Account is disabled": "Dieses Konto ist deaktiviert.",
  "Not a member of this group": "Du bist kein Mitglied dieser Gruppe in der Coriolis-App.",
  "Only GM can update group": "Nur der Spielleiter der Gruppe darf das ändern.",
  "Access denied": "Keine Berechtigung für diesen Charakter.",
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    // Kein Browser-Cache: Werte müssen immer dem Stand der App entsprechen
    response = await fetch(`/api${path}`, { cache: "no-store", ...init, headers });
  } catch {
    throw new ApiError(0, "Coriolis-App nicht erreichbar.");
  }

  if (response.status === 401 && session) {
    clearSession();
    window.dispatchEvent(new Event("coriolis-auth-change"));
  }
  if (!response.ok) {
    let message = `Fehler ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = ERROR_MESSAGES[body.error] ?? body.error;
    } catch {
      // keine JSON-Antwort
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  async login(email: string, password: string): Promise<User> {
    const result = await request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(result.token, result.user);
    window.dispatchEvent(new Event("coriolis-auth-change"));
    return result.user;
  },
  async groups(): Promise<GroupListEntry[]> {
    const result = await request<{ groups: GroupListEntry[] }>("/groups");
    return result.groups;
  },
  group(groupId: string): Promise<GroupDetail> {
    return request<GroupDetail>(`/groups/${encodeURIComponent(groupId)}`);
  },
  async ship(groupId: string): Promise<Ship | null> {
    const result = await request<{ ship: Ship | null }>(`/groups/${encodeURIComponent(groupId)}/ship`);
    return result.ship;
  },
  updateDarkness(groupId: string, darknessPoints: number): Promise<unknown> {
    return request(`/groups/${encodeURIComponent(groupId)}`, {
      method: "PUT",
      body: JSON.stringify({ darknessPoints }),
    });
  },
  character(characterId: string): Promise<Character> {
    return request<Character>(`/characters/${encodeURIComponent(characterId)}`);
  },
  updateCharacter(
    characterId: string,
    patch: Partial<Pick<Character, "hp_current" | "mp_current" | "radiation">>
  ): Promise<Character> {
    return request<Character>(`/characters/${encodeURIComponent(characterId)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  /**
   * Ändert HP, Willenskraft oder Strahlung um `delta`. Der aktuelle Wert wird
   * unmittelbar vorher frisch aus der App gelesen, damit eine Änderung, die
   * dort inzwischen gemacht wurde, nicht mit einem veralteten Wert
   * überschrieben wird. Gibt den gespeicherten Wert zurück.
   */
  async adjustCharacter(characterId: string, key: "hp_current" | "mp_current" | "radiation", delta: number): Promise<number> {
    const fresh = await api.character(characterId);
    const max = key === "hp_current" ? fresh.hp_max : key === "mp_current" ? fresh.mp_max : RADIATION_MAX;
    const current = fresh[key] ?? 0;
    const next = Math.min(max, Math.max(0, current + delta));
    if (next !== current) await api.updateCharacter(characterId, { [key]: next });
    return next;
  },

  /** Wie adjustCharacter, für die Dunkelheitspunkte der Gruppe. */
  async adjustDarkness(groupId: string, delta: number): Promise<number> {
    const fresh = await api.group(groupId);
    const current = fresh.darknessPoints ?? 0;
    const next = Math.max(0, current + delta);
    if (next !== current) await api.updateDarkness(groupId, next);
    return next;
  },
};

/**
 * Absolute Bild-URL für Portrait und Token. Owlbear Rodeo lädt das Bild bei
 * allen Spielern, daher muss die URL öffentlich erreichbar sein – der
 * Dashboard-Server reicht /api/characters/:id/image an die App durch.
 */
export function characterImageUrl(character: { id: string; profile_image_id: string | null }): string {
  if (!character.profile_image_id) return `${window.location.origin}/token-default.png`;
  return `${window.location.origin}/api/characters/${encodeURIComponent(character.id)}/image?v=${encodeURIComponent(character.profile_image_id)}`;
}
