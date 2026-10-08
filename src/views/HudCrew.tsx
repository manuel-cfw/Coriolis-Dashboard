import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { CrewCard, buildCrewEntries } from "../components/CrewList";
import { useAuth, useCrewData, useObr, useOnlinePlayers, useRoomSettings, useSceneTokens } from "../lib/hooks";
import { POPOVER_CREW, SELECTED_STORAGE_KEY, getSelectedCharacterId, setSelectedCharacterId } from "../lib/settings";
import { focusToken } from "../lib/tokens";

const COLLAPSED_KEY = "coriolis-dashboard:hud-crew-collapsed";
const maxHeight = Number(new URLSearchParams(window.location.search).get("max")) || 700;

/** Schwebende Crew-Leiste links über der Karte. */
export function HudCrew() {
  const obr = useObr();
  const user = useAuth();
  const settings = useRoomSettings(obr);
  const sceneTokens = useSceneTokens(obr);
  const online = useOnlinePlayers(obr, user);
  const crew = useCrewData(obr, user, settings, sceneTokens);
  const onlineIds = useMemo(() => new Set(online.map((p) => p.userId)), [online]);
  const entries = useMemo(() => buildCrewEntries(crew, crew.activeIds, sceneTokens, onlineIds), [crew, sceneTokens, onlineIds]);
  const [selectedId, setSelectedId] = useState(getSelectedCharacterId);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTED_STORAGE_KEY) setSelectedId(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Popover-Höhe an den Inhalt anpassen
  useEffect(() => {
    const element = ref.current;
    if (!element || obr.status !== "ready") return;
    let last = 0;
    const observer = new ResizeObserver(() => {
      const height = Math.min(maxHeight, Math.ceil(element.scrollHeight) + 8);
      if (Math.abs(height - last) > 1) {
        last = height;
        void OBR.popover.setHeight(POPOVER_CREW, height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [obr.status]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // ignorieren
    }
  };

  const visible = !!user && !!settings?.groupId;

  return (
    <div ref={ref} className="hud-crew" style={{ maxHeight, overflowY: "auto", display: visible ? undefined : "none" }}>
      <div className="hud-crew-head">
        <span className="eyebrow" style={{ color: "var(--gold-400)" }}>
          Aktive Crew · {entries.length}
        </span>
        <button className="btn btn-sm btn-ghost" onClick={toggleCollapsed} aria-expanded={!collapsed}>
          {collapsed ? "Zeigen" : "Einklappen"}
        </button>
      </div>
      {!collapsed &&
        entries.map((entry) => (
          <CrewCard
            key={entry.summary.id}
            entry={entry}
            compact
            selected={selectedId === entry.summary.id}
            onSelect={() => {
              setSelectedId(entry.summary.id);
              setSelectedCharacterId(entry.summary.id);
              const tokenId = sceneTokens.get(entry.summary.id);
              if (tokenId && obr.status === "ready") void focusToken(tokenId);
              if (obr.status === "ready") void OBR.action.open();
            }}
          />
        ))}
    </div>
  );
}
