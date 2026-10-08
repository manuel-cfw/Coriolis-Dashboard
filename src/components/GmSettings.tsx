import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { broadcastRefresh, type CrewData, type ObrState } from "../lib/hooks";
import { INFO_FIELD_LABELS, updateRoomSettings, type InfoField, type RoomSettings, type SettingsPatch } from "../lib/settings";
import type { GroupListEntry } from "../lib/types";
import { Panel, Portrait } from "./ui";

interface GmSettingsProps {
  obr: ObrState;
  settings: RoomSettings;
  crew: CrewData;
  sceneTokens: Map<string, string>;
  onPlaceAll: () => Promise<void>;
  onSyncAll: () => Promise<number>;
  onRemoveAll: () => Promise<void>;
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <label className="check" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function GmSettings({ obr, settings, crew, sceneTokens, onPlaceAll, onSyncAll, onRemoveAll }: GmSettingsProps) {
  const [groups, setGroups] = useState<GroupListEntry[] | null>(null);
  const [info, setInfo] = useState(settings.info);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.groups().then(setGroups).catch((err: Error) => setMessage({ kind: "error", text: err.message }));
  }, []);

  // Eingabefelder nachziehen, wenn sich die gespeicherten Werte wirklich ändern
  // (die Einstellungen werden bei jeder Änderung neu aufgebaut)
  const savedInfoKey = JSON.stringify(settings.info);
  useEffect(() => setInfo(JSON.parse(savedInfoKey) as RoomSettings["info"]), [savedInfoKey]);

  const save = async (patch: SettingsPatch) => {
    try {
      await updateRoomSettings(patch);
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
  };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ kind: "ok", text: await action() });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const selectGroup = (groupId: string) => {
    const group = groups?.find((g) => g.id === groupId);
    void save({ groupId: groupId || null, groupName: group?.name ?? null, activeCharacterIds: [] });
  };

  const toggleActive = (characterId: string, active: boolean) => {
    const ids = settings.activeCharacterIds.filter((id) => id !== characterId);
    if (active) ids.push(characterId);
    void save({ activeCharacterIds: ids });
  };

  const infoDirty = (Object.keys(info) as Array<keyof typeof info>).some((key) => info[key] !== settings.info[key]);
  const darkness = crew.group?.darknessPoints ?? 0;
  const isGroupGm = crew.group?.userRole === "gm";

  return (
    <div className="stack">
      <div>
        <h2 className="heading">GM-Einstellungen</h2>
        <p className="dim" style={{ margin: "2px 0 0" }}>
          Nur für den Owlbear-GM sichtbar. Alle Einstellungen gelten für den ganzen Raum.
        </p>
      </div>

      {message && <div className={message.kind === "error" ? "error" : "hint"}>{message.text}</div>}

      <div className="grid-2">
        <Panel title="Gruppe verknüpfen">
          <div className="stack" style={{ gap: 8 }}>
            <select className="select" value={settings.groupId ?? ""} onChange={(e) => selectGroup(e.target.value)} disabled={!groups}>
              <option value="">– Gruppe wählen –</option>
              {groups?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} {group.user_role === "gm" ? "(Spielleiter)" : ""}
                </option>
              ))}
            </select>
            <span className="dim" style={{ fontSize: 11.5 }}>
              Alle Spieler im Raum sehen die Charaktere dieser Gruppe – vorausgesetzt, sie sind in der Coriolis-App Mitglied der Gruppe.
            </span>
            {crew.group && !isGroupGm && (
              <div className="hint">Du bist in dieser Gruppe nicht Spielleiter der Coriolis-App. Dunkelheitspunkte und fremde Charaktere kannst du daher nicht ändern.</div>
            )}
          </div>
        </Panel>

        <Panel title="Dunkelheitspunkte">
          <div className="row between">
            <div className="row">
              <button className="btn btn-icon" disabled={!isGroupGm || busy || darkness <= 0} onClick={() => run(async () => {
                await api.updateDarkness(settings.groupId!, darkness - 1);
                crew.reload();
                broadcastRefresh(obr);
                return `Dunkelheitspunkte: ${darkness - 1}`;
              })}>
                −
              </button>
              <span className="mono" style={{ fontSize: 26, color: "var(--gold-300)", minWidth: 40, textAlign: "center" }}>
                {darkness}
              </span>
              <button className="btn btn-icon" disabled={!isGroupGm || busy} onClick={() => run(async () => {
                await api.updateDarkness(settings.groupId!, darkness + 1);
                crew.reload();
                broadcastRefresh(obr);
                return `Dunkelheitspunkte: ${darkness + 1}`;
              })}>
                +
              </button>
            </div>
            <Toggle
              label="Für Spieler sichtbar"
              checked={settings.darknessVisibleToPlayers}
              onChange={(value) => save({ darknessVisibleToPlayers: value })}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="Aktive Crew"
        actions={
          <button className="btn btn-sm btn-teal" disabled={busy || !obr.sceneReady} onClick={() => run(async () => {
            await onPlaceAll();
            return "Fehlende Tokens wurden in die Bildmitte gesetzt.";
          })}>
            Alle auf Karte
          </button>
        }
      >
        {!crew.group ? (
          <span className="dim">Zuerst eine Gruppe verknüpfen.</span>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            <div className="roster">
              {crew.group.characters.map((character) => {
                const active = settings.activeCharacterIds.includes(character.id);
                const onMap = sceneTokens.has(character.id);
                return (
                  <label key={character.id} className={`crew-card ${active ? "selected" : ""}`} style={{ alignItems: "center" }}>
                    <input type="checkbox" checked={active} onChange={(e) => toggleActive(character.id, e.target.checked)} style={{ accentColor: "var(--teal-300)" }} />
                    <Portrait character={character} size={32} />
                    <span className="body">
                      <span className="name">{character.name}</span>
                      <span className="concept">
                        {character.owner_name ?? "NSC"} {onMap ? "· auf Karte" : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <Toggle
              label="Charaktere mit Token in der Szene automatisch zur aktiven Crew zählen"
              checked={settings.activeFromScene}
              onChange={(value) => save({ activeFromScene: value })}
            />
          </div>
        )}
      </Panel>

      <Panel
        title="Szene, Ort & Spielzeit"
        actions={
          <button className="btn btn-sm btn-gold" disabled={!infoDirty} onClick={() => save({ info })}>
            Übernehmen
          </button>
        }
      >
        <div className="grid-3">
          <label className="field">
            <span>Sitzung</span>
            <input className="input" value={info.session} placeholder="Sitzung 12" onChange={(e) => setInfo({ ...info, session: e.target.value })} />
          </label>
          <label className="field">
            <span>Ort</span>
            <input className="input" value={info.location} placeholder="Coriolis-Station – Konus" onChange={(e) => setInfo({ ...info, location: e.target.value })} />
          </label>
          <label className="field">
            <span>Spielzeit</span>
            <input className="input" value={info.gameDate} placeholder="Tag 34, Zyklus des Wanderers" onChange={(e) => setInfo({ ...info, gameDate: e.target.value })} />
          </label>
          <label className="field">
            <span>Ikone der Sitzung</span>
            <input className="input" value={info.icon} placeholder="Der Reisende" onChange={(e) => setInfo({ ...info, icon: e.target.value })} />
          </label>
          <label className="field">
            <span>Lage / Status</span>
            <input className="input" value={info.status} placeholder="Kampf: Runde 3" onChange={(e) => setInfo({ ...info, status: e.target.value })} />
          </label>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Infoleiste konfigurieren">
          {(Object.keys(INFO_FIELD_LABELS) as InfoField[]).map((field) => (
            <Toggle
              key={field}
              label={INFO_FIELD_LABELS[field]}
              checked={settings.infoBar[field]}
              onChange={(value) => save({ infoBar: { [field]: value } })}
            />
          ))}
          <Toggle
            label="HUD (Infoleiste & Crew über der Karte) standardmäßig einblenden"
            checked={settings.hudDefaultOn}
            onChange={(value) => save({ hudDefaultOn: value })}
          />
        </Panel>

        <Panel title="Token-Einstellungen">
          <div className="stack" style={{ gap: 8 }}>
            <div className="grid-2" style={{ gap: 8 }}>
              <label className="field">
                <span>Tokengröße (Felder)</span>
                <select className="select" value={settings.token.size} onChange={(e) => save({ token: { size: Number(e.target.value) } })}>
                  {[0.5, 1, 1.5, 2, 3].map((size) => (
                    <option key={size} value={size}>
                      {size.toLocaleString("de-DE")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ebene</span>
                <select className="select" value={settings.token.layer} onChange={(e) => save({ token: { layer: e.target.value as "CHARACTER" | "MOUNT" } })}>
                  <option value="CHARACTER">Charakter</option>
                  <option value="MOUNT">Reittier / Fahrzeug</option>
                </select>
              </label>
            </div>
            <Toggle label="Namen am Token anzeigen" checked={settings.token.showName} onChange={(value) => save({ token: { showName: value } })} />
            <Toggle label="HP- & WK-Balken am Token anzeigen" checked={settings.token.showBars} onChange={(value) => save({ token: { showBars: value } })} />
            <Toggle
              label="Balken nur für den GM sichtbar"
              checked={settings.token.barsGmOnly}
              onChange={(value) => save({ token: { barsGmOnly: value } })}
              hint="Unsichtbare Owlbear-Objekte sieht nur der GM."
            />
          </div>
        </Panel>

        <Panel title="Rechte der Spieler">
          <Toggle
            label="Spieler dürfen Charaktere auf die Karte setzen"
            checked={settings.permissions.playersPlaceTokens}
            onChange={(value) => save({ permissions: { playersPlaceTokens: value } })}
          />
          <Toggle
            label="Spieler dürfen HP, WK & Strahlung ihrer eigenen Charaktere ändern"
            checked={settings.permissions.playersEditOwnStats}
            onChange={(value) => save({ permissions: { playersEditOwnStats: value } })}
          />
          <p className="dim" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
            Alle Spieler sehen alle Charaktere der Gruppe. Bearbeiten erlaubt die Coriolis-App ohnehin nur Besitzer und Spielleiter.
          </p>
        </Panel>

        <Panel title="Synchronisation">
          <div className="stack" style={{ gap: 8 }}>
            <Toggle
              label="Tokens automatisch mit der Coriolis-App abgleichen"
              checked={settings.sync.auto}
              onChange={(value) => save({ sync: { auto: value } })}
            />
            <label className="field">
              <span>Intervall</span>
              <select className="select" value={settings.sync.intervalSec} onChange={(e) => save({ sync: { intervalSec: Number(e.target.value) } })}>
                {[5, 10, 15, 30, 60].map((sec) => (
                  <option key={sec} value={sec}>
                    alle {sec} Sekunden
                  </option>
                ))}
              </select>
            </label>
            <div className="row wrap">
              <button className="btn btn-sm btn-teal" disabled={busy || !obr.sceneReady} onClick={() => run(async () => `${await onSyncAll()} Änderung(en) an Tokens übernommen.`)}>
                Jetzt synchronisieren
              </button>
              <button className="btn btn-sm btn-danger" disabled={busy || !obr.sceneReady || sceneTokens.size === 0} onClick={() => run(async () => {
                await onRemoveAll();
                return "Alle Charakter-Tokens wurden entfernt.";
              })}>
                Alle Tokens entfernen
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
