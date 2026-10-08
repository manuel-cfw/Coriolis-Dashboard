import { useState } from "react";
import { api } from "../lib/api";
import { ATTRIBUTES, RADIATION_MAX, RANGE_LABELS, SKILLS } from "../lib/labels";
import type { Character } from "../lib/types";
import { Bar, Dots, Panel, Portrait } from "./ui";

interface CharacterDetailProps {
  character: Character;
  /** Schmale Darstellung für das Panel neben der Karte */
  compact?: boolean;
  onMap: boolean;
  obrAvailable: boolean;
  canPlace: boolean;
  canEditStats: boolean;
  onPlace: () => Promise<void>;
  onFocus: () => Promise<void>;
  onSyncToken: () => Promise<void>;
  onRemoveToken: () => Promise<void>;
  onChanged: () => void;
}

type TrackKey = "hp_current" | "mp_current" | "radiation";

export function CharacterDetail({
  character,
  compact = false,
  onMap,
  obrAvailable,
  canPlace,
  canEditStats,
  onPlace,
  onFocus,
  onSyncToken,
  onRemoveToken,
  onChanged,
}: CharacterDetailProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const adjust = (key: TrackKey, delta: number, max: number) =>
    run(key, async () => {
      const next = Math.min(max, Math.max(0, (character[key] ?? 0) + delta));
      if (next === character[key]) return;
      await api.updateCharacter(character.id, { [key]: next });
      onChanged();
    });

  const tracks: Array<{ key: TrackKey; label: string; kind: "hp" | "mp" | null; current: number; max: number }> = [
    { key: "hp_current", label: "Trefferpunkte", kind: "hp", current: character.hp_current, max: character.hp_max },
    { key: "mp_current", label: "Willenskraft", kind: "mp", current: character.mp_current, max: character.mp_max },
    { key: "radiation", label: "Strahlung", kind: null, current: character.radiation ?? 0, max: RADIATION_MAX },
  ];

  const concept = [character.concept, character.sub_concept].filter(Boolean).join(" / ");
  const weapons = character.weapons ?? [];
  const talents = character.talents ?? [];
  const injuries = character.critical_injuries ?? [];
  const gear = character.gear ?? [];

  return (
    <div className={`stack ${compact ? "compact" : ""}`}>
      <div className="detail-head">
        <Portrait character={character} size={compact ? 56 : 84} />
        <div className="title">
          <h1>{character.name}</h1>
          <div className="dim">{concept || "Ohne Konzept"}</div>
          <div className="row wrap" style={{ marginTop: 6 }}>
            {character.origin && <span className="badge">{character.origin}</span>}
            {character.crew_position && <span className="badge badge-teal">{character.crew_position}</span>}
            {character.icon && <span className="badge badge-gold">Ikone · {character.icon}</span>}
            <span className="badge">REP {character.reputation ?? 0}</span>
            <span className="badge">BIRR {character.birr ?? 0}</span>
            <span className="badge">EP {character.experience ?? 0}</span>
          </div>
        </div>
        {obrAvailable && (
          <div className="detail-actions">
            {onMap ? (
              <>
                <button className="btn btn-teal" disabled={!!busy} onClick={() => run("focus", onFocus)}>
                  Zum Token
                </button>
                <button className="btn btn-gold" disabled={!!busy} onClick={() => run("sync", onSyncToken)}>
                  {busy === "sync" ? "Aktualisiere …" : "Token aktualisieren"}
                </button>
                {canPlace && (
                  <button className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => run("remove", onRemoveToken)}>
                    Token entfernen
                  </button>
                )}
              </>
            ) : (
              <button className="btn btn-gold" disabled={!!busy || !canPlace} onClick={() => run("place", onPlace)} title={canPlace ? undefined : "Der GM hat das Platzieren für Spieler deaktiviert"}>
                {busy === "place" ? "Übertrage …" : "In Owlbear übertragen"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid-2">
        <Panel title="Zustand">
          {tracks.map((track) => (
            <div className="track" key={track.key}>
              <span className="dim">{track.label}</span>
              {track.kind ? (
                <Bar kind={track.kind} current={track.current} max={track.max} />
              ) : (
                <Dots value={track.current} max={track.max} amber />
              )}
              <span className="stepper">
                {canEditStats && (
                  <button className="btn btn-sm btn-icon" disabled={!!busy} onClick={() => adjust(track.key, -1, track.max)} aria-label={`${track.label} verringern`}>
                    −
                  </button>
                )}
                <span className="num">
                  {track.current}/{track.max}
                </span>
                {canEditStats && (
                  <button className="btn btn-sm btn-icon" disabled={!!busy} onClick={() => adjust(track.key, 1, track.max)} aria-label={`${track.label} erhöhen`}>
                    +
                  </button>
                )}
              </span>
            </div>
          ))}
          {character.armor && (
            <div className="row" style={{ marginTop: 6 }}>
              <span className="dim">Rüstung</span>
              <span>{character.armor.name}</span>
              <span className="badge badge-gold">RS {character.armor.armor_rating}</span>
            </div>
          )}
        </Panel>

        <Panel title="Attribute">
          <div className="attr-grid">
            {ATTRIBUTES.map((attr) => (
              <div className="attr" key={attr.key} title={attr.label}>
                <span className="eyebrow">{attr.short}</span>
                <span className="value">{character[attr.key]}</span>
                <Dots value={character[attr.key]} max={5} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Fertigkeiten">
        <div className="skill-list">
          {SKILLS.map((skill) => {
            const value = character.skills?.[skill.key] ?? 0;
            return (
              <div className={`skill ${value === 0 ? "zero" : ""}`} key={skill.key}>
                <span>
                  {skill.label}
                  <span className="attr-tag">{skill.attr}</span>
                </span>
                <Dots value={value} max={5} />
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Waffen">
        {weapons.length === 0 ? (
          <span className="dim">Keine Waffen eingetragen.</span>
        ) : (
          <div style={{ overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Bonus</th>
                <th>Init</th>
                <th>Schaden</th>
                <th>Krit</th>
                <th>Reichweite</th>
              </tr>
            </thead>
            <tbody>
              {weapons.map((weapon) => (
                <tr key={weapon.id}>
                  <td>
                    {weapon.name}
                    {weapon.features?.length > 0 && <div className="dim" style={{ fontSize: 11 }}>{weapon.features.join(", ")}</div>}
                  </td>
                  <td className="mono">{weapon.bonus || "–"}</td>
                  <td className="mono">{weapon.init ?? "–"}</td>
                  <td className="mono">{weapon.damage || "–"}</td>
                  <td className="mono">{weapon.crit || "–"}</td>
                  <td>{RANGE_LABELS[weapon.range] ?? weapon.range ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title="Talente">
          {talents.length === 0 ? (
            <span className="dim">Keine Talente.</span>
          ) : (
            <ul className="list">
              {talents.map((talent) => (
                <li key={talent.id} title={talent.description}>
                  <div>{talent.name}</div>
                  {talent.description && (
                    <div className="desc">{talent.description.length > 140 ? `${talent.description.slice(0, 140)} …` : talent.description}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="stack">
          <Panel title="Kritische Verletzungen">
            {injuries.length === 0 ? (
              <span className="dim">Keine.</span>
            ) : (
              <ul className="list">
                {injuries.map((injury) => (
                  <li key={injury.id} className={injury.lethal ? "lethal" : ""}>
                    <div>
                      {injury.name} {injury.lethal && <span className="badge badge-danger">Tödlich</span>}
                    </div>
                    <div className="desc">{injury.effect}</div>
                    {injury.healing_time && <div className="desc">Heilung: {injury.healing_time}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Ausrüstung">
            {gear.length === 0 ? (
              <span className="dim">Keine Ausrüstung.</span>
            ) : (
              <div className="row wrap">
                {gear.map((item) => (
                  <span className="badge" key={item.id}>
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {character.personal_problem && (
        <Panel title="Persönliches Problem">
          <p className="quote" style={{ margin: 0 }}>
            {character.personal_problem}
          </p>
        </Panel>
      )}
    </div>
  );
}
