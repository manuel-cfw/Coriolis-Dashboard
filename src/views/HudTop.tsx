import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useRef } from "react";
import { InfoBar } from "../components/InfoBar";
import { Wordmark } from "../components/ui";
import { useAuth, useCrewData, useObr, useRoomSettings, useSceneTokens } from "../lib/hooks";
import { POPOVER_TOP } from "../lib/settings";

const maxWidth = Number(new URLSearchParams(window.location.search).get("max")) || 1200;

/** Schwebende Infoleiste oben über der Karte. */
export function HudTop() {
  const obr = useObr();
  const user = useAuth();
  const settings = useRoomSettings(obr, user);
  const sceneTokens = useSceneTokens(obr);
  const crew = useCrewData(obr, user, settings, sceneTokens);
  const ref = useRef<HTMLDivElement>(null);

  // Popover-Breite an den Inhalt anpassen, damit die Karte daneben klickbar bleibt
  useEffect(() => {
    const element = ref.current;
    if (!element || obr.status !== "ready") return;
    let last = 0;
    const observer = new ResizeObserver(() => {
      const width = Math.min(maxWidth, Math.ceil(element.scrollWidth) + 2);
      if (Math.abs(width - last) > 1) {
        last = width;
        void OBR.popover.setWidth(POPOVER_TOP, width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [obr.status]);

  const openDashboard = () => {
    if (obr.status === "ready") void OBR.action.open();
  };

  return (
    <div ref={ref} style={{ width: "max-content", maxWidth }}>
      {!user || !settings ? (
        <header className="infobar hud-top">
          <div className="brand">
            <button className="btn btn-ghost" style={{ padding: 0, height: "auto" }} onClick={openDashboard}>
              <Wordmark />
            </button>
          </div>
          <div className="info-cell">
            <span className="eyebrow">Dashboard</span>
            <span className="value dim">{user ? "Lade …" : "Bitte im Coriolis-Dashboard anmelden"}</span>
          </div>
        </header>
      ) : (
        <InfoBar obr={obr} user={user} settings={settings} crew={crew} hud onOpenDashboard={openDashboard} />
      )}
    </div>
  );
}
