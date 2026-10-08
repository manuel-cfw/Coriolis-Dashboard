import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useMemo, useState } from "react";
import { CharacterDetail } from "../components/CharacterDetail";
import { CrewCard, buildCrewEntries } from "../components/CrewList";
import { GmSettings } from "../components/GmSettings";
import { InfoBar } from "../components/InfoBar";
import { LoginView } from "../components/LoginView";
import { api } from "../lib/api";
import { Portrait } from "../components/ui";
import {
  broadcastRefresh,
  useAuth,
  useCrewData,
  useObr,
  useOnlinePlayers,
  usePublishPlayer,
  useRoomSettings,
  useSceneTokens,
} from "../lib/hooks";
import {
  MODAL_ID,
  SELECTED_STORAGE_KEY,
  getHudPrefs,
  getSelectedCharacterId,
  setHudPrefs,
  setSelectedCharacterId,
} from "../lib/settings";
import { syncSceneWithApp } from "../lib/sync";
import { focusToken, placeCharacterToken, removeCharacterTokens } from "../lib/tokens";

type View = "character" | "roster" | "gm";

const isModal = new URLSearchParams(window.location.search).has("modal");

export function Dashboard() {
  const obr = useObr();
  const user = useAuth();
  const settings = useRoomSettings(obr);
  const sceneTokens = useSceneTokens(obr);
  const online = useOnlinePlayers(obr, user);
  usePublishPlayer(obr, user);

  const [selectedId, setSelectedId] = useState<string | null>(() => getSelectedCharacterId());
  const [view, setView] = useState<View>("character");
  const [hudEnabled, setHudEnabled] = useState<boolean | null>(() => getHudPrefs().enabled);

  // Auswahl aus der HUD-Crewleiste übernehmen
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTED_STORAGE_KEY) {
        setSelectedId(event.newValue);
        setView("character");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const extraIds = useMemo(() => (selectedId ? [selectedId] : []), [selectedId]);
  const crew = useCrewData(obr, user, settings, sceneTokens, extraIds);
  const onlineIds = useMemo(() => new Set(online.map((p) => p.userId)), [online]);
  const entries = useMemo(() => buildCrewEntries(crew, crew.activeIds, sceneTokens, onlineIds), [crew, sceneTokens, onlineIds]);

  const select = (id: string) => {
    setSelectedId(id);
    setSelectedCharacterId(id);
    setView("character");
  };

  if (obr.status === "loading" || (user && !settings)) {
    return <div className="center-note">Verbinde mit Owlbear Rodeo …</div>;
  }
  if (!user) {
    return (
      <>
        <div className="starfield" />
        <LoginView />
      </>
    );
  }
  if (!settings) return null;

  const isGm = obr.role === "GM";
  const obrReady = obr.status === "ready";
  const canPlace = isGm || settings.permissions.playersPlaceTokens;
  const selected = selectedId ? crew.details.get(selectedId) : undefined;
  const selectedInGroup = !!selectedId && !!crew.group?.characters.some((c) => c.id === selectedId);
  const hudActive = hudEnabled ?? settings.hudDefaultOn;

  const place = async (id: string) => {
    const character = crew.details.get(id) ?? (await api.character(id));
    await placeCharacterToken(character, settings);
  };

  const placeAll = async () => {
    for (const id of crew.activeIds) {
      if (!sceneTokens.has(id) && crew.details.has(id)) await placeCharacterToken(crew.details.get(id)!, settings);
    }
  };

  const toggleHud = () => {
    const next = !hudActive;
    setHudPrefs({ enabled: next });
    setHudEnabled(next);
  };

  let main: React.ReactNode;
  if (!settings.groupId) {
    main = isGm ? (
      <div className="hint">
        Willkommen, Spielleiter. Verknüpfe zuerst unter <strong>GM</strong> eine Gruppe aus der Coriolis-App.
      </div>
    ) : (
      <div className="hint">Der GM hat für diesen Raum noch keine Coriolis-Gruppe verknüpft.</div>
    );
  } else if (crew.error) {
    main = <div className="error">{crew.error}</div>;
  } else if (view === "roster") {
    main = (
      <div className="stack">
        <h2 className="heading">Alle Charaktere · {crew.group?.group.name}</h2>
        <div className="roster">
          {(crew.group?.characters ?? []).map((character) => (
            <button key={character.id} className="crew-card" onClick={() => select(character.id)}>
              <Portrait character={character} size={44} />
              <span className="body">
                <span className="name">{character.name}</span>
                <span className="concept">{character.concept ?? "–"}</span>
                <span className="row">
                  <span className={`status-dot ${sceneTokens.has(character.id) ? "on" : ""}`} />
                  <span className="dim" style={{ fontSize: 10.5 }}>
                    {character.owner_name ?? "NSC"}
                    {crew.activeIds.includes(character.id) ? " · aktiv" : ""}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (selected && selectedInGroup) {
    const ownStats = selected.user_id === user.id;
    const canEditStats = !!selected._permissions?.canEdit && (isGm || (ownStats && settings.permissions.playersEditOwnStats));
    const tokenId = sceneTokens.get(selected.id);
    main = (
      <CharacterDetail
        key={selected.id}
        character={selected}
        onMap={!!tokenId}
        obrAvailable={obrReady && obr.sceneReady}
        canPlace={canPlace}
        canEditStats={canEditStats}
        onPlace={() => place(selected.id)}
        onFocus={() => focusToken(tokenId!)}
        onSyncToken={async () => {
          await syncSceneWithApp(settings);
        }}
        onRemoveToken={() => removeCharacterTokens([selected.id])}
        onChanged={() => {
          crew.reload();
          broadcastRefresh(obr);
        }}
      />
    );
  } else if (selectedId && selectedInGroup) {
    main = <div className="center-note">Lade Charakter …</div>;
  } else {
    main = (
      <div className="hint">
        Wähle links einen Charakter der aktiven Crew oder öffne <strong>Alle Charaktere</strong>.
      </div>
    );
  }

  return (
    <>
      <div className="starfield" />
      <div className="app">
        <InfoBar obr={obr} user={user} settings={settings} crew={crew} />
        <div className="app-body">
          <aside className="sidebar">
            <div className="tabs">
              <button className={`btn btn-sm ${view === "character" ? "btn-active" : ""}`} onClick={() => setView("character")}>
                Crew
              </button>
              <button className={`btn btn-sm ${view === "roster" ? "btn-active" : ""}`} onClick={() => setView("roster")}>
                Alle
              </button>
              {isGm && (
                <button className={`btn btn-sm ${view === "gm" ? "btn-active" : ""}`} onClick={() => setView("gm")}>
                  GM
                </button>
              )}
            </div>
            <div className="sidebar-scroll">
              <div className="row between">
                <span className="eyebrow">Aktive Crew</span>
                <span className="badge">{entries.length}</span>
              </div>
              {entries.length === 0 && (
                <div className="hint">
                  {settings.groupId
                    ? isGm
                      ? "Noch niemand aktiv. Wähle Charaktere unter GM aus oder setze einen Token auf die Karte."
                      : "Noch keine aktiven Charaktere."
                    : "Keine Gruppe verknüpft."}
                </div>
              )}
              {entries.map((entry) => (
                <CrewCard
                  key={entry.summary.id}
                  entry={entry}
                  selected={view === "character" && selectedId === entry.summary.id}
                  onSelect={() => select(entry.summary.id)}
                  onPlace={obrReady && obr.sceneReady && canPlace ? () => void place(entry.summary.id) : undefined}
                />
              ))}
            </div>
            <div className="row wrap" style={{ padding: 10, borderTop: "1px solid var(--border-subtle)" }}>
              {obrReady && (
                <button className={`btn btn-sm ${hudActive ? "btn-active" : ""}`} onClick={toggleHud} title="Infoleiste und Crew dauerhaft über der Karte anzeigen">
                  HUD {hudActive ? "an" : "aus"}
                </button>
              )}
              {obrReady && !isModal && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => OBR.modal.open({ id: MODAL_ID, url: "/index.html?modal=1", fullScreen: true })}
                >
                  Vollbild
                </button>
              )}
              {obrReady && isModal && (
                <button className="btn btn-sm btn-ghost" onClick={() => OBR.modal.close(MODAL_ID)}>
                  Schließen
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={crew.reload} disabled={crew.loading}>
                {crew.loading ? "Lade …" : "Neu laden"}
              </button>
              {obrReady && hudActive && <HudPosition />}
            </div>
          </aside>
          <main className="main">
            {obr.status === "standalone" && (
              <div className="hint" style={{ marginBottom: 12 }}>
                Vorschau außerhalb von Owlbear Rodeo – Token-Funktionen sind deaktiviert.
              </div>
            )}
            {view === "gm" && isGm ? (
              <GmSettings
                obr={obr}
                settings={settings}
                crew={crew}
                sceneTokens={sceneTokens}
                onPlaceAll={placeAll}
                onSyncAll={() => syncSceneWithApp(settings)}
                onRemoveAll={() => removeCharacterTokens()}
              />
            ) : (
              main
            )}
          </main>
        </div>
      </div>
    </>
  );
}

/** Abstand des HUD vom oberen und linken Rand – je nach Owlbear-Oberfläche anpassbar. */
function HudPosition() {
  const [prefs, setPrefs] = useState(getHudPrefs);
  const update = (patch: Partial<typeof prefs>) => setPrefs(setHudPrefs(patch));
  return (
    <details style={{ width: "100%" }}>
      <summary className="eyebrow" style={{ cursor: "pointer" }}>
        HUD-Position
      </summary>
      <div className="row" style={{ marginTop: 6 }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Oben (px)</span>
          <input className="input" type="number" min={0} max={400} value={prefs.topOffset} onChange={(e) => update({ topOffset: Number(e.target.value) || 0 })} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Links (px)</span>
          <input className="input" type="number" min={0} max={400} value={prefs.leftOffset} onChange={(e) => update({ leftOffset: Number(e.target.value) || 0 })} />
        </label>
      </div>
    </details>
  );
}
