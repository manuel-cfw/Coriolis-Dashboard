import { useState } from "react";
import { api, clearSession } from "../lib/api";
import { broadcastRefresh, type CrewData, type ObrState } from "../lib/hooks";
import type { RoomSettings } from "../lib/settings";
import type { User } from "../lib/types";
import { Bar, Wordmark } from "./ui";

interface InfoBarProps {
  obr: ObrState;
  user: User | null;
  settings: RoomSettings;
  crew: CrewData;
  hud?: boolean;
  onOpenDashboard?: () => void;
}

function Cell({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="info-cell" title={title}>
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}

export function InfoBar({ obr, user, settings, crew, hud = false, onOpenDashboard }: InfoBarProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const show = settings.infoBar;
  const isGm = obr.role === "GM";
  const isGroupGm = crew.group?.userRole === "gm";
  const darkness = crew.group?.darknessPoints ?? 0;
  const { ship } = crew;

  const changeDarkness = async (delta: number) => {
    if (!settings.groupId) return;
    setBusy(true);
    setError(null);
    try {
      await api.adjustDarkness(settings.groupId, delta);
      crew.reload();
      broadcastRefresh(obr);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const groupName = crew.group?.group.name ?? settings.groupName;

  return (
    <header className={`infobar ${hud ? "hud-top" : ""}`}>
      <div className="brand">
        {onOpenDashboard ? (
          <button className="btn btn-ghost" style={{ padding: 0, height: "auto" }} onClick={onOpenDashboard} title="Dashboard öffnen">
            <Wordmark />
          </button>
        ) : (
          <Wordmark />
        )}
      </div>

      {show.group && groupName && (
        <Cell label="Gruppe">
          <span className="value">{groupName}</span>
        </Cell>
      )}

      {show.ship && ship && (
        <Cell label={ship.name ? `Schiff · ${ship.name}` : "Schiff"}>
          <div className="bars">
            <span className="dim">Rumpf</span>
            <Bar kind="hull" current={ship.hull_points_current ?? ship.hull_points ?? 0} max={ship.hull_points ?? 0} />
            <span className="mono">
              {ship.hull_points_current ?? ship.hull_points ?? 0}/{ship.hull_points ?? 0}
            </span>
            <span className="dim">Energie</span>
            <Bar kind="energy" current={ship.energy_points_current ?? ship.energy_points ?? 0} max={ship.energy_points ?? 0} />
            <span className="mono">
              {ship.energy_points_current ?? ship.energy_points ?? 0}/{ship.energy_points ?? 0}
            </span>
          </div>
        </Cell>
      )}

      {show.darkness && crew.group && (isGm || settings.darknessVisibleToPlayers) && (
        <Cell label="Dunkelheit" title={error ?? "Dunkelheitspunkte"}>
          <div className="darkness-pips">
            {isGm && isGroupGm && (
              <button className="btn btn-sm btn-icon" onClick={() => changeDarkness(-1)} disabled={busy || darkness <= 0} aria-label="Dunkelheitspunkt entfernen">
                −
              </button>
            )}
            <span className="count">{darkness}</span>
            {isGm && isGroupGm && (
              <button className="btn btn-sm btn-icon" onClick={() => changeDarkness(1)} disabled={busy} aria-label="Dunkelheitspunkt hinzufügen">
                +
              </button>
            )}
          </div>
        </Cell>
      )}

      {show.session && settings.info.session && (
        <Cell label="Sitzung">
          <span className="value">{settings.info.session}</span>
        </Cell>
      )}
      {show.location && settings.info.location && (
        <Cell label="Ort">
          <span className="value">{settings.info.location}</span>
        </Cell>
      )}
      {show.gameDate && settings.info.gameDate && (
        <Cell label="Spielzeit">
          <span className="value">{settings.info.gameDate}</span>
        </Cell>
      )}
      {show.icon && settings.info.icon && (
        <Cell label="Ikone">
          <span className="value quote">{settings.info.icon}</span>
        </Cell>
      )}
      {show.status && settings.info.status && (
        <Cell label="Lage">
          <span className="value" style={{ color: "var(--amber-400)" }}>
            {settings.info.status}
          </span>
        </Cell>
      )}

      <div className="spacer" />

      {!hud && (
        <div className="user">
          {user ? (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="eyebrow">Angemeldet als</span>
                <span>
                  {user.name}
                  {isGm && <span className="badge badge-gold" style={{ marginLeft: 6 }}>GM</span>}
                </span>
              </div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  clearSession();
                  window.dispatchEvent(new Event("coriolis-auth-change"));
                }}
              >
                Abmelden
              </button>
            </>
          ) : (
            <span className="dim">Nicht angemeldet</span>
          )}
        </div>
      )}
    </header>
  );
}
