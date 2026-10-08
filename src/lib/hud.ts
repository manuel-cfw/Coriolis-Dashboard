import OBR from "@owlbear-rodeo/sdk";
import { POPOVER_DETAIL, getHudPrefs, setSelectedCharacterId } from "./settings";

// Geometrie des HUD über der Karte (in Bildschirm-Pixeln)
export const TOP_HEIGHT = 58;
export const CREW_WIDTH = 236;
export const DETAIL_WIDTH = 400;
export const MARGIN = 12;

/**
 * Öffnet die Charakterdetails als schmales Panel rechts neben der
 * Crew-Leiste – die Karte bleibt daneben frei und bedienbar.
 */
export async function openCharacterPanel(characterId: string) {
  setSelectedCharacterId(characterId);
  const prefs = getHudPrefs();
  const viewportHeight = await OBR.viewport.getHeight();
  const top = prefs.topOffset + TOP_HEIGHT + MARGIN;
  const height = Math.max(320, Math.min(820, viewportHeight - top - 2 * MARGIN));
  await OBR.popover.open({
    id: POPOVER_DETAIL,
    url: `/detail.html?id=${encodeURIComponent(characterId)}`,
    width: DETAIL_WIDTH,
    height,
    anchorReference: "POSITION",
    anchorPosition: { left: prefs.leftOffset + CREW_WIDTH + MARGIN, top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });
}

export async function closeCharacterPanel() {
  setSelectedCharacterId(null);
  await OBR.popover.close(POPOVER_DETAIL);
}
