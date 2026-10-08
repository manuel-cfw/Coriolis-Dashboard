import OBR, { buildImage, buildShape, isImage, isShape, type Image, type Item, type Shape } from "@owlbear-rodeo/sdk";
import { characterImageUrl } from "./api";
import { TOKEN_KEY, type RoomSettings } from "./settings";

/** Minimal benötigte Charakterdaten, um einen Token zu bauen oder zu aktualisieren. */
export interface TokenCharacter {
  id: string;
  name: string;
  profile_image_id: string | null;
  hp_current: number;
  hp_max: number;
  mp_current: number;
  mp_max: number;
}

type BarRole = "hp-bg" | "hp" | "mp-bg" | "mp";
type TokenRole = "token" | BarRole;

interface TokenMeta {
  characterId: string;
  role: TokenRole;
}

const BAR_COLORS: Record<BarRole, string> = {
  "hp-bg": "#0b101a",
  hp: "#2f9e54",
  "mp-bg": "#0b101a",
  mp: "#3b82c4",
};
const BAR_ROLES: BarRole[] = ["hp-bg", "hp", "mp-bg", "mp"];

export function tokenMeta(item: Item): TokenMeta | undefined {
  const meta = item.metadata[TOKEN_KEY] as TokenMeta | undefined;
  return meta && typeof meta.characterId === "string" ? meta : undefined;
}

export async function getCharacterTokens(): Promise<Image[]> {
  return OBR.scene.items.getItems<Image>((item) => isImage(item) && tokenMeta(item)?.role === "token");
}

async function loadImage(url: string): Promise<{ width: number; height: number; mime: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const result = { width: bitmap.width, height: bitmap.height, mime: blob.type || "image/png" };
    bitmap.close();
    return result;
  } catch {
    return { width: 512, height: 512, mime: "image/png" };
  }
}

function clampRatio(current: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.min(1, Math.max(0, current / max));
}

interface BarGeometry {
  role: BarRole;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lage der HP- und WK-Balken über dem Token in Szenen-Koordinaten. */
function barLayout(token: Image, sceneDpi: number, character: TokenCharacter): BarGeometry[] {
  const tokenWidth = (token.image.width / token.grid.dpi) * sceneDpi * Math.abs(token.scale.x);
  const tokenHeight = (token.image.height / token.grid.dpi) * sceneDpi * Math.abs(token.scale.y);
  const width = tokenWidth * 0.9;
  const height = Math.max(4, sceneDpi * 0.08);
  const gap = height * 0.35;
  const left = token.position.x - width / 2;
  const hpTop = token.position.y - tokenHeight / 2 - 2 * height - 2 * gap;
  const mpTop = hpTop + height + gap;
  // Ein Balken mit Breite 0 wird von Owlbear nicht sauber gezeichnet.
  const fill = (ratio: number) => Math.max(0.5, width * ratio);
  return [
    { role: "hp-bg", x: left, y: hpTop, width, height },
    { role: "hp", x: left, y: hpTop, width: fill(clampRatio(character.hp_current, character.hp_max)), height },
    { role: "mp-bg", x: left, y: mpTop, width, height },
    { role: "mp", x: left, y: mpTop, width: fill(clampRatio(character.mp_current, character.mp_max)), height },
  ];
}

function buildBar(token: Image, geometry: BarGeometry, characterId: string, settings: RoomSettings): Shape {
  const isBackground = geometry.role.endsWith("-bg");
  return buildShape()
    .shapeType("RECTANGLE")
    .width(geometry.width)
    .height(geometry.height)
    .position({ x: geometry.x, y: geometry.y })
    .fillColor(BAR_COLORS[geometry.role])
    .fillOpacity(isBackground ? 0.85 : 1)
    .strokeColor(isBackground ? "#c9a84c" : BAR_COLORS[geometry.role])
    .strokeOpacity(isBackground ? 0.6 : 0)
    .strokeWidth(isBackground ? 1 : 0)
    .attachedTo(token.id)
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true)
    .visible(!settings.token.barsGmOnly)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .zIndex(isBackground ? 1 : 2)
    .name(`${geometry.role === "hp" || geometry.role === "hp-bg" ? "HP" : "WK"} – ${token.name}`)
    .metadata({ [TOKEN_KEY]: { characterId, role: geometry.role } satisfies TokenMeta })
    .build();
}

async function viewportCenter() {
  const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const center = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });
  return OBR.scene.grid.snapPosition(center);
}

/** Setzt einen Charakter als Token in die Mitte der aktuellen Ansicht. */
export async function placeCharacterToken(character: TokenCharacter, settings: RoomSettings): Promise<string> {
  const url = characterImageUrl(character);
  const [image, position, sceneDpi] = await Promise.all([loadImage(url), viewportCenter(), OBR.scene.grid.getDpi()]);
  const imageDpi = Math.max(image.width, image.height) / Math.max(0.25, settings.token.size);

  const token = buildImage(
    { url, mime: image.mime, width: image.width, height: image.height },
    { dpi: imageDpi, offset: { x: image.width / 2, y: image.height / 2 } }
  )
    .name(character.name)
    .plainText(settings.token.showName ? character.name : "")
    .position(position)
    .layer(settings.token.layer)
    .metadata({ [TOKEN_KEY]: { characterId: character.id, role: "token" } satisfies TokenMeta })
    .build();

  const bars = settings.token.showBars
    ? barLayout(token, sceneDpi, character).map((geometry) => buildBar(token, geometry, character.id, settings))
    : [];

  await OBR.scene.items.addItems([token, ...bars]);
  await OBR.player.select([token.id]);
  return token.id;
}

