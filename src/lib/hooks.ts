import OBR from "@owlbear-rodeo/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUTH_STORAGE_KEYS, api, getSession } from "./api";
import {
  PLAYER_KEY,
  REFRESH_CHANNEL,
  ROOM_KEY,
  getRoomSettings,
  parseSettings,
  setStandaloneMode,
  type RoomSettings,
} from "./settings";
import { tokenMeta } from "./tokens";
import type { Character, GroupDetail, Ship, User } from "./types";

// ─── Owlbear-Verbindung ──────────────────────────────────────────────────────

export interface ObrState {
  status: "loading" | "ready" | "standalone";
  role: "GM" | "PLAYER";
  playerId: string | null;
  playerName: string;
  sceneReady: boolean;
}

// Falls Owlbear nicht antwortet, nach dieser Zeit in die Vorschau wechseln
const STANDALONE_TIMEOUT_MS = 6000;

export function useObr(): ObrState {
  const [state, setState] = useState<ObrState>({
    status: OBR.isAvailable ? "loading" : "standalone",
    role: "PLAYER",
    playerId: null,
    playerName: "",
    sceneReady: false,
  });

  useEffect(() => {
    if (!OBR.isAvailable) {
      // Vorschau im normalen Browser: GM-Ansicht ohne Owlbear-Funktionen
      setStandaloneMode(true);
      setState((s) => ({ ...s, status: "standalone", role: "GM", playerName: "Vorschau" }));
      return;
    }
    let unsubscribers: Array<() => void> = [];
    const timeout = window.setTimeout(() => {
      if (!OBR.isReady) {
        setStandaloneMode(true);
        setState((s) => ({ ...s, status: "standalone", role: "GM", playerName: "Vorschau" }));
      }
    }, STANDALONE_TIMEOUT_MS);

    OBR.onReady(async () => {
      window.clearTimeout(timeout);
      const [role, playerId, playerName, sceneReady] = await Promise.all([
        OBR.player.getRole(),
        OBR.player.getId(),
        OBR.player.getName(),
        OBR.scene.isReady(),
      ]);
      setState({ status: "ready", role, playerId, playerName, sceneReady });
      unsubscribers = [
        OBR.player.onChange((player) => {
          setState((s) => ({ ...s, role: player.role, playerName: player.name }));
        }),
        OBR.scene.onReadyChange((ready) => setState((s) => ({ ...s, sceneReady: ready }))),
      ];
    });
    return () => {
      window.clearTimeout(timeout);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return state;
}

// ─── Login ───────────────────────────────────────────────────────────────────

export function useAuth(): User | null {
  const [user, setUser] = useState<User | null>(() => getSession()?.user ?? null);
  useEffect(() => {
    const update = () => setUser(getSession()?.user ?? null);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || AUTH_STORAGE_KEYS.includes(event.key)) update();
    };
    window.addEventListener("coriolis-auth-change", update);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("coriolis-auth-change", update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return user;
}

/** Meldet dem Raum, welcher Coriolis-Nutzer hinter diesem Owlbear-Spieler steckt. */
export function usePublishPlayer(obr: ObrState, user: User | null) {
  useEffect(() => {
    if (obr.status !== "ready") return;
    void OBR.player.setMetadata({
      [PLAYER_KEY]: user ? { userId: user.id, name: user.name } : undefined,
    });
  }, [obr.status, user]);
}

// ─── Raum-Einstellungen ──────────────────────────────────────────────────────

export function useRoomSettings(obr: ObrState): RoomSettings | null {
  const [settings, setSettings] = useState<RoomSettings | null>(null);
  useEffect(() => {
    if (obr.status === "loading") return;
    void getRoomSettings().then(setSettings);
    if (obr.status === "standalone") {
      const onChange = (event: Event) => setSettings((event as CustomEvent<RoomSettings>).detail);
      window.addEventListener("coriolis-standalone-room", onChange);
      return () => window.removeEventListener("coriolis-standalone-room", onChange);
    }
    return OBR.room.onMetadataChange((metadata) => {
      if (ROOM_KEY in metadata) setSettings(parseSettings(metadata));
    });
  }, [obr.status]);
  return settings;
}

// ─── Szene & Party ───────────────────────────────────────────────────────────

/** characterId → Token-ID aller Charakter-Tokens der aktuellen Szene. */
export function useSceneTokens(obr: ObrState): Map<string, string> {
  const [tokens, setTokens] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (obr.status !== "ready" || !obr.sceneReady) {
      setTokens(new Map());
      return;
    }
    const update = (items: Awaited<ReturnType<typeof OBR.scene.items.getItems>>) => {
      const next = new Map<string, string>();
      for (const item of items) {
        const meta = tokenMeta(item);
        if (meta?.role === "token") next.set(meta.characterId, item.id);
      }
      setTokens((prev) => {
        if (prev.size === next.size && [...next].every(([key, value]) => prev.get(key) === value)) return prev;
        return next;
      });
    };
    void OBR.scene.items.getItems().then(update);
    return OBR.scene.items.onChange(update);
  }, [obr.status, obr.sceneReady]);
  return tokens;
}

export interface OnlinePlayer {
  userId: string;
  name: string;
  obrName: string;
  role: "GM" | "PLAYER";
}

/** Alle Spieler im Raum, die mit einem Coriolis-Konto angemeldet sind (inkl. dir selbst). */
export function useOnlinePlayers(obr: ObrState, self: User | null): OnlinePlayer[] {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  useEffect(() => {
    if (obr.status !== "ready") return;
    const update = (party: Awaited<ReturnType<typeof OBR.party.getPlayers>>) => {
      setPlayers(
        party.flatMap((player) => {
          const meta = player.metadata[PLAYER_KEY] as { userId?: string; name?: string } | undefined;
          return meta?.userId ? [{ userId: meta.userId, name: meta.name ?? "", obrName: player.name, role: player.role }] : [];
        })
      );
    };
    void OBR.party.getPlayers().then(update);
    return OBR.party.onChange(update);
  }, [obr.status]);

  return useMemo(() => {
    if (!self) return players;
    return [{ userId: self.id, name: self.name, obrName: obr.playerName, role: obr.role }, ...players];
  }, [players, self, obr.playerName, obr.role]);
}

// ─── Crew-Daten aus der Coriolis-App ─────────────────────────────────────────

export interface CrewData {
  group: GroupDetail | null;
  ship: Ship | null;
  /** Vollständige Daten der aktiven Charaktere */
  details: Map<string, Character>;
  /** IDs der aktiven Crew in Anzeigereihenfolge */
  activeIds: string[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function broadcastRefresh(obr: ObrState) {
  if (obr.status === "ready") void OBR.broadcast.sendMessage(REFRESH_CHANNEL, {}, { destination: "ALL" });
  else window.dispatchEvent(new Event("coriolis-refresh"));
}

export function useCrewData(
  obr: ObrState,
  user: User | null,
  settings: RoomSettings | null,
  sceneTokens: Map<string, string>,
  extraIds: string[] = []
): CrewData {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [ship, setShip] = useState<Ship | null>(null);
  const [details, setDetails] = useState<Map<string, Character>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  const groupId = settings?.groupId ?? null;

  const activeIds = useMemo(() => {
    if (!settings || !group) return [];
    const known = new Set(group.characters.map((c) => c.id));
    const ids = settings.activeCharacterIds.filter((id) => known.has(id));
    if (settings.activeFromScene) {
      for (const id of sceneTokens.keys()) if (known.has(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [settings, group, sceneTokens]);

  const wantedIds = useMemo(
    () => [...new Set([...activeIds, ...extraIds.filter(Boolean)])].sort(),
    [activeIds, extraIds]
  );
  const wantedKey = wantedIds.join(",");

  // Gruppe & Schiff
  useEffect(() => {
    if (!user || !groupId) {
      setGroup(null);
      setShip(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([api.group(groupId), api.ship(groupId).catch(() => null)])
      .then(([groupDetail, shipData]) => {
        if (cancelled) return;
        setGroup(groupDetail);
        setShip(shipData);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, groupId, tick]);

  // Details der aktiven / angefragten Charaktere
  const detailsRef = useRef(details);
  detailsRef.current = details;
  useEffect(() => {
    if (!user || wantedIds.length === 0) {
      if (detailsRef.current.size > 0) setDetails(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(wantedIds.map((id) => api.character(id).catch(() => null))).then((results) => {
      if (cancelled) return;
      const next = new Map<string, Character>();
      for (const character of results) if (character) next.set(character.id, character);
      setDetails(next);
    });
    return () => {
      cancelled = true;
    };
    // wantedKey bildet wantedIds stabil ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, wantedKey, tick]);

  // Regelmäßig und auf Zuruf aktualisieren
  const intervalSec = settings?.sync.intervalSec ?? 15;
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(reload, Math.max(5, intervalSec) * 1000);
    const unsubscribe =
      obr.status === "ready" ? OBR.broadcast.onMessage(REFRESH_CHANNEL, reload) : () => undefined;
    window.addEventListener("coriolis-refresh", reload);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      window.removeEventListener("coriolis-refresh", reload);
    };
  }, [user, obr.status, intervalSec, reload]);

  return { group, ship, details, activeIds, loading, error, reload };
}
