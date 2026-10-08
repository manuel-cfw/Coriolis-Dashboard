import { useMemo } from "react";
import { CharacterPanel } from "../components/CharacterPanel";
import { useAuth, useCrewData, useObr, useRoomSettings, useSceneTokens } from "../lib/hooks";
import { closeCharacterPanel } from "../lib/hud";

const characterId = new URLSearchParams(window.location.search).get("id") ?? "";

/** Charakterdetails als schmales Panel neben der Crew-Leiste über der Karte. */
export function HudDetail() {
  const obr = useObr();
  const user = useAuth();
  const settings = useRoomSettings(obr, user);
  const sceneTokens = useSceneTokens(obr);
  const extraIds = useMemo(() => [characterId], []);
  const crew = useCrewData(obr, user, settings, sceneTokens, extraIds);

  return (
    <div className="hud-detail">
      <div className="hud-detail-head">
        <span className="eyebrow" style={{ color: "var(--gold-400)" }}>
          Charakter
        </span>
        <button className="btn btn-sm btn-ghost" onClick={() => void closeCharacterPanel()} aria-label="Schließen">
          Schließen ✕
        </button>
      </div>
      <div className="hud-detail-body">
        {!user ? (
          <div className="hint">Bitte zuerst im Coriolis-Dashboard anmelden.</div>
        ) : !settings ? (
          <div className="center-note">Lade …</div>
        ) : (
          <CharacterPanel
            characterId={characterId}
            obr={obr}
            user={user}
            settings={settings}
            crew={crew}
            sceneTokens={sceneTokens}
            compact
          />
        )}
      </div>
    </div>
  );
}
