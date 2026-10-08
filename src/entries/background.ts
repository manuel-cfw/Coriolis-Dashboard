// Hintergrund-Skript: läuft unsichtbar bei jedem Spieler, solange die
// Erweiterung im Raum aktiv ist. Es blendet das HUD über der Karte ein,
// ergänzt das Kontextmenü und gleicht beim GM die Tokens automatisch ab.
import OBR from "@owlbear-rodeo/sdk";
import { AUTH_STORAGE_KEYS, getSession } from "../lib/api";
import {
  EXT_ID,
  HUD_PREFS_STORAGE_KEY,
  POPOVER_CREW,
  POPOVER_TOP,
  REFRESH_CHANNEL,
  ROOM_KEY,
  TOKEN_KEY,
  getHudPrefs,
  getRoomSettings,
  parseSettings,
  setSelectedCharacterId,
  type RoomSettings,
} from "../lib/settings";
import { syncSceneWithApp } from "../lib/sync";
import { tokenMeta } from "../lib/tokens";

const TOP_HEIGHT = 58;
const CREW_WIDTH = 236;
const MARGIN = 12;

let settings: RoomSettings | null = null;
let sceneReady = false;
let role: "GM" | "PLAYER" = "PLAYER";
let hudKey = "";
let syncTimer: number | undefined;
let syncRunning = false;

async function updateHud() {
  const prefs = getHudPrefs();
  const enabled = (prefs.enabled ?? settings?.hudDefaultOn ?? true) && sceneReady;
  const loggedIn = !!getSession();
  if (!enabled) {
    if (hudKey !== "off") {
      hudKey = "off";
      await Promise.all([OBR.popover.close(POPOVER_TOP), OBR.popover.close(POPOVER_CREW)]);
    }
    return;
  }

  const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const showCrew = loggedIn && !!settings?.groupId;
  const key = [width, height, prefs.topOffset, prefs.leftOffset, showCrew].join("|");
  if (key === hudKey) return;
  hudKey = key;

  const topMax = Math.max(320, width - 2 * prefs.leftOffset - 2 * MARGIN);
  await OBR.popover.open({
    id: POPOVER_TOP,
    url: `/hud-top.html?max=${topMax}`,
    width: Math.min(topMax, 900),
    height: TOP_HEIGHT,
    anchorReference: "POSITION",
    anchorPosition: { left: width / 2, top: prefs.topOffset },
    anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
    transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });

  if (showCrew) {
    const crewTop = prefs.topOffset + TOP_HEIGHT + MARGIN;
    const crewMax = Math.max(160, height - crewTop - 2 * MARGIN);
    await OBR.popover.open({
      id: POPOVER_CREW,
      url: `/hud-crew.html?max=${crewMax}`,
      width: CREW_WIDTH,
      height: 48,
      anchorReference: "POSITION",
      anchorPosition: { left: prefs.leftOffset, top: crewTop },
      anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
      transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
      hidePaper: true,
      disableClickAway: true,
      marginThreshold: 0,
    });
  } else {
    await OBR.popover.close(POPOVER_CREW);
  }
}

async function runSync() {
  if (syncRunning || !settings || role !== "GM" || !sceneReady || !settings.groupId || !getSession()) return;
  syncRunning = true;
  try {
    await syncSceneWithApp(settings);
  } catch (error) {
    console.warn("[Coriolis] Token-Abgleich fehlgeschlagen:", error);
  } finally {
    syncRunning = false;
  }
}

/** Nur der GM gleicht automatisch ab – so schreiben nicht alle Clients gleichzeitig. */
function scheduleSync() {
  window.clearInterval(syncTimer);
  syncTimer = undefined;
  if (!settings?.sync.auto || role !== "GM") return;
  syncTimer = window.setInterval(runSync, Math.max(5, settings.sync.intervalSec) * 1000);
  void runSync();
}

async function setupContextMenu() {
  await OBR.contextMenu.create({
    id: `${EXT_ID}/open-sheet`,
    icons: [
      {
        icon: "/icon.svg",
        label: "Coriolis-Charakter öffnen",
        filter: {
          max: 1,
          every: [{ key: ["metadata", TOKEN_KEY, "role"], value: "token" }],
        },
      },
    ],
    onClick(context) {
      const meta = tokenMeta(context.items[0]);
      if (!meta) return;
      setSelectedCharacterId(meta.characterId);
      void OBR.action.open();
    },
  });
}

OBR.onReady(async () => {
  [role, sceneReady, settings] = await Promise.all([OBR.player.getRole(), OBR.scene.isReady(), getRoomSettings()]);

  await setupContextMenu();
  await updateHud();
  scheduleSync();

  OBR.room.onMetadataChange((metadata) => {
    if (!(ROOM_KEY in metadata)) return;
    const previous = settings;
    settings = parseSettings(metadata);
    void updateHud();
    if (
      previous?.sync.auto !== settings.sync.auto ||
      previous?.sync.intervalSec !== settings.sync.intervalSec ||
      JSON.stringify(previous?.token) !== JSON.stringify(settings.token)
    ) {
      scheduleSync();
    }
  });

  OBR.scene.onReadyChange((ready) => {
    sceneReady = ready;
    hudKey = "";
    void updateHud();
    if (ready) void runSync();
  });

  OBR.player.onChange((player) => {
    if (player.role !== role) {
      role = player.role;
      scheduleSync();
    }
  });

  // Änderungen aus Dashboard/HUD (z. B. HP geändert) sofort übernehmen
  OBR.broadcast.onMessage(REFRESH_CHANNEL, () => {
    window.setTimeout(runSync, 500);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === HUD_PREFS_STORAGE_KEY || (event.key && AUTH_STORAGE_KEYS.includes(event.key))) {
      void updateHud();
      if (event.key && AUTH_STORAGE_KEYS.includes(event.key)) scheduleSync();
    }
  });

  // Owlbear meldet Fenstergrößen nicht – regelmäßig prüfen und HUD neu ausrichten
  window.setInterval(() => void updateHud(), 3000);
});
