import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useMemo, useState } from "react";
import { CharacterPanel } from "../components/CharacterPanel";
import { CrewCard, buildCrewEntries, type CrewEntry } from "../components/CrewList";
import { GmSettings } from "../components/GmSettings";
import { InfoBar } from "../components/InfoBar";
import { LoginView } from "../components/LoginView";
import { Portrait, Wordmark } from "../components/ui";
import { api, clearSession } from "../lib/api";
import {
  useAuth,
  useCrewData,
  useObr,
  useOnlinePlayers,
  usePublishPlayer,
  useRoomSettings,
  useSceneTokens,
  type CrewData,
} from "../lib/hooks";
import { openCharacterPanel } from "../lib/hud";
import {
  MODAL_ID,
  SELECTED_STORAGE_KEY,
  getHudPrefs,
  getSelectedCharacterId,
  setHudPrefs,
  setSelectedCharacterId,
  type RoomSettings,
} from "../lib/settings";
import { syncSceneWithApp } from "../lib/sync";
import { placeCharacterToken, removeCharacterTokens } from "../lib/tokens";

type View = "crew" | "roster" | "gm";

const isModal = new URLSearchParams(window.location.search).has("modal");
/** Ab dieser Breite (Vollbild, Vorschau) Crew und Details nebeneinander zeigen. */
const WIDE_BREAKPOINT = 760;

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export function Dashboard() {
  const obr = useObr();
  const user = useAuth();
  const settings = useRoomSettings(obr);
  const sceneTokens = useSceneTokens(obr);
  const online = useOnlinePlayers(obr, user);
  usePublishPlayer(obr, user);
  const windowWidth = useWindowWidth();

  const [selectedId, setSelectedId] = useState<string | null>(() => getSelectedCharacterId());
  const [view, setView] = useState<View>("crew");
  const [hudEnabled, setHudEnabled] = useState<boolean | null>(() => getHudPrefs().enabled);

  // Auswahl aus HUD-Crewleiste oder Detail-Panel übernehmen
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTED_STORAGE_KEY) setSelectedId(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const wide = isModal || windowWidth >= WIDE_BREAKPOINT;
  const extraIds = useMemo(() => (wide && selectedId ? [selectedId] : []), [wide, selectedId]);
  const crew = useCrewData(obr, user, settings, sceneTokens, extraIds);
  const onlineIds = useMemo(() => new Set(online.map((p) => p.userId)), [online]);
  const entries = useMemo(() => buildCrewEntries(crew, crew.activeIds, sceneTokens, onlineIds), [crew, sceneTokens, onlineIds]);

  if (obr.status === "loading" || (user && !settings)) {
    return <div className="center-note">Verbinde mit Owlbear Rodeo …</div>;
  }
  if (!user) {
    return (
      <>
        <div className="starfield" />
        <LoginView compact={!wide} />
      </>
    );
  }
  if (!settings) return null;

  const isGm = obr.role === "GM";
  const obrReady = obr.status === "ready";
  const canPlace = isGm || settings.permissions.playersPlaceTokens;
  const hudActive = hudEnabled ?? settings.hudDefaultOn;

  const select = (id: string) => {
    setSelectedId(id);
    setSelectedCharacterId(id);
    if (!wide && obrReady) {
      // Details neben der Karte öffnen und das Popover schließen – die Karte bleibt frei
      void openCharacterPanel(id).then(() => (isModal ? undefined : OBR.action.close()));
    } else if (!wide) {
      // Vorschau ohne Owlbear: Detail-Panel in eigenem Tab
      window.open(`/detail.html?id=${encodeURIComponent(id)}`, "_blank");
    } else {
      setView("crew");
    }
  };

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

  const tabs = (
    <div className="tabs" style={wide ? undefined : { padding: 0 }}>
      <button className={`btn btn-sm ${view === "crew" ? "btn-active" : ""}`} onClick={() => setView("crew")}>
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
  );

  const crewList = (
    <CrewListBlock
      entries={entries}
      settings={settings}
      isGm={isGm}
      selectedId={selectedId}
      onSelect={select}
      onPlace={obrReady && obr.sceneReady && canPlace ? (id) => void place(id) : undefined}
    />
  );

  const footer = (
    <>
      {obrReady && (
        <button className={`btn btn-sm ${hudActive ? "btn-active" : ""}`} onClick={toggleHud} title="Infoleiste und Crew dauerhaft über der Karte anzeigen">
          HUD {hudActive ? "an" : "aus"}
        </button>
      )}
      {obrReady && !isModal && (
        <button className="btn btn-sm btn-ghost" onClick={() => OBR.modal.open({ id: MODAL_ID, url: "/index.html?modal=1", fullScreen: true })}>
          Vollbild
        </button>
      )}
      {obrReady && isModal && (
        <button className="btn btn-sm btn-ghost" onClick={() => OBR.modal.close(MODAL_ID)}>
          Zur Karte
        </button>
      )}
      <button className="btn btn-sm btn-ghost" onClick={crew.reload} disabled={crew.loading}>
        {crew.loading ? "Lade …" : "Neu laden"}
      </button>
      {obrReady && hudActive && <HudPosition />}
    </>
  );

  const gmSettings = (
    <GmSettings
      obr={obr}
      settings={settings}
      crew={crew}
      sceneTokens={sceneTokens}
      onPlaceAll={placeAll}
      onSyncAll={() => syncSceneWithApp(settings)}
      onRemoveAll={() => removeCharacterTokens()}
    />
  );

  const notice = !settings.groupId ? (
    <div className="hint">
      {isGm ? (
        <>
          Willkommen, Spielleiter. Verknüpfe zuerst unter <strong>GM</strong> eine Gruppe aus der Coriolis-App.
        </>
      ) : (
        "Der GM hat für diesen Raum noch keine Coriolis-Gruppe verknüpft."
      )}
    </div>
  ) : crew.error ? (
    <div className="error">{crew.error}</div>
  ) : null;

  // ─── Schmale Steuerzentrale (Aktions-Popover in Owlbear) ──────────────────
  if (!wide) {
    return (
      <>
        <div className="starfield" />
        <div className="control">
          <div className="control-head">
            <Wordmark style={{ fontSize: 14 }} />
            <div className="row">
              <span style={{ fontSize: 12 }}>{user.name}</span>
              {isGm && <span className="badge badge-gold">GM</span>}
              <button className="btn btn-sm btn-ghost" onClick={logout}>
                Abmelden
              </button>
            </div>
          </div>
          {!hudActive && <InfoBar obr={obr} user={user} settings={settings} crew={crew} hud />}
          <div className="control-body">
            {tabs}
            {view === "gm" && isGm ? (
              gmSettings
            ) : (
              <>
                {notice}
                {!notice && view === "crew" && (
                  <>
                    <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>
                      Charakter antippen – die Details öffnen sich neben der Karte.
                    </p>
                    {crewList}
                  </>
                )}
                {!notice && view === "roster" && <Roster crew={crew} sceneTokens={sceneTokens} onSelect={select} />}
              </>
            )}
          </div>
          <div className="control-foot">{footer}</div>
        </div>
      </>
    );
  }

  // ─── Breite Ansicht (Vollbild / Vorschau) ─────────────────────────────────
  let main: React.ReactNode;
  if (view === "gm" && isGm) main = gmSettings;
  else if (notice) main = notice;
  else if (view === "roster") main = <Roster crew={crew} sceneTokens={sceneTokens} onSelect={select} />;
  else if (selectedId)
    main = (
      <CharacterPanel characterId={selectedId} obr={obr} user={user} settings={settings} crew={crew} sceneTokens={sceneTokens} />
    );
  else
    main = (
      <div className="hint">
        Wähle links einen Charakter der aktiven Crew oder öffne <strong>Alle</strong>.
      </div>
    );

  return (
    <>
      <div className="starfield" />
      <div className="app">
        <InfoBar obr={obr} user={user} settings={settings} crew={crew} />
        <div className="app-body">
          <aside className="sidebar">
            {tabs}
            <div className="sidebar-scroll">{crewList}</div>
            <div className="row wrap" style={{ padding: 10, borderTop: "1px solid var(--border-subtle)" }}>
              {footer}
            </div>
          </aside>
          <main className="main">
            {obr.status === "standalone" && (
              <div className="hint" style={{ marginBottom: 12 }}>
                Vorschau außerhalb von Owlbear Rodeo – Token-Funktionen sind deaktiviert.
              </div>
            )}
            {main}
          </main>
        </div>
      </div>
    </>
  );
}

function logout() {
  clearSession();
  window.dispatchEvent(new Event("coriolis-auth-change"));
}

function CrewListBlock({
  entries,
  settings,
  isGm,
  selectedId,
  onSelect,
  onPlace,
}: {
  entries: CrewEntry[];
  settings: RoomSettings;
  isGm: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPlace?: (id: string) => void;
}) {
  return (
    <>
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
          selected={selectedId === entry.summary.id}
          onSelect={() => onSelect(entry.summary.id)}
          onPlace={onPlace ? () => onPlace(entry.summary.id) : undefined}
        />
      ))}
    </>
  );
}

function Roster({ crew, sceneTokens, onSelect }: { crew: CrewData; sceneTokens: Map<string, string>; onSelect: (id: string) => void }) {
  return (
    <div className="stack">
      <h2 className="heading">Alle Charaktere · {crew.group?.group.name}</h2>
      <div className="roster">
        {(crew.group?.characters ?? []).map((character) => (
          <button key={character.id} className="crew-card" onClick={() => onSelect(character.id)}>
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
