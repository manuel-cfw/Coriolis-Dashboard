import type { CrewData } from "../lib/hooks";
import type { Character, GroupCharacter } from "../lib/types";
import { Portrait, StatRow } from "./ui";

export interface CrewEntry {
  summary: GroupCharacter;
  detail: Character | undefined;
  onMap: boolean;
  ownerOnline: boolean;
}

export function buildCrewEntries(
  crew: CrewData,
  ids: string[],
  sceneTokens: Map<string, string>,
  onlineUserIds: Set<string>
): CrewEntry[] {
  const byId = new Map((crew.group?.characters ?? []).map((c) => [c.id, c]));
  return ids.flatMap((id) => {
    const summary = byId.get(id);
    if (!summary) return [];
    return [
      {
        summary,
        detail: crew.details.get(id),
        onMap: sceneTokens.has(id),
        ownerOnline: !!summary.user_id && onlineUserIds.has(summary.user_id),
      },
    ];
  });
}

export function CrewCard({
  entry,
  selected,
  onSelect,
  onPlace,
  compact = false,
}: {
  entry: CrewEntry;
  selected: boolean;
  onSelect: () => void;
  onPlace?: () => void;
  compact?: boolean;
}) {
  const { summary, detail } = entry;
  const concept = detail
    ? [detail.concept, detail.sub_concept].filter(Boolean).join(" / ")
    : summary.concept ?? "";
  return (
    <div
      className={`crew-card ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Portrait character={summary} size={compact ? 38 : 44} />
      <div className="body">
        <span className="name">{summary.name}</span>
        {!compact && concept && <span className="concept">{concept}</span>}
        {detail && (
          <>
            <StatRow label="HP" kind="hp" current={detail.hp_current} max={detail.hp_max} />
            <StatRow label="WK" kind="mp" current={detail.mp_current} max={detail.mp_max} />
          </>
        )}
        <div className="meta">
          <span className={`status-dot ${entry.onMap ? "on" : ""}`} title={entry.onMap ? "Token auf der Karte" : "Nicht auf der Karte"} />
          <span className="dim" style={{ fontSize: 10.5 }}>
            {entry.onMap ? "Auf Karte" : "Nicht auf Karte"}
          </span>
          {detail && detail.radiation > 0 && <span className="badge badge-amber">RAD {detail.radiation}</span>}
          {detail && (detail.critical_injuries?.length ?? 0) > 0 && (
            <span className="badge badge-danger">KRIT {detail.critical_injuries!.length}</span>
          )}
          {!compact && summary.owner_name && (
            <span className="dim" style={{ fontSize: 10.5 }} title={entry.ownerOnline ? "Spieler ist im Raum" : "Spieler ist nicht im Raum"}>
              {entry.ownerOnline ? "● " : "○ "}
              {summary.owner_name}
            </span>
          )}
        </div>
        {onPlace && !entry.onMap && (
          <button
            className="btn btn-sm btn-teal"
            style={{ alignSelf: "flex-start", marginTop: 2 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlace();
            }}
          >
            Auf Karte
          </button>
        )}
      </div>
    </div>
  );
}
