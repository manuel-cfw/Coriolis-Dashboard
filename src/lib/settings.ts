import OBR from "@owlbear-rodeo/sdk";

export const EXT_ID = "de.coriolis.dashboard";
export const ROOM_KEY = `${EXT_ID}/room`;
export const PLAYER_KEY = `${EXT_ID}/player`;
export const TOKEN_KEY = `${EXT_ID}/token`;
export const REFRESH_CHANNEL = `${EXT_ID}/refresh`;
export const POPOVER_TOP = `${EXT_ID}/hud-top`;
export const POPOVER_CREW = `${EXT_ID}/hud-crew`;
export const POPOVER_DETAIL = `${EXT_ID}/hud-detail`;
export const MODAL_ID = `${EXT_ID}/modal`;

export type InfoField =
  | "group"
  | "ship"
  | "darkness"
  | "session"
  | "location"
  | "gameDate"
  | "icon"
  | "status";

export const INFO_FIELD_LABELS: Record<InfoField, string> = {
  group: "Gruppe",
  ship: "Schiff (Rumpf / Energie)",
  darkness: "Dunkelheitspunkte",
  session: "Sitzung",
  location: "Ort",
  gameDate: "Spielzeit",
  icon: "Ikone der Sitzung",
  status: "Lage / Status",
};

/**
 * Raum-weite Einstellungen. Liegen in den Owlbear-Raum-Metadaten, damit alle
 * Spieler dieselbe Konfiguration sehen. Schreiben darf nur der GM.
 */
export interface RoomSettings {
  groupId: string | null;
  groupName: string | null;
  activeCharacterIds: string[];
  /** Charaktere mit Token in der Szene zählen automatisch zur aktiven Crew. */
  activeFromScene: boolean;
  info: {
    session: string;
    location: string;
    gameDate: string;
    icon: string;
    status: string;
  };
  infoBar: Record<InfoField, boolean>;
  darknessVisibleToPlayers: boolean;
  token: {
    /** Größe in Rasterfeldern */
    size: number;
    showName: boolean;
    showBars: boolean;
    /** Balken nur für den GM sichtbar (unsichtbare Items sieht nur der GM) */
    barsGmOnly: boolean;
    layer: "CHARACTER" | "MOUNT";
  };
  permissions: {
    playersPlaceTokens: boolean;
    playersEditOwnStats: boolean;
  };
  sync: {
    auto: boolean;
    intervalSec: number;
  };
  hudDefaultOn: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  groupId: null,
  groupName: null,
  activeCharacterIds: [],
  activeFromScene: true,
  info: { session: "", location: "", gameDate: "", icon: "", status: "" },
  infoBar: {
    group: true,
    ship: true,
    darkness: true,
    session: true,
    location: true,
    gameDate: true,
    icon: true,
    status: true,
  },
  darknessVisibleToPlayers: false,
  token: { size: 1, showName: true, showBars: true, barsGmOnly: false, layer: "CHARACTER" },
  permissions: { playersPlaceTokens: true, playersEditOwnStats: true },
  sync: { auto: true, intervalSec: 15 },
  hudDefaultOn: true,
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };
export type SettingsPatch = DeepPartial<RoomSettings>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function merge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    result[key] = key in result ? merge(result[key], value) : value;
  }
  return result as T;
}

export function parseSettings(metadata: Record<string, unknown>): RoomSettings {
  return merge(DEFAULT_SETTINGS, metadata[ROOM_KEY]);
}

// Außerhalb von Owlbear Rodeo (Vorschau im Browser) landen die Raum-
// Einstellungen im localStorage, damit sich das Dashboard testen lässt.
let standalone = false;
const STANDALONE_ROOM_KEY = "coriolis-dashboard:standalone-room";

export function setStandaloneMode(value: boolean) {
  standalone = value;
}

export function isStandalone(): boolean {
  return standalone;
}

function readStandaloneMetadata(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STANDALONE_ROOM_KEY);
    return raw ? { [ROOM_KEY]: JSON.parse(raw) } : {};
  } catch {
    return {};
  }
}

export async function getRoomSettings(): Promise<RoomSettings> {
  return parseSettings(standalone ? readStandaloneMetadata() : await OBR.room.getMetadata());
}

export async function updateRoomSettings(patch: SettingsPatch): Promise<RoomSettings> {
  const current = await getRoomSettings();
  const next = merge(current, patch);
  if (standalone) {
    try {
      localStorage.setItem(STANDALONE_ROOM_KEY, JSON.stringify(next));
    } catch {
      // ignorieren
    }
    window.dispatchEvent(new CustomEvent("coriolis-standalone-room", { detail: next }));
  } else {
    await OBR.room.setMetadata({ [ROOM_KEY]: next });
  }
  return next;
}

/** Pro Spieler (Browser) gespeicherte HUD-Einstellungen. */
export interface HudPrefs {
  enabled: boolean | null; // null = Raum-Standard verwenden
  topOffset: number;
  leftOffset: number;
}

const HUD_PREFS_KEY = "coriolis-dashboard:hud";
export const DEFAULT_HUD_PREFS: HudPrefs = { enabled: null, topOffset: 64, leftOffset: 64 };

export function getHudPrefs(): HudPrefs {
  try {
    const raw = localStorage.getItem(HUD_PREFS_KEY);
    return raw ? { ...DEFAULT_HUD_PREFS, ...(JSON.parse(raw) as Partial<HudPrefs>) } : DEFAULT_HUD_PREFS;
  } catch {
    return DEFAULT_HUD_PREFS;
  }
}

export function setHudPrefs(patch: Partial<HudPrefs>): HudPrefs {
  const next = { ...getHudPrefs(), ...patch };
  try {
    localStorage.setItem(HUD_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignorieren
  }
  window.dispatchEvent(new Event("coriolis-hud-change"));
  return next;
}

export const HUD_PREFS_STORAGE_KEY = HUD_PREFS_KEY;

/** Zuletzt im Dashboard ausgewählter Charakter (zwischen HUD und Popover geteilt). */
const SELECTED_KEY = "coriolis-dashboard:selected";

export function getSelectedCharacterId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function setSelectedCharacterId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // ignorieren
  }
}

export const SELECTED_STORAGE_KEY = SELECTED_KEY;