export async function focusToken(tokenId: string) {
  const bounds = await OBR.scene.items.getItemBounds([tokenId]);
  await OBR.viewport.animateToBounds({
    ...bounds,
    min: { x: bounds.min.x - bounds.width, y: bounds.min.y - bounds.height },
    max: { x: bounds.max.x + bounds.width, y: bounds.max.y + bounds.height },
    width: bounds.width * 3,
    height: bounds.height * 3,
  });
  await OBR.player.select([tokenId]);
}

export async function removeCharacterTokens(characterIds?: string[]) {
  const items = await OBR.scene.items.getItems((item) => {
    const meta = tokenMeta(item);
    return !!meta && (!characterIds || characterIds.includes(meta.characterId));
  });
  if (items.length > 0) await OBR.scene.items.deleteItems(items.map((item) => item.id));
}

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.01;

/**
 * Gleicht alle Charakter-Tokens der Szene mit den Daten der Coriolis-App ab:
 * Name, Portrait sowie HP-/WK-Balken. Schreibt nur, wenn sich etwas geändert hat.
 */
export async function syncTokens(characters: Map<string, TokenCharacter>, settings: RoomSettings): Promise<number> {
  const [tokens, bars, sceneDpi] = await Promise.all([
    getCharacterTokens(),
    OBR.scene.items.getItems<Shape>((item) => isShape(item) && BAR_ROLES.includes(tokenMeta(item)?.role as BarRole)),
    OBR.scene.grid.getDpi(),
  ]);

  const barsByToken = new Map<string, Map<BarRole, Shape>>();
  for (const bar of bars) {
    if (!bar.attachedTo) continue;
    const forToken = barsByToken.get(bar.attachedTo) ?? new Map<BarRole, Shape>();
    forToken.set(tokenMeta(bar)!.role as BarRole, bar);
    barsByToken.set(bar.attachedTo, forToken);
  }

  const tokenUpdates = new Map<string, { name: string; text: string; url?: { url: string; width: number; height: number; mime: string; dpi: number } }>();
  const barUpdates = new Map<string, { geometry: BarGeometry; visible: boolean }>();
  const toAdd: Item[] = [];
  const toDelete: string[] = [];

  for (const token of tokens) {
    const meta = tokenMeta(token)!;
    const character = characters.get(meta.characterId);
    if (!character) continue;

    const text = settings.token.showName ? character.name : "";
    const url = characterImageUrl(character);
    let newImage: { url: string; width: number; height: number; mime: string; dpi: number } | undefined;
    if (token.image.url !== url) {
      const loaded = await loadImage(url);
      // Größe in Rasterfeldern beibehalten
      const cells = Math.max(token.image.width, token.image.height) / token.grid.dpi;
      newImage = { url, ...loaded, dpi: Math.max(loaded.width, loaded.height) / cells };
    }
    if (token.name !== character.name || token.text.plainText !== text || newImage) {
      tokenUpdates.set(token.id, { name: character.name, text, url: newImage });
    }

    const existing = barsByToken.get(token.id) ?? new Map<BarRole, Shape>();
    if (!settings.token.showBars) {
      for (const bar of existing.values()) toDelete.push(bar.id);
      continue;
    }
    const layoutToken = newImage
      ? { ...token, image: { ...token.image, width: newImage.width, height: newImage.height }, grid: { ...token.grid, dpi: newImage.dpi } }
      : token;
    const visible = !settings.token.barsGmOnly;
    for (const geometry of barLayout(layoutToken, sceneDpi, character)) {
      const bar = existing.get(geometry.role);
      if (!bar) {
        toAdd.push(buildBar(token, geometry, character.id, settings));
        continue;
      }
      const changed =
        !nearlyEqual(bar.width, geometry.width) ||
        !nearlyEqual(bar.height, geometry.height) ||
        !nearlyEqual(bar.position.x, geometry.x) ||
        !nearlyEqual(bar.position.y, geometry.y) ||
        bar.visible !== visible;
      if (changed) barUpdates.set(bar.id, { geometry, visible });
    }
  }

  if (tokenUpdates.size > 0) {
    await OBR.scene.items.updateItems<Image>([...tokenUpdates.keys()], (drafts) => {
      for (const draft of drafts) {
        const update = tokenUpdates.get(draft.id)!;
        draft.name = update.name;
        draft.text.plainText = update.text;
        if (update.url) {
          draft.image.url = update.url.url;
          draft.image.width = update.url.width;
          draft.image.height = update.url.height;
          draft.image.mime = update.url.mime;
          draft.grid.dpi = update.url.dpi;
          draft.grid.offset = { x: update.url.width / 2, y: update.url.height / 2 };
        }
      }
    });
  }
  if (barUpdates.size > 0) {
    await OBR.scene.items.updateItems<Shape>([...barUpdates.keys()], (drafts) => {
      for (const draft of drafts) {
        const { geometry, visible } = barUpdates.get(draft.id)!;
        draft.width = geometry.width;
        draft.height = geometry.height;
        draft.position = { x: geometry.x, y: geometry.y };
        draft.visible = visible;
      }
    });
  }
  if (toAdd.length > 0) await OBR.scene.items.addItems(toAdd);
  if (toDelete.length > 0) await OBR.scene.items.deleteItems(toDelete);

  return tokenUpdates.size + barUpdates.size + toAdd.length + toDelete.length;
}
