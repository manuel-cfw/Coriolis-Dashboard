import { api } from "../lib/api";
import { broadcastRefresh, type CrewData, type ObrState } from "../lib/hooks";
import type { RoomSettings } from "../lib/settings";
import { syncSceneWithApp } from "../lib/sync";
import { focusToken, placeCharacterToken, removeCharacterTokens } from "../lib/tokens";
import type { User } from "../lib/types";
import { CharacterDetail } from "./CharacterDetail";

interface CharacterPanelProps {
  characterId: string;
  obr: ObrState;
  user: User;
  settings: RoomSettings;
  crew: CrewData;
  sceneTokens: Map<string, string>;
  compact?: boolean;
}

/** Charakterdetails inklusive aller Token-Aktionen und Rechteprüfung. */
export function CharacterPanel({ characterId, obr, user, settings, crew, sceneTokens, compact = false }: CharacterPanelProps) {
  const character = crew.details.get(characterId);
  const inGroup = !!crew.group?.characters.some((c) => c.id === characterId);

  if (crew.error) return <div className="error">{crew.error}</div>;
  if (!character || !inGroup) {
    return <div className="center-note">{crew.group && !inGroup ? "Charakter gehört nicht zur verknüpften Gruppe." : "Lade Charakter …"}</div>;
  }

  const isGm = obr.role === "GM";
  const canPlace = isGm || settings.permissions.playersPlaceTokens;
  const ownStats = character.user_id === user.id;
  const canEditStats = !!character._permissions?.canEdit && (isGm || (ownStats && settings.permissions.playersEditOwnStats));
  const tokenId = sceneTokens.get(character.id);

  return (
    <CharacterDetail
      key={character.id}
      character={character}
      compact={compact}
      onMap={!!tokenId}
      obrAvailable={obr.status === "ready" && obr.sceneReady}
      canPlace={canPlace}
      canEditStats={canEditStats}
      onPlace={async () => {
        await placeCharacterToken(crew.details.get(character.id) ?? (await api.character(character.id)), settings);
      }}
      onFocus={() => focusToken(tokenId!)}
      onSyncToken={async () => {
        await syncSceneWithApp(settings);
      }}
      onRemoveToken={() => removeCharacterTokens([character.id])}
      onChanged={() => {
        crew.reload();
        broadcastRefresh(obr);
      }}
    />
  );
}
